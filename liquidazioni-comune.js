// ============================================
// LE CORTI — funzioni comuni a capo.html e liquidazioni.html
// Le due pagine mostrano le stesse liste (uscite da liquidare, trasferimenti,
// stampe, rubrica): la logica sta qui, una volta sola. capo.html aggiunge
// solo password e vista soccide; ognuna tiene i propri dati (allevamenti,
// filtri) e il proprio loadAll().
// Includere DOPO lecorti-shared.js e PRIMA dello <script> della pagina.
// ============================================

function render() {
  let rows = allUscite.filter(u => u.data_uscita);
  if(filtroMese !== 'tutti') rows = rows.filter(u => u.data_uscita?.startsWith(filtroMese));
  if(filtroSoccida !== 'tutte') rows = rows.filter(u => getSoccidaNome(u) === filtroSoccida);
  if(filtroDaFatturare) rows = rows.filter(u => !u.fattura_documento_id && u.data_uscita >= DA_FATTURARE_DA);
  rows = [...rows].sort((a,b) => b.data_uscita.localeCompare(a.data_uscita));

  // Summary
  const totCapi = rows.reduce((s,u) => s+(u.capi||0), 0);
  const totKg = rows.reduce((s,u) => s+(u.kg_totali||0), 0);
  const totLiq = rows.filter(u => u.liquidazione).reduce((s,u) => s+(u.liquidazione||0), 0);
  const groupKey = u => (u.numero_ddt ? u.numero_ddt.trim().toUpperCase() : 'NODDT-'+u.id) + '|' + u.data_uscita;
  const carichiUnici = new Set(rows.map(groupKey)).size;
  const gruppiDaLiquidare = new Set(rows.filter(u => !u.liquidazione).map(groupKey)).size;

  document.getElementById('summary').innerHTML = `
    <div class="sum-box"><div class="sum-label">carichi</div><div class="sum-val">${carichiUnici}</div></div>
    <div class="sum-box"><div class="sum-label">capi</div><div class="sum-val">${fmt(totCapi)}</div></div>
    <div class="sum-box"><div class="sum-label">kg</div><div class="sum-val">${fmt(totKg)}</div></div>
    <div class="sum-box"><div class="sum-label">liquidato</div><div class="sum-val green">${totLiq > 0 ? fmt(totLiq/1000,1)+'k' : '—'}</div></div>`;

  if(!rows.length) {
    document.getElementById('list').innerHTML = `<div class="empty">Nessuna uscita nel periodo selezionato.</div>`;
    return;
  }

  // Raggruppa per mese
  const byMonth = {};
  rows.forEach(u => {
    const m = u.data_uscita.substring(0,7);
    if(!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(u);
  });

  let html = '';
  Object.keys(byMonth).sort().reverse().forEach(m => {
    const [y,mo] = m.split('-');
    const totMeseLiq = byMonth[m].filter(u => u.liquidazione).reduce((s,u) => s+(u.liquidazione||0), 0);
    html += `<div class="month-sep"><span class="month-sep-text">${nomiMese[parseInt(mo)]} ${y}${totMeseLiq > 0 ? ' · ' + fmt(totMeseLiq) + ' €' : ''}</span></div>`;

    const _grouped = {};
    const _order = [];
    byMonth[m].forEach(u => {
      const key = groupKey(u);
      if(!_grouped[key]) { _grouped[key] = []; _order.push(key); }
      _grouped[key].push(u);
    });

    html += _order.map(key => {
      const righe = _grouped[key];
      const multi = righe.length > 1;
      const u = righe[0];

      const lotto = allLotti.find(l => l.id === u.lotto_id);
      const soc = allSoccide.find(s => s.id === lotto?.soccida_id);
      const socNome = soc?.nome || '—';
      const lottiTxt = righe.map(r => (allLotti.find(l => l.id === r.lotto_id)?.codice) || '—').join(' + ');

      const totCapiG = righe.reduce((s,r) => s+(r.capi||0), 0);
      const totKgG = righe.reduce((s,r) => s+(parseFloat(r.kg_totali)||0), 0);
      const totLiqG = righe.reduce((s,r) => s+(r.liquidazione||0), 0);
      const totLordoG = righe.reduce((s,r) => s+(r.liquidazione_lorda||0), 0);
      const totScontiG = righe.reduce((s,r) => s+(r.sconto_peso||0)+(r.sconto_merce||0), 0);
      const media = totCapiG && totKgG ? (totKgG / totCapiG).toFixed(1) : '—';
      const prezzoMedio = totKgG ? righe.reduce((s,r) => s+((r.prezzo_kg||0)*(parseFloat(r.kg_totali)||0)),0)/totKgG : null;
      const tuttiLiquidati = righe.every(r => r.liquidazione);
      const qualcunoLiquidato = righe.some(r => r.liquidazione);

      let dettaglioLiq = '';
      if(tuttiLiquidati) {
        dettaglioLiq = `<div class="liq-netto">
          <div>
            <div class="liq-netto-label">Liquidazione netta</div>
            ${totScontiG > 0 ? `<div style="font-size:10px;color:var(--green);margin-top:1px;">Lordo ${fmt(totLordoG)} € · Sconti ${fmt(totScontiG)} €</div>` : ''}
          </div>
          <div class="liq-netto-val">${fmt(totLiqG)} €</div>
        </div>`;
      } else if(qualcunoLiquidato) {
        dettaglioLiq = `<div class="liq-netto">
          <div class="liq-netto-label" style="color:var(--amber);">⏳ Parzialmente liquidato</div>
          <div class="liq-netto-val">${fmt(totLiqG)} €</div>
        </div>`;
      } else {
        dettaglioLiq = `<div class="liq-pending">⏳ Liquidazione non ancora ricevuta</div>`;
      }

      const valoreCapo = (totLiqG && totCapiG) ? totLiqG / totCapiG : null;
      const noteRighe = righe.map(r => r.note).filter(Boolean);

      let out = `<div class="liq-row">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><strong style="color:var(--text);font-size:16px;font-family:var(--mono);">${fmtDate(u.data_uscita)}</strong>${u.numero_ddt ? `<span style="font-size:20px;font-family:var(--mono);font-weight:600;color:var(--text);">Bolla n. ${u.numero_ddt}</span>` : ''}</div>
        ${(u.ddt_documento_id || u.liquidazione_documento_id || u.fattura_documento_id) ? `<div style="display:flex;gap:6px;margin-bottom:8px;">
          ${u.ddt_documento_id ? `<button onclick="apriDocumento(${u.ddt_documento_id})" style="flex:1;background:var(--bg2);border:0.5px solid var(--border);border-radius:var(--radius);padding:6px 10px;font-size:12px;font-weight:600;color:var(--text2);cursor:pointer;font-family:var(--font);">📄 DDT</button>` : ''}
          ${u.liquidazione_documento_id ? `<button onclick="transizioneBanconota(this, () => apriDocumento(${u.liquidazione_documento_id}))" style="flex:1;background:var(--green-bg,#EBF5EF);border:0.5px solid #B8DECA;border-radius:var(--radius);padding:6px 10px;font-size:12px;font-weight:600;color:var(--green,#2A7A4B);cursor:pointer;font-family:var(--font);">📄 Liquidazione</button>` : ''}
          ${u.fattura_documento_id ? `<button onclick="apriDocumento(${u.fattura_documento_id})" style="flex:1;background:#FDF3E7;border:0.5px solid #EAD2A8;border-radius:var(--radius);padding:6px 10px;font-size:12px;font-weight:600;color:var(--accent,#C17B2A);cursor:pointer;font-family:var(--font);">📄 Fattura</button>` : ''}
        </div>` : ''}
        <div class="liq-top">
          <div>
            <div class="liq-soccida">${socNome}</div>

          </div>
          <div class="liq-macello">MACELLO: ${u.macello || '—'}</div>
        </div>
        <div style="background:${u.cessionario ? '#FDF3E0' : '#F5F3EE'};border:0.5px solid ${u.cessionario ? '#F0C870' : 'var(--border)'};border-radius:var(--radius);padding:6px 10px;margin-bottom:8px;font-size:14px;font-weight:600;color:${u.cessionario ? '#9A6010' : 'var(--text3)'};display:flex;align-items:center;gap:6px;">📄 Fatturare a: ${u.cessionario || u.macello || '—'}</div>
        <div class="liq-grid">
          <div class="lg"><div class="lg-label">Capi</div><div class="lg-val">${fmt(totCapiG)}</div></div>
          <div class="lg"><div class="lg-label">Kg tot.</div><div class="lg-val">${fmt(totKgG)}</div></div>
          <div class="lg"><div class="lg-label">Media kg</div><div class="lg-val">${media}</div></div>
          <div class="lg"><div class="lg-label">€/kg</div><div class="lg-val">${prezzoMedio ? prezzoMedio.toFixed(3) : '—'}</div></div>
        </div>
        ${valoreCapo ? `<div style="text-align:right;margin-top:4px;font-size:13px;font-family:var(--mono);color:var(--green);font-weight:500;">valore/capo: ${fmt(valoreCapo,0)} €</div>` : ''}

        ${dettaglioLiq}
        `;
        // Nota: box informativo (trasportatore/destinatario/logistica) nascosto di default dal 04/08/2026.
        // Il testo resta salvato in uscite.note — va mostrato solo su richiesta esplicita di Ruben per una riga specifica.

      if(multi) {
        out += `<div style="margin-top:8px;padding-top:8px;border-top:0.5px dashed var(--border);">
          <div style="font-size:10px;font-family:'Courier New',monospace;text-transform:uppercase;color:var(--text3);margin-bottom:4px;">Carico diviso su ${righe.length} lotti</div>
          ${righe.map(r => {
            const lo = allLotti.find(l => l.id === r.lotto_id);
            return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;">
              <span>${lo ? lo.codice : '—'} · ${fmt(r.capi)} capi · ${fmt(r.kg_totali)} kg</span>
              <span style="${r.liquidazione ? 'color:var(--green);font-weight:500;' : 'color:var(--amber);'}">${r.liquidazione ? fmt(r.liquidazione)+' €' : 'in attesa'}</span>
            </div>`;
          }).join('')}
        </div>`;
      }

      out += `</div>`;
      return out;
    }).join('');
  });

  document.getElementById('list').innerHTML = `<div>${html}</div>`;
}

function stampaTrasferimenti() {
  const nomiMeseFull = ['','Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

  let lista = [...allTrasferimenti]
    .filter(t => t.data_trasferimento)
    .filter(t => {
      if(t.tipo !== 'ACQUISTO') return true;
      const speculare = allTrasferimenti.find(x =>
        x.tipo === 'TRASFERIMENTO' &&
        x.data_trasferimento === t.data_trasferimento &&
        x.soccida_partenza === t.soccida_partenza &&
        x.soccida_destinazione === t.soccida_destinazione &&
        x.capi === t.capi
      );
      return !speculare;
    });
  if(filtroMeseTrasf !== 'tutti') lista = lista.filter(t => t.data_trasferimento.startsWith(filtroMeseTrasf));
  if(filtroTipoTrasf !== 'tutti') lista = lista.filter(t => t.tipo === filtroTipoTrasf);
  lista.sort((a,b) => b.data_trasferimento.localeCompare(a.data_trasferimento));

  const byMonth = {};
  lista.forEach(t => {
    const m = t.data_trasferimento.substring(0,7);
    if(!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(t);
  });

  const totCapiGen = lista.reduce((s,t) => s+(t.capi||0), 0);
  const totKgGen = lista.reduce((s,t) => s+(t.kg||0), 0);
  const totVenditeGen = lista.filter(t => t.tipo === 'VENDITA').length;

  const periodoLabel = filtroMeseTrasf === 'tutti' ? 'Tutti i periodi' : (() => {
    const [y,mo] = filtroMeseTrasf.split('-');
    return nomiMeseFull[parseInt(mo)] + ' ' + y;
  })();

  let html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
  <title>Le Corti — Trasferimenti</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Arial, sans-serif; font-size: 13px; color: #1A1A18; background: #FFF; padding: 20px 24px; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
    .sub { font-size: 13px; color: #666; margin-bottom: 20px; }
    .riepilogo { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 24px; padding: 12px; background: #F5F3EE; border-radius: 8px; }
    .rie-box { text-align: center; }
    .rie-label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #888; }
    .rie-val { font-size: 19px; font-weight: 600; margin-top: 2px; }
    .month-title { font-size: 15px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #555; border-bottom: 1.5px solid #1A1A18; padding-bottom: 4px; margin: 20px 0 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: #888; text-align: left; padding: 6px 8px; border-bottom: 0.5px solid #D8D4CB; }
    td { padding: 7px 8px; border-bottom: 0.5px solid #EDEAE3; vertical-align: top; font-size: 13px; }
    td.num { text-align: right; font-family: 'Courier New', monospace; }
    td.green { color: #2A7A4B; font-weight: 500; }
    .badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 8px; }
    .badge-acq { background:#EBF5EF; color:#2A7A4B; }
    .badge-vend { background:#FBEFEE; color:#A0453A; }
    .badge-trasf { background:#EEF2FB; color:#3A5AA0; }
    .footer { margin-top: 20px; font-size: 10px; color: #AAA; text-align: right; }
    @media print {
      body { padding: 10px 14px; }
      .month-title { margin: 14px 0 8px; }
      @page { margin: 1.5cm; }
    }
  </style></head><body>
  <h1>Soc. Agr. Le Corti Srl — Riepilogo Trasferimenti</h1>
  <div class="sub">Stampato il ${new Date().toLocaleDateString('it-IT', {day:'2-digit',month:'2-digit',year:'numeric'})} · ${periodoLabel}</div>
  <div class="riepilogo">
    <div class="rie-box"><div class="rie-label">Movimenti</div><div class="rie-val">${lista.length}</div></div>
    <div class="rie-box"><div class="rie-label">Capi totali</div><div class="rie-val">${totCapiGen.toLocaleString('it-IT')}</div></div>
    <div class="rie-box"><div class="rie-label">Kg totali</div><div class="rie-val">${totKgGen.toLocaleString('it-IT')}</div></div>
    <div class="rie-box"><div class="rie-label">Vendite</div><div class="rie-val">${totVenditeGen}</div></div>
  </div>`;

  Object.keys(byMonth).sort().reverse().forEach(m => {
    const [y,mo] = m.split('-');
    const mRighe = byMonth[m];

    html += `<div class="month-title">${nomiMeseFull[parseInt(mo)]} ${y}</div>
    <table>
      <thead><tr>
        <th>Data</th><th>Da</th><th>A</th><th>Tipo</th>
        <th style="text-align:right">Capi</th><th style="text-align:right">Kg</th>
        <th style="text-align:right">Acquisto €</th><th style="text-align:right">Vendita €</th>
      </tr></thead><tbody>`;

    mRighe.forEach(t => {
      const [yy,mm,gg] = t.data_trasferimento.split('-');
      const badgeClass = t.tipo === 'ACQUISTO' ? 'badge-acq' : t.tipo === 'VENDITA' ? 'badge-vend' : 'badge-trasf';

      html += `<tr>
        <td><strong>${gg}/${mm}/${yy}</strong></td>
        <td>${t.soccida_partenza || '—'}</td>
        <td>${t.soccida_destinazione || '—'}</td>
        <td><span class="badge ${badgeClass}">${t.tipo || '—'}</span></td>
        <td class="num">${(t.capi||0).toLocaleString('it-IT')}</td>
        <td class="num">${t.kg ? Number(t.kg).toLocaleString('it-IT') : '—'}</td>
        <td class="num">${t.costo_acquisto ? Number(t.costo_acquisto).toLocaleString('it-IT',{minimumFractionDigits:2})+' €' : '—'}</td>
        <td class="num green">${t.valore ? Number(t.valore).toLocaleString('it-IT',{minimumFractionDigits:2})+' €' : '—'}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
  });

  html += `<div class="footer">Soc. Agr. Le Corti Srl · stampato il ${new Date().toLocaleDateString('it-IT')}</div>
  </body></html>`;

  const w = window.open('','_blank');
  w.document.write(html);
  w.document.close();
  w.print();
}

function rubRender(lista) {
  const el = document.getElementById('rub-lista');
  if(!el) return;
  window._rubListaAttuale = lista;
  if(lista.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);font-family:var(--mono);font-size:12px;">Nessun risultato</div>';
    return;
  }
  el.innerHTML = lista.map((a, i) => {
    return `<div style="background:#FFF;border:0.5px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:10px;">
      ${a.tag === 'lecorti' ? '<span style="display:inline-block;font-size:10px;font-family:var(--mono);padding:2px 7px;border-radius:10px;background:var(--green-bg);color:var(--green);margin-bottom:6px;">LE CORTI</span>' : ''}
      ${a.tag === 'cessionario' ? `<span style="display:inline-block;font-size:10px;font-family:var(--mono);padding:2px 7px;border-radius:10px;background:#FEF3E0;color:#997700;margin-bottom:6px;">${a.ruolo ? a.ruolo.toUpperCase() : 'CESSIONARIO'}</span>` : ''}
      <div style="font-size:15px;font-weight:600;line-height:1.3;">${a.nome}</div>
      <div style="font-size:12px;color:var(--text2);margin-top:2px;margin-bottom:10px;line-height:1.4;">${a.indirizzo}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
        ${a.cod_asl ? `<div style="display:flex;align-items:center;gap:6px;background:var(--bg2);border-radius:20px;padding:4px 10px;font-size:11px;"><span style="color:var(--text3);">ASL</span><span style="font-family:var(--mono);font-weight:500;">${a.cod_asl}</span></div>` : ''}
        ${a.cod_parma && a.cod_parma !== '—' ? `<div style="display:flex;align-items:center;gap:6px;background:var(--bg2);border-radius:20px;padding:4px 10px;font-size:11px;"><span style="color:var(--text3);">Parma DOP</span><span style="font-family:var(--mono);font-weight:500;">${a.cod_parma}</span></div>` : ''}
        ${a.piva ? `<div style="display:flex;align-items:center;gap:6px;background:var(--bg2);border-radius:20px;padding:4px 10px;font-size:11px;"><span style="color:var(--text3);">P.IVA</span><span style="font-family:var(--mono);font-weight:500;">${a.piva}</span></div>` : ''}
        ${a.cod_sdi ? `<div style="display:flex;align-items:center;gap:6px;background:var(--bg2);border-radius:20px;padding:4px 10px;font-size:11px;"><span style="color:var(--text3);">SDI</span><span style="font-family:var(--mono);font-weight:500;">${a.cod_sdi}</span></div>` : ''}
      </div>
      <button data-label="📋 Copia anagrafica completa" onclick="rubCopia(rubTestoCompleto(_rubListaAttuale[${i}]), this)" style="width:100%;padding:8px;background:var(--bg2);color:var(--text2);border:0.5px solid var(--border);border-radius:8px;font-size:12px;font-family:var(--font);cursor:pointer;">📋 Copia anagrafica completa</button>
    </div>`;
  }).join('');
}

function buildSoccidaSelect() {
  const nomi = [...new Set(allSoccide.map(s => s.nome).filter(Boolean))].sort();
  const sel = document.getElementById('sel-soccida');
  sel.innerHTML = `<option value="tutte">Tutte le soccide</option>` +
    nomi.map(n => `<option value="${n}">${n}</option>`).join('');
  sel.value = filtroSoccida;
}

function setFiltroSoccida(val) {
  filtroSoccida = val;
  render();
}

function toggleDaFatturare() {
  filtroDaFatturare = !filtroDaFatturare;
  document.getElementById('toggle-fatt').classList.toggle('active', filtroDaFatturare);
  render();
}

function buildChips() {
  const mesi = [...new Set(allUscite.map(u => u.data_uscita?.substring(0,7)).filter(Boolean))].sort().reverse();
  let html = `<div class="chip active" onclick="setFiltro('tutti',this)">Tutti</div>`;
  html += mesi.map(m => {
    const [y,mo] = m.split('-');
    return `<div class="chip" onclick="setFiltro('${m}',this)">${nomiMeseBrevi[parseInt(mo)]} ${y}</div>`;
  }).join('');
  document.getElementById('chips').innerHTML = html;
}

function setFiltro(val, el) {
  filtroMese = val;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  render();
}

function getSoccidaNome(u) {
  if (u.soccida_nome) return u.soccida_nome;
  const lotto = allLotti.find(l => l.id === u.lotto_id);
  const soc = allSoccide.find(s => s.id === lotto?.soccida_id);
  return soc?.nome || null;
}

// ── TRASFERIMENTI (sola lettura, per Ilaria) ──
function buildChipsTrasf() {
  const mesi = [...new Set(allTrasferimenti.map(t => t.data_trasferimento?.substring(0,7)).filter(Boolean))].sort().reverse();
  let html = `<div class="chip active" onclick="setFiltroTrasf('tutti',this)">Tutti</div>`;
  html += mesi.map(m => {
    const [y,mo] = m.split('-');
    return `<div class="chip" onclick="setFiltroTrasf('${m}',this)">${nomiMeseBrevi[parseInt(mo)]} ${y}</div>`;
  }).join('');
  document.getElementById('chips-trasf').innerHTML = html;
}

function buildChipsTrasfTipo() {
  const opts = [
    ['tutti', 'Tutti'],
    ['TRASFERIMENTO', 'Trasferimenti'],
    ['ACQUISTO', 'Acquisti'],
    ['VENDITA', 'Vendite']
  ];
  document.getElementById('chips-trasf-tipo').innerHTML = opts.map(([val, label]) =>
    `<div class="chip${filtroTipoTrasf === val ? ' active' : ''}" onclick="setFiltroTrasfTipo('${val}',this)">${label}</div>`
  ).join('');
}

function setFiltroTrasfTipo(val, el) {
  filtroTipoTrasf = val;
  document.querySelectorAll('#chips-trasf-tipo .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderTrasf();
}

function setFiltroTrasf(val, el) {
  filtroMeseTrasf = val;
  document.querySelectorAll('#chips-trasf .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderTrasf();
}

function renderTrasf() {
  if(!allTrasferimenti.length) {
    document.getElementById('list-trasf').innerHTML = `<div class="empty">Nessun movimento registrato.</div>`;
    document.getElementById('summary-trasf').innerHTML = '';
    return;
  }

  // Nasconde ACQUISTO che hanno già un TRASFERIMENTO speculare (movimenti interni)
  let lista = [...allTrasferimenti]
    .filter(t => t.data_trasferimento)
    .filter(t => {
      if(t.tipo !== 'ACQUISTO') return true;
      const speculare = allTrasferimenti.find(x =>
        x.tipo === 'TRASFERIMENTO' &&
        x.data_trasferimento === t.data_trasferimento &&
        x.soccida_partenza === t.soccida_partenza &&
        x.soccida_destinazione === t.soccida_destinazione &&
        x.capi === t.capi
      );
      return !speculare;
    })
    .sort((a,b) => b.data_trasferimento.localeCompare(a.data_trasferimento));
  if(filtroMeseTrasf !== 'tutti') lista = lista.filter(t => t.data_trasferimento.startsWith(filtroMeseTrasf));
  if(filtroTipoTrasf !== 'tutti') lista = lista.filter(t => t.tipo === filtroTipoTrasf);

  const totCapi = lista.reduce((s,t) => s+(t.capi||0), 0);
  const totKg = lista.reduce((s,t) => s+(t.kg||0), 0);
  const totVendite = lista.filter(t => t.tipo === 'VENDITA').length;
  document.getElementById('summary-trasf').innerHTML = `
    <div class="sum-box"><div class="sum-label">movimenti</div><div class="sum-val">${lista.length}</div></div>
    <div class="sum-box"><div class="sum-label">capi</div><div class="sum-val">${fmt(totCapi)}</div></div>
    <div class="sum-box"><div class="sum-label">kg</div><div class="sum-val">${fmt(totKg)}</div></div>
    <div class="sum-box"><div class="sum-label">vendite</div><div class="sum-val">${totVendite}</div></div>`;

  if(!lista.length) {
    document.getElementById('list-trasf').innerHTML = `<div class="empty">Nessun movimento nel periodo selezionato.</div>`;
    return;
  }

  const byMonth = {};
  lista.forEach(t => {
    const m = t.data_trasferimento.substring(0,7);
    if(!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(t);
  });

  let html = '';
  Object.keys(byMonth).sort().reverse().forEach(m => {
    const [y,mo] = m.split('-');
    html += `<div class="month-sep"><span class="month-sep-text">${nomiMese[parseInt(mo)]} ${y}</span></div>`;

    html += byMonth[m].map(t => {
      const isAcq = t.tipo === 'ACQUISTO';
      const isVend = t.tipo === 'VENDITA';
      const lotto = allLotti.find(l => l.id === t.lotto_id);
      const badgeStyle = isAcq
        ? 'background:#EBF5EF;color:#2A7A4B;border:0.5px solid #B8DECA;'
        : isVend
        ? 'background:#FBEFEE;color:#A0453A;border:0.5px solid #F0C0C0;'
        : 'background:#EEF2FB;color:#3A5AA0;border:0.5px solid #C0CFF0;';
      const margine = (isVend && t.valore != null && t.costo_acquisto != null) ? (t.valore - t.costo_acquisto) : null;
      const acquistiStessoLotto = isAcq ? allTrasferimenti.filter(x => x.tipo === 'ACQUISTO' && x.lotto_id === t.lotto_id) : [];
      const ingT = (allIngressi||[]).filter(i => i.lotto_id === t.lotto_id && (acquistiStessoLotto.length <= 1 || i.data_ingresso === t.data_trasferimento)).sort((a,b) => a.data_ingresso.localeCompare(b.data_ingresso));
      const multiArrivo = isAcq && ingT.length >= 1;

      return `<div class="trasf-row">
        <div style="font-size:14px;font-weight:600;font-family:var(--mono);margin-bottom:4px;">${fmtDate(t.data_trasferimento)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div class="trasf-route">${t.soccida_partenza || '—'} <span class="arrow">→</span> ${t.soccida_destinazione || '—'}</div>
          <span class="trasf-badge" style="${badgeStyle}">${t.tipo || 'TRASF.'}</span>
        </div>
        ${(t.ddt_documento_id || t.calcolo_documento_id || t.calcolo_vendita_documento_id || t.fattura_documento_id || t.fattura_vendita_documento_id) ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
          ${t.ddt_documento_id ? `<button onclick="apriDocumento(${t.ddt_documento_id})" style="background:#FFF;border:0.5px solid var(--border);border-radius:10px;padding:3px 9px;font-size:11px;color:var(--text2);cursor:pointer;font-family:var(--font);">📄 DDT</button>` : ''}
          ${t.calcolo_documento_id ? `<button onclick="apriDocumento(${t.calcolo_documento_id})" style="background:#FDF3E7;border:0.5px solid #EAD2A8;border-radius:10px;padding:3px 9px;font-size:11px;color:var(--accent,#C17B2A);font-weight:600;cursor:pointer;font-family:var(--font);">📄 ${t.calcolo_vendita_documento_id ? 'Conteggio acquisto' : 'Conteggio'}</button>` : ''}
          ${t.calcolo_vendita_documento_id ? `<button onclick="apriDocumento(${t.calcolo_vendita_documento_id})" style="background:#FDF3E7;border:0.5px solid #EAD2A8;border-radius:10px;padding:3px 9px;font-size:11px;color:var(--accent,#C17B2A);font-weight:600;cursor:pointer;font-family:var(--font);">📄 Conteggio vendita</button>` : ''}
          ${t.fattura_documento_id ? `<button onclick="apriDocumento(${t.fattura_documento_id})" style="background:#FDF3E7;border:0.5px solid #EAD2A8;border-radius:10px;padding:3px 9px;font-size:11px;color:var(--accent,#C17B2A);font-weight:600;cursor:pointer;font-family:var(--font);">📄 ${t.fattura_vendita_documento_id ? 'Fattura acquisto' : 'Fattura'}</button>` : ''}
          ${t.fattura_vendita_documento_id ? `<button onclick="apriDocumento(${t.fattura_vendita_documento_id})" style="background:#FDF3E7;border:0.5px solid #EAD2A8;border-radius:10px;padding:3px 9px;font-size:11px;color:var(--accent,#C17B2A);font-weight:600;cursor:pointer;font-family:var(--font);">📄 Fattura vendita</button>` : ''}
        </div>` : ''}
        ${multiArrivo ? `<div style="font-size:10.5px;color:var(--text2);font-family:var(--mono);margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:var(--bg2);border-radius:8px;padding:6px 8px;">
          ${ingT.map(i => `<span>${i.numero_ddt ? 'DDT '+i.numero_ddt+' ' : ''}(${fmtDate(i.data_ingresso)}, ${fmt(i.capi)} capi)${i.ddt_documento_id ? ` <button onclick="apriDocumento(${i.ddt_documento_id})" style="background:#FFF;border:0.5px solid var(--border);border-radius:8px;padding:0px 6px;font-size:9px;color:var(--text2);cursor:pointer;font-family:var(--font);">📄</button>` : ''}</span>`).join(' + ')}
        </div>` : ''}
        <div style="font-size:12px;color:var(--text2);font-family:var(--mono);margin-bottom:8px;">Lotto ${lotto?.codice || '—'}${t.lettera_dop ? ' · ' + t.lettera_dop : ''}</div>
        <div class="trasf-grid">
          <div class="tg"><div class="tg-label">Capi</div><div class="tg-val">${fmt(t.capi)}</div></div>
          <div class="tg"><div class="tg-label">Kg</div><div class="tg-val">${t.kg ? fmt(t.kg) : '—'}</div></div>
          <div class="tg"><div class="tg-label">Media</div><div class="tg-val">${t.kg && t.capi ? fmt(t.kg/t.capi,1) : '—'}</div></div>
          <div class="tg"><div class="tg-label">${isVend ? 'Margine' : 'Valore'}</div><div class="tg-val ${(isVend ? margine : t.costo_acquisto) ? 'green' : ''}">${
            isVend
              ? (margine != null ? fmt(margine) + ' €' : '—')
              : (t.costo_acquisto ? fmt(t.costo_acquisto) + ' €' : '—')
          }</div></div>
        </div>
        ${isVend ? `<div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:0.5px dashed var(--border);font-size:12px;font-family:var(--mono);">
          <span style="color:var(--text2);">ingresso: ${t.costo_acquisto ? fmt(t.costo_acquisto) + ' €' : '—'}</span>
          <span style="color:var(--green);">uscita: ${t.valore ? fmt(t.valore) + ' €' : '—'}</span>
        </div>` : ''}
      </div>`;
    }).join('');
  });

  document.getElementById('list-trasf').innerHTML = html;
}

function stampaTutto() {
  const nomiMeseFull = ['','Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

  // Rispetta il filtro mese attivo
  let rows = [...allUscite].filter(u => u.data_uscita);
  if(filtroMese !== 'tutti') rows = rows.filter(u => u.data_uscita?.startsWith(filtroMese));
  rows = rows.sort((a,b) => b.data_uscita.localeCompare(a.data_uscita));

  const byMonth = {};
  rows.forEach(u => {
    const m = u.data_uscita.substring(0,7);
    if(!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(u);
  });

  const totGenerale = rows.filter(u => u.liquidazione).reduce((s,u) => s+(u.liquidazione||0), 0);
  const totCarichiGen = rows.length;
  const totCapiGen = rows.reduce((s,u) => s+(u.capi||0), 0);
  const totKgGen = rows.reduce((s,u) => s+(u.kg_totali||0), 0);

  const periodoLabel = filtroMese === 'tutti' ? 'Tutti i periodi' : (() => {
    const [y,mo] = filtroMese.split('-');
    return nomiMeseFull[parseInt(mo)] + ' ' + y;
  })();

  let html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
  <title>Le Corti — Liquidazioni</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Arial, sans-serif; font-size: 11px; color: #1A1A18; background: #FFF; padding: 20px 24px; }
    h1 { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
    .sub { font-size: 11px; color: #666; margin-bottom: 20px; }
    .riepilogo { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 24px; padding: 12px; background: #F5F3EE; border-radius: 8px; }
    .rie-box { text-align: center; }
    .rie-label { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: #888; }
    .rie-val { font-size: 16px; font-weight: 600; margin-top: 2px; }
    .rie-val.green { color: #2A7A4B; }
    .month-title { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #555; border-bottom: 1.5px solid #1A1A18; padding-bottom: 4px; margin: 20px 0 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { font-size: 9px; text-transform: uppercase; letter-spacing: .07em; color: #888; text-align: left; padding: 4px 8px; border-bottom: 0.5px solid #D8D4CB; }
    td { padding: 5px 8px; border-bottom: 0.5px solid #EDEAE3; vertical-align: top; }
    td.num { text-align: right; font-family: 'Courier New', monospace; }
    td.green { color: #2A7A4B; font-weight: 500; }
    td.pending { color: #997700; font-style: italic; }
    .month-tot { display: flex; justify-content: space-between; padding: 6px 8px; background: #F5F3EE; border-radius: 4px; margin-top: 4px; font-size: 11px; }
    .month-tot-label { color: #555; }
    .month-tot-val { font-weight: 600; color: #2A7A4B; font-family: 'Courier New', monospace; }
    .totale-finale { margin-top: 28px; padding: 14px 16px; background: #1A1A18; color: #FFF; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
    .tf-label { font-size: 12px; color: #AAA; }
    .tf-val { font-size: 22px; font-weight: 600; font-family: 'Courier New', monospace; }
    .footer { margin-top: 20px; font-size: 9px; color: #AAA; text-align: right; }
    @media print {
      body { padding: 10px 14px; font-size: 10px; }
      .month-title { margin: 14px 0 8px; }
      @page { margin: 1.5cm; }
    }
  </style></head><body>
  <h1>Soc. Agr. Le Corti Srl — Riepilogo Liquidazioni</h1>
  <div class="sub">Stampato il ${new Date().toLocaleDateString('it-IT', {day:'2-digit',month:'2-digit',year:'numeric'})} · ${periodoLabel}</div>
  <div class="riepilogo">
    <div class="rie-box"><div class="rie-label">Carichi</div><div class="rie-val">${totCarichiGen}</div></div>
    <div class="rie-box"><div class="rie-label">Capi totali</div><div class="rie-val">${totCapiGen.toLocaleString('it-IT')}</div></div>
    <div class="rie-box"><div class="rie-label">Kg totali</div><div class="rie-val">${totKgGen.toLocaleString('it-IT')}</div></div>
    <div class="rie-box"><div class="rie-label">Liquidato</div><div class="rie-val green">${totGenerale.toLocaleString('it-IT',{minimumFractionDigits:0})} €</div></div>
  </div>`;

  Object.keys(byMonth).sort().reverse().forEach(m => {
    const [y,mo] = m.split('-');
    const mRighe = byMonth[m];
    const mLiq = mRighe.filter(u => u.liquidazione).reduce((s,u) => s+(u.liquidazione||0), 0);
    const mCapi = mRighe.reduce((s,u) => s+(u.capi||0), 0);
    const mKg = mRighe.reduce((s,u) => s+(u.kg_totali||0), 0);

    html += `<div class="month-title">${nomiMeseFull[parseInt(mo)]} ${y}</div>
    <table>
      <thead><tr>
        <th>Data</th><th>Bolla</th><th>Soccida</th><th>Macello</th><th>Cessionario</th>
        <th style="text-align:right">Capi</th><th style="text-align:right">Kg tot.</th>
        <th style="text-align:right">€/kg</th>
        <th style="text-align:right">Liquidazione €</th>
      </tr></thead><tbody>`;

    const groupKeyStampa = u => (u.numero_ddt ? u.numero_ddt.trim().toUpperCase() : 'NODDT-'+u.id) + '|' + u.data_uscita;
    const _groupedStampa = {};
    const _orderStampa = [];
    mRighe.forEach(u => {
      const key = groupKeyStampa(u);
      if(!_groupedStampa[key]) { _groupedStampa[key] = []; _orderStampa.push(key); }
      _groupedStampa[key].push(u);
    });

    _orderStampa.forEach(key => {
      const righeGruppo = _groupedStampa[key];
      const u = righeGruppo[0];
      const lotto = allLotti.find(l => l.id === u.lotto_id);
      const soc = allSoccide.find(s => s.id === lotto?.soccida_id);
      const [yy,mm,gg] = u.data_uscita.split('-');

      const capiTot = righeGruppo.reduce((s,r) => s+(r.capi||0), 0);
      const kgTot = righeGruppo.reduce((s,r) => s+(r.kg_totali||0), 0);
      const liqTot = righeGruppo.reduce((s,r) => s+(r.liquidazione||0), 0);
      const tuttiLiquidati = righeGruppo.every(r => r.liquidazione);
      const prezzoMedio = kgTot ? righeGruppo.reduce((s,r) => s+((r.prezzo_kg||0)*(r.kg_totali||0)),0)/kgTot : null;

      html += `<tr>
        <td><strong>${gg}/${mm}/${yy}</strong></td>
        <td style="font-family:'Courier New',monospace">${u.numero_ddt || '—'}</td>
        <td>${soc?.nome || '—'}</td>
        <td>${u.macello || '—'}</td>
        <td>${u.cessionario || '—'}</td>
        <td class="num">${capiTot.toLocaleString('it-IT')}</td>
        <td class="num">${kgTot.toLocaleString('it-IT')}</td>
        <td class="num">${prezzoMedio ? prezzoMedio.toFixed(3) : '—'}</td>
        <td class="num ${tuttiLiquidati ? 'green' : 'pending'}">${tuttiLiquidati ? liqTot.toLocaleString('it-IT',{minimumFractionDigits:2})+' €' : '⏳ in attesa'}</td>
      </tr>`;
    });

    html += `</tbody></table>
    <div class="month-tot">
      <span class="month-tot-label">${nomiMeseFull[parseInt(mo)]} ${y} — ${_orderStampa.length} carichi · ${mCapi.toLocaleString('it-IT')} capi · ${mKg.toLocaleString('it-IT')} kg</span>
      <span class="month-tot-val">${mLiq > 0 ? mLiq.toLocaleString('it-IT',{minimumFractionDigits:2})+' €' : '—'}</span>
    </div>`;
  });

  html += `<div class="totale-finale">
    <div><div class="tf-label">Totale liquidato — ${periodoLabel}</div></div>
    <div class="tf-val">${totGenerale.toLocaleString('it-IT',{minimumFractionDigits:2})} €</div>
  </div>
  <div class="footer">Soc. Agr. Le Corti Srl · stampato il ${new Date().toLocaleDateString('it-IT')}</div>
  </body></html>`;

  const w = window.open('','_blank');
  w.document.write(html);
  w.document.close();
  w.print();
}

function stampaAttiva() {
  if(paginaAttiva === 'rubrica') return;
  if(paginaAttiva === 'trasf') stampaTrasferimenti();
  else stampaTutto();
}
