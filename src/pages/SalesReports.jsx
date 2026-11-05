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
import SaleDetails from '../components/SaleDetails';
import PaymentStatusBadges from '../components/PaymentStatusBadges';
import reportStyle from '../styles/ReportStyle';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { peso, pesoPdf, todayIso, fmtDate, fmtSaleId } from '../utils/format';
import { TOKENS } from '../styles/HomeLineStyles';
import {
  DATE_RANGES, reportDateBounds, bucketSeries, BUCKET_LABELS
} from '../utils/reportHelpers';
import { generatePdfReport } from '../utils/pdfReport';
import { PAYMENT_STATUSES, SALE_STATUSES, saleDueStatus } from '../utils/businessRules';

const PAGE_SIZE = 10;

export default function SalesReports() {
  const { data, saleCustomerName, refresh: refreshData } = useData();
  const { profile } = useAuth();
  const showToast = useToast();

  const [range, setRange] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [productId, setProductId] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [dueStatus, setDueStatus] = useState('');
  const [sortKey, setSortKey] = useState('sale_date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [detailSaleId, setDetailSaleId] = useState(null);

  const filtered = useMemo(() => {
    const { start, end, valid } = reportDateBounds(range, from, to, data.sales, 'sale_date');
    if (!valid) return [];
    const lineHits = (saleId) => {
      if (!productId) return true;
      return data.sale_details.some((d) => d.sale_id === saleId && d.product_id === Number(productId));
    };
    return data.sales.filter((s) => {
      if (start && s.sale_date < start) return false;
      if (s.sale_date > end) return false;
      if (status && s.sale_status !== status) return false;
      if (paymentStatus && s.payment_status !== paymentStatus) return false;
      if (dueStatus && saleDueStatus(s, data.payment_terms, data.customer_payments) !== dueStatus) return false;
      if (customerId === '__walkin__') { if (s.customer_id) return false; }
      else if (customerId && s.customer_id !== Number(customerId)) return false;
      if (!lineHits(s.sale_id)) return false;
      return true;
    });
  }, [data.sales, data.sale_details, data.payment_terms, data.customer_payments, range, from, to, customerId, productId, status, paymentStatus, dueStatus]);

  const { bucket, data: chartData } = useMemo(() => {
    const { start: boundStart, end: boundEnd } = reportDateBounds(range, from, to, filtered, 'sale_date');
    const start = boundStart || todayIso();
    const end = boundEnd || todayIso();
    return bucketSeries(filtered, start, end, 'sale_date', 'total_amount');
  }, [filtered, range, from, to]);

  const rows = useMemo(() => {
    const arr = filtered.map((s) => ({
      _key: s.sale_id,
      sale_id: s.sale_id,
      sale_date: s.sale_date,
      customer: saleCustomerName(s),
      sale_type: s.sale_type,
      total: s.total_amount,
      payment_status: s.payment_status,
      overdue: saleDueStatus(s, data.payment_terms, data.customer_payments),
      sale_status: s.sale_status
    }));
    arr.sort((a, b) => {
      let r = 0;
      switch (sortKey) {
        case 'sale_id': r = a.sale_id - b.sale_id; break;
        case 'sale_date': r = a.sale_date.localeCompare(b.sale_date) || a.sale_id - b.sale_id; break;
        case 'customer': r = a.customer.localeCompare(b.customer); break;
        case 'sale_type': r = a.sale_type.localeCompare(b.sale_type); break;
        case 'total': r = a.total - b.total; break;
        case 'payment_status': r = a.payment_status.localeCompare(b.payment_status); break;
        case 'sale_status': r = a.sale_status.localeCompare(b.sale_status); break;
      }
      if (r === 0) r = a.sale_id - b.sale_id;
      return sortDir === 'asc' ? r : -r;
    });
    return arr;
  }, [filtered, sortKey, sortDir, saleCustomerName, data.payment_terms, data.customer_payments]);

  const columns = [
    { key: 'sale_id', label: 'Sale ID', pdf: (v) => 'SAL-' + String(v).padStart(4, '0') },
    { key: 'sale_date', label: 'Date', format: (v) => fmtDate(v), pdf: (v) => fmtDate(v) },
    { key: 'customer', label: 'Customer' },
    { key: 'sale_type', label: 'Type' },
    { key: 'total', label: 'Total', num: true, format: peso, pdf: (v) => pesoPdf(v) },
    { key: 'payment_status', label: 'Payment', format: (v) => <PaymentStatusBadges status={v} /> },
    { key: 'overdue', label: 'Due status', format: (v) => v ? <Chip label={v} size="small" color={v === 'Overdue' ? 'error' : v === 'Due Today' ? 'warning' : 'info'} /> : '—', pdf: (v) => v || '—' },
    { key: 'sale_status', label: 'Status' }
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
  const customerLabel = !customerId
    ? 'All customers'
    : customerId === '__walkin__'
      ? 'Walk-in only'
      : (data.customers.find((c) => c.customer_id === Number(customerId))?.customer_name || customerId);
  const productLabel = !productId
    ? 'All products'
    : (data.products.find((p) => p.product_id === Number(productId))?.product_name || productId);
  const statusLabel = status || 'All statuses';
  const paymentStatusLabel = paymentStatus || 'All payment statuses';
  const dueStatusLabel = dueStatus || 'All due statuses';

  const exportPdf = async () => {
    const grandTotal = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
    await generatePdfReport({
      title: 'Sales Report',
      subtitle: `${rangeLabel} · ${rows.length} sale${rows.length === 1 ? '' : 's'}`,
      filters: [
        ['Date range', rangeLabel],
        ['Customer', customerLabel],
        ['Product', productLabel],
        ['Status', statusLabel],
        ['Payment status', paymentStatusLabel],
        ['Due status', dueStatusLabel],
      ],
      columns: [
        { key: 'sale_id', label: 'Sale ID', pdf: (v) => 'SAL-' + String(v).padStart(4, '0'), weight: 0.9 },
        { key: 'sale_date', label: 'Date', pdf: (v) => fmtDate(v), weight: 0.9 },
        { key: 'customer', label: 'Customer', weight: 2.0 },
        { key: 'sale_type', label: 'Type', weight: 1.0 },
        { key: 'total', label: 'Total', num: true, pdf: (v) => pesoPdf(v), weight: 1.1 },
        { key: 'payment_status', label: 'Payment', weight: 1.2 },
        { key: 'overdue', label: 'Due status', pdf: (v) => v || '—', weight: 0.8 },
        { key: 'sale_status', label: 'Status', weight: 1.0 },
      ],
      rows,
      totals: [['Grand Total', pesoPdf(grandTotal)]],
      filename: 'sales-report',
      preparedBy: profile?.full_name || profile?.email || '',
    });
    showToast('PDF exported');
  };

  const detailSale = detailSaleId ? data.sales.find(s => s.sale_id === detailSaleId) : null;

  return (
    <>
      <Topbar title="Sales Reports" />
      <Box component="main" sx={reportStyle.content}>
        <Box sx={reportStyle.filterBar}>
          <Box sx={reportStyle.filterGroup}>
            <TextField select size="small" label="Customer" value={customerId}
              onChange={(e) => { setCustomerId(e.target.value); setPage(1); }} sx={reportStyle.filterField}>
              <MenuItem value="">All customers</MenuItem>
              <MenuItem value="__walkin__">Walk-in only</MenuItem>
              {data.customers.map((c) => <MenuItem key={c.customer_id} value={c.customer_id}>{c.customer_name}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Product" value={productId}
              onChange={(e) => { setProductId(e.target.value); setPage(1); }} sx={reportStyle.filterField}>
              <MenuItem value="">All products</MenuItem>
              {data.products.map((p) => <MenuItem key={p.product_id} value={p.product_id}>{p.product_name}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Status" value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }} sx={reportStyle.filterField}>
              <MenuItem value="">All statuses</MenuItem>
              {SALE_STATUSES.map((saleStatus) => <MenuItem key={saleStatus} value={saleStatus}>{saleStatus}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Payment status" value={paymentStatus}
              onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }} sx={reportStyle.filterField}>
              <MenuItem value="">All payment statuses</MenuItem>
              {PAYMENT_STATUSES.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Due status" value={dueStatus}
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
          aria-label={`Sales Trend Chart. ${chartData.map(d => `${d.label}: ${peso(d.value)}`).join(', ')}`}
        >
          <ChartBox
            title={`Sales Trend Chart · ${BUCKET_LABELS[bucket]}`}
            money
            data={chartData}
            compact
            scrollable
            minBarWidth={60}
          />
        </Box>

        <Typography sx={reportStyle.sectionTitle}>Breakdown</Typography>

        {/* DESKTOP TABLE */}
        <Box sx={{ display: { xs: 'none', sm: 'block' }, ...reportStyle.tableWrap }}>
          <ReportTable
            columns={columns}
            rows={pageRows}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            ariaLabel="Sales Report Data"
            onRowOpen={(row) => setDetailSaleId(row.sale_id)}
          />
        </Box>

        {/* MOBILE CARDS */}
        <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 2 }}>
          {pageRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: TOKENS.gray5 }}>No records match these filters.</Box>
          ) : pageRows.map((s) => (
            <Card
              key={s.sale_id}
              variant="outlined"
              onClick={() => setDetailSaleId(s.sale_id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetailSaleId(s.sale_id);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`View sale ${fmtSaleId(s.sale_id)} details`}
              sx={{ borderRadius: 2, cursor: 'pointer', '&:hover': { borderColor: TOKENS.hlBlue, backgroundColor: TOKENS.hlBlueTint }, '&:focus-visible': { outline: `2px solid ${TOKENS.hlBlue}`, outlineOffset: 2 } }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box>
                    <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: TOKENS.hlBlueDark }}>
                      {columns[0].pdf(s.sale_id)}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: TOKENS.gray5, mt: 0.5 }}>
                      {fmtDate(s.sale_date)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <PaymentStatusBadges status={s.payment_status} />
                    {s.overdue && <Chip label={s.overdue} size="small" color={s.overdue === 'Overdue' ? 'error' : s.overdue === 'Due Today' ? 'warning' : 'info'} sx={{ mt: 0.5 }} />}
                    <Chip label={s.sale_status} size="small" sx={{ mt: 0.5, display: 'flex' }} />
                  </Box>
                </Box>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.gray5, letterSpacing: 0.5 }}>Customer</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{s.customer}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: 11, color: TOKENS.gray5 }}>Total</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: TOKENS.hlBlueDark }}>{peso(s.total)}</Typography>
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
            ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + pageRows.length} of ${rows.length} sale${rows.length === 1 ? '' : 's'}`
            : '0 sales'}
        />
      </Box>

      <DetailModal
        open={!!detailSale}
        title={detailSale ? 'Sale ' + fmtSaleId(detailSale.sale_id) : ''}
        onClose={() => setDetailSaleId(null)}
      >
        {detailSale && <SaleDetails sale={detailSale} />}
      </DetailModal>
    </>
  );
}