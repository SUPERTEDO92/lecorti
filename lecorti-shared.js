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
