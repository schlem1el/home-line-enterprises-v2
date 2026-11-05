// src/utils/format.js
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const peso = (n) => '₱' + round2(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* PDF-safe money formatter. jsPDF's built-in Helvetica font does not
   include the ₱ glyph, so the standard peso() output renders as ± in
   every PDF. This version uses "PHP" instead, which the built-in font
   supports. Use it only in PDF generation. */
export const pesoPdf = (n) =>
  'PHP ' + round2(n).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const pad2 = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const isoTime = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
export const fmtQty = (n) => String(round2(n));
export const fmtPurchaseId = (id) => 'PUR-' + String(id).padStart(4, '0');
export const fmtSaleId = (id) => 'SAL-' + String(id).padStart(4, '0');
export const fmtDeliveryId = (id) => 'DEL-' + String(id).padStart(4, '0');
export const fmtCustPayId = (id) => 'CPY-' + String(id).padStart(4, '0');
export const fmtSuppPayId = (id) => 'SPY-' + String(id).padStart(4, '0');

export function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
export function fmtTime(hhmm) {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}
export function parseIso(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDaysIso(iso, n) { const d = parseIso(iso); d.setDate(d.getDate() + n); return isoDate(d); }
export function addMonthsIso(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const lastDay = new Date(y, m - 1 + n + 1, 0).getDate();
  return isoDate(new Date(y, m - 1 + n, Math.min(d, lastDay)));
}
export const isRealDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && isoDate(parseIso(s)) === s;
export const todayIso = () => isoDate(new Date());