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
