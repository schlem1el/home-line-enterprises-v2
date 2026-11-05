import React, { useMemo, useState } from 'react';
import { Box, TextField, MenuItem, Button, Typography, Card, CardContent, Divider, Chip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import Topbar from '../components/Topbar';
import ChartBox from '../components/ChartBox';
import ReportTable from '../components/ReportTable';
import Pagination from '../components/Pagination';
import DateField from '../components/DateField';
import DetailModal from '../components/DetailModal';
import PaymentStatusBadges from '../components/PaymentStatusBadges';
import reportStyle from '../styles/ReportStyle';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { peso, pesoPdf, todayIso, fmtDate } from '../utils/format';
import { TOKENS } from '../styles/HomeLineStyles';
import {
  DATE_RANGES, reportDateBounds, bucketSeries, BUCKET_LABELS
} from '../utils/reportHelpers';
import { PAYMENT_METHODS, PAYMENT_STATUSES, saleDueStatus, purchaseDueStatus } from '../utils/businessRules';
import { generatePdfReport } from '../utils/pdfReport';

const PAGE_SIZE = 10;
const TYPES = [
  { key: 'customer', label: 'Customer Payment' },
  { key: 'supplier', label: 'Supplier Payment' }
];

export default function PaymentReports() {
  const { data, saleById, purchaseById, saleCustomerName, refresh: refreshData } = useData();
  const { profile } = useAuth();
  const showToast = useToast();

  const [range, setRange] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState('');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [dueStatus, setDueStatus] = useState('');
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [detailPayment, setDetailPayment] = useState(null);

  const allRows = useMemo(() => {
    const { start, end, valid } = reportDateBounds(range, from, to, [
      ...data.customer_payments, ...data.supplier_payments
    ], 'date');
    if (!valid) return [];
    const customer = data.customer_payments.map((p) => ({
      kind: 'customer',
      date: p.payment_date,
      type: 'Customer Payment',
      ref: 'SAL-' + String(p.sale_id).padStart(4, '0'),
      party: (() => { const s = saleById(p.sale_id); return s ? saleCustomerName(s) : '—'; })(),
      amount: Number(p.amount) || 0,
      method: p.payment_method || '—',
      status: (() => { const s = saleById(p.sale_id); return s ? s.payment_status : '—'; })(),
      overdue: (() => { const s = saleById(p.sale_id); return s ? saleDueStatus(s, data.payment_terms, data.customer_payments) : ''; })()
    }));
    const supplier = data.supplier_payments.map((p) => ({
      kind: 'supplier',
      date: p.payment_date,
      type: 'Supplier Payment',
      ref: 'PUR-' + String(p.purchase_id).padStart(4, '0'),
      party: (() => { const pur = purchaseById(p.purchase_id); return pur ? 'Purchase ' + pur.purchase_id : '—'; })(),
      amount: Number(p.amount) || 0,
      method: p.payment_method || '—',
      status: (() => { const pur = purchaseById(p.purchase_id); return pur ? pur.payment_status : '—'; })(),
      overdue: (() => {
        const pur = purchaseById(p.purchase_id);
        return pur ? purchaseDueStatus(pur, data.supplier_payments) : '';
      })()
    }));
    return [...customer, ...supplier].filter((r) => {
      if (start && r.date < start) return false;
      if (r.date > end) return false;
      if (type && r.kind !== type) return false;
      if (method && r.method !== method) return false;
      if (status && r.status !== status) return false;
      if (dueStatus && r.overdue !== dueStatus) return false;
      return true;
    });
  }, [data.customer_payments, data.supplier_payments, data.payment_terms, range, from, to, type, method, status, dueStatus, saleById, purchaseById, saleCustomerName]);

  const { bucket, data: chartData } = useMemo(() => {
    const { start: boundStart, end: boundEnd } = reportDateBounds(range, from, to, allRows, 'date');
    const start = boundStart || todayIso();
    const end = boundEnd || todayIso();
    return bucketSeries(allRows, start, end, 'date', 'amount');
  }, [allRows, range, from, to]);

  const rows = useMemo(() => {
    const arr = [...allRows];
    arr.sort((a, b) => {
      let r = 0;
      switch (sortKey) {
        case 'date': r = a.date.localeCompare(b.date); break;
        case 'type': r = a.type.localeCompare(b.type); break;
        case 'ref': r = a.ref.localeCompare(b.ref); break;
        case 'amount': r = a.amount - b.amount; break;
        case 'status': r = a.status.localeCompare(b.status); break;
      }
      if (r === 0) r = a.ref.localeCompare(b.ref);
      return sortDir === 'asc' ? r : -r;
    });
    return arr;
  }, [allRows, sortKey, sortDir]);

  const columns = [
    { key: 'date', label: 'Date', format: (v) => fmtDate(v), pdf: (v) => fmtDate(v) },
    { key: 'type', label: 'Type' },
    { key: 'ref', label: 'Reference No.' },
    { key: 'party', label: 'Party' },
    { key: 'amount', label: 'Amount', num: true, format: peso, pdf: (v) => pesoPdf(v) },
    { key: 'method', label: 'Method' },
    { key: 'status', label: 'Status', format: (v) => <PaymentStatusBadges status={v} /> },
    { key: 'overdue', label: 'Due status', format: (v) => v ? <Chip label={v} size="small" color={v === 'Overdue' ? 'error' : v === 'Due Today' ? 'warning' : 'info'} /> : '—', pdf: (v) => v || '—' }
  ];

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const onSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const refresh = async () => {
    await refreshData();
    showToast('Data refreshed from Firestore');
  };
  const rangeLabel = range === 'custom'
    ? `Custom: ${from || 'Any'} to ${to || 'Any'}`
    : DATE_RANGES.find((r) => r.key === range)?.label || range;
  const typeLabel = !type ? 'All types' : (TYPES.find((t) => t.key === type)?.label || type);
  const methodLabel = method || 'All methods';
  const statusLabel = status || 'All statuses';
  const dueStatusLabel = dueStatus || 'All due statuses';

  const exportPdf = async () => {
    const grandTotal = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    await generatePdfReport({
      title: 'Payment Report',
      subtitle: `${rangeLabel} · ${rows.length} payment${rows.length === 1 ? '' : 's'}`,
      filters: [
        ['Date range', rangeLabel],
        ['Payment Type', typeLabel],
        ['Method', methodLabel],
        ['Payment status', statusLabel],
        ['Due status', dueStatusLabel],
      ],
      columns: [
        { key: 'date', label: 'Date', pdf: (v) => fmtDate(v), weight: 0.9 },
        { key: 'type', label: 'Type', weight: 1.3 },
        { key: 'ref', label: 'Reference No.', weight: 0.9 },
        { key: 'party', label: 'Party', weight: 2.2 },
        { key: 'amount', label: 'Amount', num: true, pdf: (v) => pesoPdf(v), weight: 1.1 },
        { key: 'method', label: 'Method', weight: 1.0 },
        { key: 'status', label: 'Status', weight: 1.0 },
        { key: 'overdue', label: 'Due status', pdf: (v) => v || '—', weight: 0.8 },
      ],
      rows,
      totals: [['Grand Total', pesoPdf(grandTotal)]],
      filename: 'payment-report',
      landscape: true,
      preparedBy: profile?.full_name || profile?.email || '',
    });
    showToast('PDF exported');
  };

  return (
    <>
      <Topbar title="Payment Reports" />
      <Box component="main" sx={reportStyle.content}>
        <Box sx={reportStyle.filterBar}>
          <Box sx={reportStyle.filterGroup}>
            <TextField select size="small" label="Payment Type" value={type}
              onChange={(e) => { setType(e.target.value); setPage(1); }} sx={reportStyle.filterField}>
              <MenuItem value="">All types</MenuItem>
              {TYPES.map((t) => <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Method" value={method}
              onChange={(e) => { setMethod(e.target.value); setPage(1); }} sx={reportStyle.filterField}>
              <MenuItem value="">All methods</MenuItem>
              {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Payment Status" value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }} sx={reportStyle.filterField}>
              <MenuItem value="">All statuses</MenuItem>
              {PAYMENT_STATUSES.map((paymentStatus) => <MenuItem key={paymentStatus} value={paymentStatus}>{paymentStatus}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Due Status" value={dueStatus}
              onChange={(e) => { setDueStatus(e.target.value); setPage(1); }} sx={reportStyle.filterField}>
              <MenuItem value="">All due statuses</MenuItem>
              <MenuItem value="Due Soon">Due Soon</MenuItem>
              <MenuItem value="Due Today">Due Today</MenuItem>
              <MenuItem value="Overdue">Overdue</MenuItem>
            </TextField>
          </Box>
          <Box sx={reportStyle.dateRangeGroup}>
            <TextField select size="small" label="Date range" value={range}
              onChange={(e) => { setRange(e.target.value); if (e.target.value !== 'custom') { setFrom(''); setTo(''); } setPage(1); }} sx={reportStyle.filterField}>
              {DATE_RANGES.map((r) => <MenuItem key={r.key} value={r.key}>{r.label}</MenuItem>)}
            </TextField>
            {range === 'custom' && <DateField label="From" value={from} max={to || undefined}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }} sx={reportStyle.filterField} />}
            {range === 'custom' && <DateField label="To" value={to} min={from || undefined}
              onChange={(e) => { setTo(e.target.value); setPage(1); }} sx={reportStyle.filterField} />}
          </Box>
          <Box sx={reportStyle.actionGroup}>
            <Button sx={reportStyle.btnSm} startIcon={<RefreshIcon />} onClick={refresh}>Refresh</Button>
            <Button variant="contained" sx={reportStyle.btnExport} startIcon={<PictureAsPdfIcon />} onClick={exportPdf}>Export PDF</Button>
          </Box>
        </Box>

        <Box
          sx={reportStyle.chartWrap}
          role="img"
          aria-label={`Customer vs Supplier Payments Chart. ${chartData.map(d => `${d.label}: ${peso(d.value)}`).join(', ')}`}
        >
          <ChartBox
            title={`Customer vs Supplier Payments · ${BUCKET_LABELS[bucket]}`}
            money
            data={chartData}
            compact
            scrollable
            minBarWidth={60}
          />
        </Box>

        <Typography sx={reportStyle.sectionTitle}>Breakdown</Typography>

        <Box sx={{ display: { xs: 'none', sm: 'block' }, ...reportStyle.tableWrap }}>
          <ReportTable
            columns={columns}
            rows={pageRows}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            ariaLabel="Payment Report Data"
            onRowOpen={(row) => setDetailPayment(row)}
          />
        </Box>

        <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 2 }}>
          {pageRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: TOKENS.gray5 }}>No records match these filters.</Box>
          ) : pageRows.map((p) => (
            <Card
              key={p.ref + p.date}
              variant="outlined"
              onClick={() => setDetailPayment(p)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetailPayment(p);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`View ${p.type.toLowerCase()} details for ${p.ref}`}
              sx={{ borderRadius: 2, cursor: 'pointer', '&:hover': { borderColor: TOKENS.hlBlue, backgroundColor: TOKENS.hlBlueTint }, '&:focus-visible': { outline: `2px solid ${TOKENS.hlBlue}`, outlineOffset: 2 } }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box>
                    <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: TOKENS.hlBlueDark }}>
                      {p.ref}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: TOKENS.gray5, mt: 0.5 }}>
                      {fmtDate(p.date)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Chip label={p.type} color={p.kind === 'customer' ? 'primary' : 'default'} size="small" />
                  </Box>
                </Box>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.gray5, letterSpacing: 0.5 }}>Party</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{p.party}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <PaymentStatusBadges status={p.status} dueStatus={p.overdue} />
                    <Typography sx={{ fontSize: 11, color: TOKENS.gray5 }}>Amount</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: TOKENS.hlBlueDark }}>{peso(p.amount)}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPrev={() => setPage((p) => p - 1)}
          onNext={() => setPage((p) => p + 1)}
          info={rows.length
            ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + pageRows.length} of ${rows.length} payment${rows.length === 1 ? '' : 's'}`
            : '0 payments'}
        />
      </Box>

      <DetailModal
        open={!!detailPayment}
        title={detailPayment ? detailPayment.type : ''}
        onClose={() => setDetailPayment(null)}
      >
        {detailPayment && (
          <Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 2 }}>
              <Box><Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark }}>Reference No.</Typography><Typography sx={{ fontSize: 13 }}>{detailPayment.ref}</Typography></Box>
              <Box><Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark }}>Date</Typography><Typography sx={{ fontSize: 13 }}>{fmtDate(detailPayment.date)}</Typography></Box>
              <Box><Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark }}>Party</Typography><Typography sx={{ fontSize: 13 }}>{detailPayment.party}</Typography></Box>
              <Box><Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark }}>Amount</Typography><Typography sx={{ fontSize: 13, fontWeight: 700 }}>{peso(detailPayment.amount)}</Typography></Box>
              <Box><Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark }}>Method</Typography><Typography sx={{ fontSize: 13 }}>{detailPayment.method}</Typography></Box>
              <Box><Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark }}>Status</Typography><PaymentStatusBadges status={detailPayment.status} dueStatus={detailPayment.overdue} /></Box>
            </Box>
          </Box>
        )}
      </DetailModal>
    </>
  );
}