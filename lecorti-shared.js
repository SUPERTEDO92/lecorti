// ============================================
// LE CORTI — modulo condiviso
// Funzioni/costanti usate da più pagine del gestionale.
// Cambiare qui aggiorna automaticamente tutte le pagine che lo includono
// con <script src="lecorti-shared.js"></script> PRIMA del proprio <script>.
//
// Script "normale" (non ES module) di proposito: le pagine usano onclick="..."
// inline nell'HTML, che richiedono funzioni globali — un modulo ES le renderebbe
// non raggiungibili senza attaccarle a window manualmente.
// ============================================

const SUPABASE_URL = 'https://wfvqgxkxmgcxchcsljzh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmdnFneGt4bWdjeGNoY3NsanpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMTE1NTAsImV4cCI6MjA5NTg4NzU1MH0.hIhbdVFeCTDJ9bBBqetef87VTCtocMflYUQ_7kvxJF8';
const SB_H = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

// Formattazione numeri in stile italiano (1.234,5)
function fmt(n, dec = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// Formattazione data da 'YYYY-MM-DD' a 'GG/MM/AAAA'
function fmtDate(d) {
  if (!d) return '—';
  const [y, m, g] = d.split('-');
  return `${g}/${m}/${y}`;
}

// Formattazione data estesa da 'YYYY-MM-DD' a 'G mese AAAA'
function fmtDateFull(d) {
  if (!d) return '—';
  const [y, m, g] = d.split('-');
  const mesi = ['', 'gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  return `${parseInt(g)} ${mesi[parseInt(m)]} ${y}`;
}

// Query GET verso Supabase REST — restituisce direttamente il JSON
async function sb(table, query = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  return r.json();
}

// Apre un documento (DDT/liquidazione/referto/fattura) collegato a un record.
// Legge storage_path e apre il file da Supabase Storage; fallback su decodifica
// bytea per eventuali documenti vecchi non ancora migrati a Storage.
// Toast di conferma/errore — usa un elemento #toast presente nella pagina
function showToast(msg, ok) {
  const t = document.getElementById('toast');
  t.className = 'toast ' + (ok ? 'ok' : 'err');
  t.textContent = msg;
  t.style.display = 'block';
  if (ok) setTimeout(() => t.style.display = 'none', 4000);
}

// Modale mortalità — versione condivisa (campobello/scaratti/vezzoli).
// FIORENZUOLA ha una propria versione locale (gestisce anche il capannone),
// caricata dopo questo script: la sovrascrive intenzionalmente per quella pagina.
function apriModal(lottoId) {
  _mortLottoId = lottoId;
  const lotto = allLotti.find(l => l.id === lottoId);
  document.getElementById('modal-info').textContent =
    `${NOME_SOCCIDA} · Lotto ${lotto?.codice || '—'}${lotto?.lettera_dop ? ' · ' + lotto.lettera_dop : ''}`;
  ['m-tratt', 'm-note', 'm-capi'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('m-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-mort').style.display = 'flex';
}

function chiudiModal() {
  document.getElementById('modal-mort').style.display = 'none';
  _mortLottoId = null;
}

async function salvaMortalita() {
  const data = document.getElementById('m-data').value;
  const capi = parseInt(document.getElementById('m-capi').value) || 0;
  const tratt = document.getElementById('m-tratt').value || null;
  const note = document.getElementById('m-note').value || null;
  if (!data) { alert('Inserisci la data'); return; }

  const lotto = allLotti.find(l => l.id === _mortLottoId);

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/mortalita`, {
      method: 'POST', headers: SB_H,
      body: JSON.stringify({
        lotto_id: _mortLottoId,
        soccida: NOME_SOCCIDA,
        data_evento: data,
        lettera_dop: lotto?.lettera_dop || null,
        capi_morti: capi,
        trattamento: tratt,
        note
      })
    });
    if (!r.ok) throw new Error(await r.text());
    const nuova = await r.json();
    if (Array.isArray(nuova)) allMortalita.push(...nuova); else allMortalita.push(nuova);
    chiudiModal();
    showToast(`✓ Mortalità registrata — ${capi} capi il ${fmtDate(data)}`, true);
    render();
  } catch (e) {
    showToast('Errore: ' + e.message, false);
  }
}

async function apriDocumento(docId) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/documenti?id=eq.${docId}&select=nome_file,content_type,contenuto,storage_path`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const rows = await r.json();
    if (!rows.length) { alert('Documento non trovato.'); return; }
    const doc = rows[0];
    if (doc.storage_path) {
      window.open(`${SUPABASE_URL}/storage/v1/object/public/documenti/${doc.storage_path}`, '_blank');
      return;
    }
    let hex = doc.contenuto;
    if (hex.startsWith('\\x')) hex = hex.slice(2);
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    const blob = new Blob([bytes], { type: doc.content_type || 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (e) {
    alert('Errore apertura documento: ' + e.message);
  }
}

// ============================================
// NOTE — allegati multimediali (foto multiple + nota vocale + dettatura)
// Usato dalla tendina "Registra nota" di index.html e veterinario.html.
// La pagina deve avere nel modale un <div id="nota-media"></div> e chiamare:
//   notaMediaReset()            all'apertura della tendina
//   await notaMediaUpload()     nel salvataggio → { foto_documento_ids, audio_documento_id }
//   notaMediaStop()             alla chiusura (spegne microfono/dettatura)
//   notaMediaRender(nota)       nell'elenco note → miniature foto + player audio
// I file vanno nel bucket pubblico "documenti" + riga in tabella documenti,
// come le foto già caricate dalle note.
// ============================================
const NotaMedia = { foto: [], audio: null, rec: null, recChunks: [], recStream: null, recTimer: null, recStart: 0, sr: null };

function _nmEsc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function notaMediaUrl(storagePath) { return `${SUPABASE_URL}/storage/v1/object/public/documenti/${storagePath}`; }

function notaCompressImage(file, maxDim = 1800, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      const k = Math.min(1, maxDim / Math.max(width, height));
      width = Math.round(width * k); height = Math.round(height * k);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(b => { URL.revokeObjectURL(url); b ? resolve(b) : reject(new Error('Compressione fallita')); }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non leggibile')); };
    img.src = url;
  });
}

function notaMediaHtml() {
  const hasSR = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const btn = 'flex:1;padding:10px 6px;border:0.5px solid var(--border);border-radius:10px;background:var(--bg2);font-size:12px;font-family:var(--font);cursor:pointer;color:var(--text);';
  return `
    <div>
      <div class="field-label">FOTO (opzionale, anche più di una)</div>
      <div style="display:flex;gap:6px;">
        <label style="${btn}text-align:center;">📷 Scatta<input type="file" accept="image/*" capture="environment" style="display:none" onchange="notaMediaAddFoto(this)"></label>
        <label style="${btn}text-align:center;">🖼️ Galleria<input type="file" accept="image/*" multiple style="display:none" onchange="notaMediaAddFoto(this)"></label>
      </div>
      <div id="nm-foto" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;"></div>
    </div>
    <div>
      <div class="field-label">NOTA VOCALE (opzionale)</div>
      <div style="display:flex;gap:6px;">
        <button type="button" id="nm-rec-btn" onclick="notaMediaToggleRec()" style="${btn}">🎙️ Registra</button>
        <label style="${btn}text-align:center;">📎 Carica audio<input type="file" accept="audio/*,.opus,.ogg,.m4a,.mp3,.aac,.amr,.wav" style="display:none" onchange="notaMediaAddAudio(this)"></label>
        ${hasSR ? `<button type="button" id="nm-sr-btn" onclick="notaMediaToggleDettatura()" style="${btn}">🗣️ Detta testo</button>` : ''}
      </div>
      <div id="nm-audio" style="margin-top:8px;"></div>
      ${hasSR ? '' : '<div style="font-size:10px;color:var(--text3,#999);margin-top:4px;">Dettatura non supportata da questo browser (usa Chrome).</div>'}
    </div>`;
}

function notaMediaReset() {
  notaMediaStop();
  NotaMedia.foto = []; NotaMedia.audio = null;
  const box = document.getElementById('nota-media');
  if (box) box.innerHTML = notaMediaHtml();
}

function notaMediaStop() {
  try { if (NotaMedia.rec && NotaMedia.rec.state !== 'inactive') NotaMedia.rec.stop(); } catch (e) {}
  try { NotaMedia.sr && NotaMedia.sr.stop(); } catch (e) {}
  NotaMedia.sr = null;
}

function notaMediaHasContent() { return NotaMedia.foto.length > 0 || !!NotaMedia.audio; }

// ---- Foto ----
async function notaMediaAddFoto(input) {
  const files = [...(input.files || [])];
  input.value = '';
  for (const f of files) {
    try { NotaMedia.foto.push(await notaCompressImage(f)); }
    catch (e) { alert('Foto non leggibile: ' + f.name); }
  }
  _nmRenderFoto();
}
function notaMediaDelFoto(i) { NotaMedia.foto.splice(i, 1); _nmRenderFoto(); }
function _nmRenderFoto() {
  const el = document.getElementById('nm-foto'); if (!el) return;
  el.innerHTML = NotaMedia.foto.map((b, i) => `
    <div style="position:relative;">
      <img src="${URL.createObjectURL(b)}" style="width:72px;height:72px;object-fit:cover;border-radius:8px;display:block;">
      <button type="button" onclick="notaMediaDelFoto(${i})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:none;background:#C0392B;color:#FFF;font-size:12px;line-height:20px;cursor:pointer;padding:0;">×</button>
    </div>`).join('');
}

// ---- Audio: registrazione dal microfono ----
async function notaMediaToggleRec() {
  const btn = document.getElementById('nm-rec-btn');
  if (NotaMedia.rec && NotaMedia.rec.state === 'recording') { NotaMedia.rec.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { alert('Registrazione audio non supportata da questo browser.'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find(t => MediaRecorder.isTypeSupported?.(t)) || '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    NotaMedia.rec = rec; NotaMedia.recChunks = []; NotaMedia.recStream = stream; NotaMedia.recStart = Date.now();
    rec.ondataavailable = e => { if (e.data.size) NotaMedia.recChunks.push(e.data); };
    rec.onstop = () => {
      clearInterval(NotaMedia.recTimer);
      stream.getTracks().forEach(t => t.stop());
      const type = (rec.mimeType || 'audio/webm').split(';')[0];
      const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      if (NotaMedia.recChunks.length) NotaMedia.audio = { blob: new Blob(NotaMedia.recChunks, { type }), type, ext, nome: 'registrazione' };
      if (btn) { btn.textContent = '🎙️ Registra'; btn.style.background = 'var(--bg2)'; btn.style.color = 'var(--text)'; }
      _nmRenderAudio();
    };
    rec.start(1000);
    if (btn) { btn.style.background = '#C0392B'; btn.style.color = '#FFF'; }
    const tick = () => { const s = Math.round((Date.now() - NotaMedia.recStart) / 1000); if (btn) btn.textContent = `⏹ Stop ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    tick(); NotaMedia.recTimer = setInterval(tick, 500);
  } catch (e) {
    alert('Microfono non disponibile: ' + e.message);
  }
}

// ---- Audio: file ricevuto (WhatsApp .opus/.ogg, .m4a, .mp3 …) ----
function notaMediaAddAudio(input) {
  const f = input.files?.[0]; input.value = '';
  if (!f) return;
  if (f.size > 25 * 1024 * 1024) { alert('Audio troppo grande (max 25 MB).'); return; }
  const ext = (f.name.split('.').pop() || 'audio').toLowerCase();
  const type = f.type || ({ opus: 'audio/ogg', ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg', aac: 'audio/aac', amr: 'audio/amr', wav: 'audio/wav' }[ext] || 'application/octet-stream');
  NotaMedia.audio = { blob: f, type, ext, nome: f.name.replace(/\.[^.]+$/, '') };
  _nmRenderAudio();
}
function notaMediaDelAudio() { NotaMedia.audio = null; _nmRenderAudio(); }
function _nmRenderAudio() {
  const el = document.getElementById('nm-audio'); if (!el) return;
  const a = NotaMedia.audio;
  if (!a) { el.innerHTML = ''; return; }
  const kb = Math.round(a.blob.size / 1024);
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;">
      <audio controls preload="metadata" src="${URL.createObjectURL(a.blob)}" style="flex:1;height:36px;min-width:0;"></audio>
      <button type="button" onclick="notaMediaDelAudio()" style="border:none;background:none;color:#C0392B;font-size:18px;cursor:pointer;">🗑</button>
    </div>
    <div style="font-size:10px;color:var(--text2);margin-top:2px;">${_nmEsc(a.nome)}.${a.ext} · ${kb} KB</div>`;
}

// ---- Dettatura → testo (Web Speech API, gratuita, it-IT) ----
function notaMediaToggleDettatura() {
  const btn = document.getElementById('nm-sr-btn');
  if (NotaMedia.sr) { NotaMedia.sr.stop(); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('Dettatura non supportata da questo browser.'); return; }
  const ta = document.getElementById('nota-testo');
  const sr = new SR();
  sr.lang = 'it-IT'; sr.continuous = true; sr.interimResults = true;
  const base = ta.value ? ta.value.replace(/\s*$/, ' ') : '';
  let finale = '';
  sr.onresult = ev => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const t = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) finale += t.trim() + ' '; else interim += t;
    }
    ta.value = base + finale + interim;
  };
  sr.onerror = ev => { if (ev.error !== 'no-speech' && ev.error !== 'aborted') alert('Dettatura: ' + ev.error); };
  sr.onend = () => {
    NotaMedia.sr = null;
    ta.value = (base + finale).trim();
    if (btn) { btn.textContent = '🗣️ Detta testo'; btn.style.background = 'var(--bg2)'; btn.style.color = 'var(--text)'; }
  };
  NotaMedia.sr = sr;
  sr.start();
  if (btn) { btn.textContent = '⏹ Stop dettatura'; btn.style.background = 'var(--accent)'; btn.style.color = '#FFF'; }
}

// ---- Upload su Storage + riga documenti ----
async function notaMediaUploadFile(blob, nomeFile, contentType) {
  const insDoc = await fetch(`${SUPABASE_URL}/rest/v1/documenti`, {
    method: 'POST', headers: SB_H,
    body: JSON.stringify({ nome_file: nomeFile, content_type: contentType, dimensione_kb: Math.round(blob.size / 1024 * 100) / 100 })
  });
  if (!insDoc.ok) throw new Error(await insDoc.text());
  const [doc] = await insDoc.json();
  const storagePath = `${doc.id}_${nomeFile}`;
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/documenti/${encodeURIComponent(storagePath)}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': contentType },
    body: blob
  });
  if (!up.ok) {
    await fetch(`${SUPABASE_URL}/rest/v1/documenti?id=eq.${doc.id}`, { method: 'DELETE', headers: SB_H });
    throw new Error(await up.text());
  }
  const upd = await fetch(`${SUPABASE_URL}/rest/v1/documenti?id=eq.${doc.id}`, {
    method: 'PATCH', headers: SB_H, body: JSON.stringify({ storage_path: storagePath })
  });
  if (!upd.ok) throw new Error(await upd.text());
  return doc.id;
}

async function notaMediaUpload() {
  notaMediaStop();
  const ts = Date.now();
  const foto_documento_ids = [];
  for (let i = 0; i < NotaMedia.foto.length; i++) {
    foto_documento_ids.push(await notaMediaUploadFile(NotaMedia.foto[i], `nota_${ts}_${i + 1}.jpg`, 'image/jpeg'));
  }
  let audio_documento_id = null;
  if (NotaMedia.audio) {
    const a = NotaMedia.audio;
    audio_documento_id = await notaMediaUploadFile(a.blob, `nota_audio_${ts}.${a.ext}`, a.type);
  }
  return { foto_documento_ids, audio_documento_id };
}

// ---- Visualizzazione nell'elenco note ----
// Carica (una volta) gli storage_path dei documenti delle note e li mette in cache,
// poi ridisegna chiamando onReady(). Serve per mostrare miniature e player inline.
const _nmDocCache = {};
async function notaMediaPreload(note, onReady) {
  const ids = new Set();
  (note || []).forEach(n => {
    if (n.foto_documento_id) ids.add(n.foto_documento_id);
    (n.foto_documento_ids || []).forEach(id => ids.add(id));
    if (n.audio_documento_id) ids.add(n.audio_documento_id);
  });
  const mancanti = [...ids].filter(id => !(id in _nmDocCache));
  if (!mancanti.length) return;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/documenti?id=in.(${mancanti.join(',')})&select=id,storage_path,content_type,nome_file`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const rows = await r.json();
    mancanti.forEach(id => { _nmDocCache[id] = null; });
    rows.forEach(d => { _nmDocCache[d.id] = d; });
    onReady && onReady();
  } catch (e) { /* mostra comunque i bottoni di fallback */ }
}

function notaMediaRender(n) {
  const fotoIds = [...new Set([...(n.foto_documento_id ? [n.foto_documento_id] : []), ...(n.foto_documento_ids || [])])];
  let html = '';
  if (fotoIds.length) {
    html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">` + fotoIds.map(id => {
      const d = _nmDocCache[id];
      return d?.storage_path
        ? `<img src="${notaMediaUrl(d.storage_path)}" onclick="apriDocumento(${id})" loading="lazy" style="width:72px;height:72px;object-fit:cover;border-radius:8px;cursor:pointer;border:0.5px solid var(--border);">`
        : `<button onclick="apriDocumento(${id})" style="background:var(--bg2);border:0.5px solid var(--border);border-radius:10px;padding:3px 10px;font-size:11px;color:var(--text2);cursor:pointer;font-family:var(--font);">📷 Foto</button>`;
    }).join('') + `</div>`;
  }
  if (n.audio_documento_id) {
    const d = _nmDocCache[n.audio_documento_id];
    html += d?.storage_path
      ? `<div style="margin-top:8px;display:flex;align-items:center;gap:6px;"><span style="font-size:14px;">🎙️</span><audio controls preload="none" src="${notaMediaUrl(d.storage_path)}" style="flex:1;height:36px;min-width:0;"></audio></div>`
      : `<button onclick="apriDocumento(${n.audio_documento_id})" style="margin-top:8px;background:var(--bg2);border:0.5px solid var(--border);border-radius:10px;padding:3px 10px;font-size:11px;color:var(--text2);cursor:pointer;font-family:var(--font);">🎙️ Nota vocale</button>`;
  }
  return html;
}
