import { isoDate, round2, todayIso } from './format';

/* ---------- Date range presets ---------- */
export const DATE_RANGES = [
  { key: 'today',   label: 'Today',         days: 1 },
  { key: 'week',    label: 'Last 7 days',   days: 7 },
  { key: 'month',   label: 'Last 30 days',  days: 30 },
  { key: 'quarter', label: 'Last 90 days',  days: 90 },
  { key: 'all',     label: 'All time',      days: null },
  { key: 'custom',  label: 'Custom range',  days: null }
];

export function reportDateBounds(rangeKey, from, to, items, dateField) {
  if (rangeKey === 'custom') {
    return {
      start: from || null,
      end: to || todayIso(),
      valid: (!from || !to || from <= to)
    };
  }
  return {
    start: rangeStartIso(rangeKey) || (items ? earliestDate(items, dateField) : null),
    end: todayIso(),
    valid: true
  };
}

export function rangeStartIso(rangeKey) {
  const preset = DATE_RANGES.find((r) => r.key === rangeKey);
  if (!preset || preset.days == null) return null;
  const d = new Date();
  d.setDate(d.getDate() - (preset.days - 1));
  return isoDate(d);
}

/* Find the earliest date present in an array, using `dateField`.
   Used as the start bound when the range is 'All time'. */
export function earliestDate(items, dateField) {
  if (!items?.length) return null;
  let earliest = null;
  items.forEach((item) => {
    const d = item?.[dateField];
    if (d && (!earliest || d < earliest)) earliest = d;
  });
  return earliest;
}

function parseLocalIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(startIso, endIso) {
  const days = [];
  const end = parseLocalIso(endIso);
  let cur = parseLocalIso(startIso);
  while (cur <= end) {
    days.push(isoDate(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
  }
  return days;
}

export function shortDate(iso) {
  const d = parseLocalIso(iso);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export function shortWeekday(iso) {
  const d = parseLocalIso(iso);
  return d.toLocaleDateString('en-PH', { weekday: 'short' });
}

export function truncate(s, max = 12) {
  const t = String(s ?? '');
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/* ---------- Auto-bucketing ----------
   Thresholds chosen so the bar count stays in a comfortable reading range
   (~15–30 bars) at typical desktop chart widths:

     ≤ 31 days   → daily    (30 days = 30 bars; month-over-month stays visible)
     ≤ 120 days  → weekly   (90 days = ~13 bars; 60-day reports stay weekly)
     ≤ 730 days  → monthly  (up to 2 years = 24 bars; seasonal patterns preserved)
     > 730 days  → yearly   (only when the data spans multiple years)

   The previous thresholds topped out around 13 bars in the widest bucket,
   which made the 30-day preset read as five weekly bars instead of a month
   of daily movement. */
export function chooseBucket(startIso, endIso) {
  if (!startIso || !endIso) return 'day';
  const start = parseLocalIso(startIso);
  const end = parseLocalIso(endIso);
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  if (days <= 730) return 'month';
  return 'year';
}

export const BUCKET_LABELS = {
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
  year: 'Yearly'
};

/* Normalize an iso date to the start of its bucket.
   Weeks are Monday-start so bars land on consistent weekday boundaries. */
function bucketStart(iso, bucket) {
  const [y, m, d] = iso.split('-').map(Number);
  if (bucket === 'day') return iso;
  if (bucket === 'week') {
    const date = new Date(y, m - 1, d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return isoDate(date);
  }
  if (bucket === 'month') return `${y}-${String(m).padStart(2, '0')}-01`;
  if (bucket === 'year') return `${y}-01-01`;
  return iso;
}

function nextBucket(iso, bucket) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (bucket === 'day') date.setDate(date.getDate() + 1);
  else if (bucket === 'week') date.setDate(date.getDate() + 7);
  else if (bucket === 'month') date.setMonth(date.getMonth() + 1);
  else if (bucket === 'year') date.setFullYear(date.getFullYear() + 1);
  return isoDate(date);
}

function bucketsBetween(startIso, endIso, bucket) {
  const list = [];
  let cur = bucketStart(startIso, bucket);
  const end = parseLocalIso(endIso);
  while (parseLocalIso(cur) <= end) {
    list.push(cur);
    cur = nextBucket(cur, bucket);
  }
  return list;
}

/* Label a bucket's start date for display on the chart x-axis. */
export function formatBucketLabel(startIso, bucket) {
  const d = parseLocalIso(startIso);
  if (bucket === 'day' || bucket === 'week') return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  if (bucket === 'month') return d.toLocaleDateString('en-PH', { month: 'short', year: '2-digit' });
  if (bucket === 'year') return String(d.getFullYear());
  return startIso;
}

/* Bucket an array of items by `dateField` and sum `valueField`.
   Returns `{ bucket, data }` where data is `[{ label, value }]`. */
export function bucketSeries(items, startIso, endIso, dateField, valueField) {
  const bucket = chooseBucket(startIso, endIso);
  const starts = bucketsBetween(startIso, endIso, bucket);
  const map = new Map(starts.map((s) => [s, 0]));

  items.forEach((item) => {
    const itemDate = item?.[dateField];
    if (!itemDate || itemDate < startIso || itemDate > endIso) return;
    const bs = bucketStart(itemDate, bucket);
    if (map.has(bs)) map.set(bs, map.get(bs) + (Number(item[valueField]) || 0));
  });

  const data = starts.map((s) => ({
    label: formatBucketLabel(s, bucket),
    value: round2(map.get(s) || 0)
  }));
  return { bucket, data };
}

/* ---------- Chart axis ---------- */
function niceNum(range, round) {
  if (range <= 0) return 1;
  const exp = Math.floor(Math.log10(range));
  const f = range / Math.pow(10, exp);
  let nf;
  if (round) {
    if (f < 1.5) nf = 1;
    else if (f < 3) nf = 2;
    else if (f < 7) nf = 5;
    else nf = 10;
  } else {
    if (f <= 1) nf = 1;
    else if (f <= 2) nf = 2;
    else if (f <= 5) nf = 5;
    else nf = 10;
  }
  return nf * Math.pow(10, exp);
}

export function niceTicks(maxValue, tickCount = 5) {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return Array.from({ length: tickCount }, (_, i) => i);
  }
  const range = niceNum(maxValue, false);
  const step = niceNum(range / (tickCount - 1), true);
  const niceMax = Math.ceil(maxValue / step) * step;
  const ticks = [];
  for (let v = 0; v <= niceMax + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/* ---------- CSV export ---------- */
function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv(filenamePrefix, columns, rows) {
  const header = columns.map((c) => csvEscape(c.label)).join(',');
  const body = rows.map((r) =>
    columns.map((c) => csvEscape(c.csv ? c.csv(r[c.key]) : r[c.key])).join(',')
  ).join('\r\n');
  const csv = '\uFEFF' + header + '\r\n' + body;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}-${isoDate(new Date())}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}