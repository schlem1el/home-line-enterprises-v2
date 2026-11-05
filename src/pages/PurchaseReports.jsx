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
import OperationalStatus from '../components/OperationalStatus';
import reportStyle from '../styles/ReportStyle';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { peso, pesoPdf, todayIso, fmtDate, fmtPurchaseId, fmtTime, round2 } from '../utils/format';
import { TOKENS } from '../styles/HomeLineStyles';
import {
  DATE_RANGES, reportDateBounds, bucketSeries, BUCKET_LABELS
} from '../utils/reportHelpers';
import { PAYMENT_STATUSES, PURCHASE_STATUSES, receivingStatusOfPurchase, scheduledDeliveryDateOf, purchaseDueStatus } from '../utils/businessRules';
import { generatePdfReport } from '../utils/pdfReport';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@mui/material';

const PAGE_SIZE = 10;

export default function PurchaseReports() {
  const { data, supplierById, detailsOf, refresh: refreshData } = useData();
  const { profile } = useAuth();
  const showToast = useToast();

  const [range, setRange] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [dueStatus, setDueStatus] = useState('');
  const [sortKey, setSortKey] = useState('purchase_date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [detailPurchaseId, setDetailPurchaseId] = useState(null);

  const filtered = useMemo(() => {
    const { start, end, valid } = reportDateBounds(range, from, to, data.purchases, 'purchase_date');
    if (!valid) return [];
    return data.purchases.filter((p) => {
      if (start && p.purchase_date < start) return false;
      if (p.purchase_date > end) return false;
      if (supplierId && p.supplier_id !== Number(supplierId)) return false;
      if (status && p.purchase_status !== status) return false;
      if (paymentStatus && p.payment_status !== paymentStatus) return false;
      if (dueStatus && purchaseDueStatus(p, data.supplier_payments) !== dueStatus) return false;
      return true;
    });
  }, [data.purchases, data.supplier_payments, range, from, to, supplierId, status, paymentStatus, dueStatus]);

  const { bucket, data: chartData } = useMemo(() => {
    const { start: boundStart, end: boundEnd } = reportDateBounds(range, from, to, filtered, 'purchase_date');
    const start = boundStart || todayIso();
    const end = boundEnd || todayIso();
    return bucketSeries(filtered, start, end, 'purchase_date', 'total_amount');
  }, [filtered, range, from, to]);

  const rows = useMemo(() => {
    const arr = filtered.map((p) => {
      const lines = detailsOf(p.purchase_id);
      return {
        _key: p.purchase_id,
        purchase_id: p.purchase_id,
        purchase_date: p.purchase_date,
        supplier: supplierById(p.supplier_id)?.supplier_name || '—',
        items: lines.length,
        total: p.total_amount,
        payment_status: p.payment_status,
        overdue: purchaseDueStatus(p, data.supplier_payments),
        receiving_status: receivingStatusOfPurchase(p.purchase_id, data.supplier_deliveries),
        purchase_status: p.purchase_status
      };
    });
    arr.sort((a, b) => {
      let r = 0;
      switch (sortKey) {
        case 'purchase_id': r = a.purchase_id - b.purchase_id; break;
        case 'purchase_date': r = a.purchase_date.localeCompare(b.purchase_date) || a.purchase_id - b.purchase_id; break;
        case 'supplier': r = a.supplier.localeCompare(b.supplier); break;
        case 'items': r = a.items - b.items; break;
        case 'total': r = a.total - b.total; break;
        case 'payment_status': r = a.payment_status.localeCompare(b.payment_status); break;
        case 'overdue': r = (a.overdue || '').localeCompare(b.overdue || ''); break;
        case 'receiving_status': r = a.receiving_status.localeCompare(b.receiving_status); break;
        case 'purchase_status': r = a.purchase_status.localeCompare(b.purchase_status); break;
      }
      if (r === 0) r = a.purchase_id - b.purchase_id;
      return sortDir === 'asc' ? r : -r;
    });
    return arr;
  }, [filtered, sortKey, sortDir, supplierById, detailsOf, data.supplier_deliveries, data.supplier_payments]);

  const columns = [
    { key: 'purchase_id', label: 'Purchase ID', format: (v) => 'PUR-' + String(v).padStart(4, '0'), pdf: (v) => 'PUR-' + String(v).padStart(4, '0') },
    { key: 'purchase_date', label: 'Date', format: (v) => fmtDate(v), pdf: (v) => fmtDate(v) },
    { key: 'supplier', label: 'Supplier' },
    { key: 'items', label: 'Items', num: true },
    { key: 'total', label: 'Total', num: true, format: peso, pdf: (v) => pesoPdf(v) },
    { key: 'payment_status', label: 'Payment' },
    { key: 'overdue', label: 'Due status', format: (v) => v || '—' },
    { key: 'receiving_status', label: 'Receiving' },
    { key: 'purchase_status', label: 'Status' }
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
  const supplierLabel = !supplierId
    ? 'All suppliers'
    : (data.suppliers.find((s) => s.supplier_id === Number(supplierId))?.supplier_name || supplierId);
  const statusLabel = status || 'All statuses';
  const paymentStatusLabel = paymentStatus || 'All payment statuses';
  const dueStatusLabel = dueStatus || 'All due statuses';

  const exportPdf = async () => {
    const grandTotal = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
    await generatePdfReport({
      title: 'Purchase Report',
      subtitle: `${rangeLabel} · ${rows.length} purchase${rows.length === 1 ? '' : 's'}`,
      filters: [
        ['Date range', rangeLabel],
        ['Supplier', supplierLabel],
        ['Status', statusLabel],
        ['Payment status', paymentStatusLabel],
        ['Due status', dueStatusLabel],
      ],
      columns: [
        { key: 'purchase_id', label: 'Purchase ID', pdf: (v) => 'PUR-' + String(v).padStart(4, '0'), weight: 0.9 },
        { key: 'purchase_date', label: 'Date', pdf: (v) => fmtDate(v), weight: 0.9 },
        { key: 'supplier', label: 'Supplier', weight: 2.0 },
        { key: 'items', label: 'Items', num: true, weight: 0.7 },
        { key: 'total', label: 'Total', num: true, pdf: (v) => pesoPdf(v), weight: 1.1 },
        { key: 'payment_status', label: 'Payment', weight: 1.2 },
        { key: 'overdue', label: 'Due status', pdf: (v) => v || '—', weight: 0.8 },
        { key: 'receiving_status', label: 'Receiving', weight: 1.2 },
        { key: 'purchase_status', label: 'Status', weight: 1.0 },
      ],
      rows,
      totals: [['Grand Total', pesoPdf(grandTotal)]],
      filename: 'purchase-report',
      landscape: true,
      preparedBy: profile?.full_name || profile?.email || '',
    });
    showToast('PDF exported');
  };

  const detailPurchase = detailPurchaseId ? data.purchases.find(p => p.purchase_id === detailPurchaseId) : null;

  return (
    <>
      <Topbar title="Purchase Reports" />
      <Box component="main" sx={reportStyle.content}>
        <Box sx={reportStyle.filterBar}>
          <Box sx={reportStyle.filterGroup}>
            <TextField select size="small" label="Supplier" value={supplierId}
              onChange={(e) => { setSupplierId(e.target.value); setPage(1); }} sx={reportStyle.filterField}>
              <MenuItem value="">All suppliers</MenuItem>
              {data.suppliers.map((s) => <MenuItem key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Status" value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }} sx={reportStyle.filterField}>
              <MenuItem value="">All statuses</MenuItem>
              {PURCHASE_STATUSES.map((purchaseStatus) => <MenuItem key={purchaseStatus} value={purchaseStatus}>{purchaseStatus}</MenuItem>)}
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
          aria-label={`Purchases Trend Chart. ${chartData.map(d => `${d.label}: ${peso(d.value)}`).join(', ')}`}
        >
          <ChartBox
            title={`Purchases Trend Chart · ${BUCKET_LABELS[bucket]}`}
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
            ariaLabel="Purchase Report Data"
            onRowOpen={(row) => setDetailPurchaseId(row.purchase_id)}
          />
        </Box>

        <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 2 }}>
          {pageRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: TOKENS.gray5 }}>No records match these filters.</Box>
          ) : pageRows.map((p) => (
            <Card
              key={p.purchase_id}
              variant="outlined"
              onClick={() => setDetailPurchaseId(p.purchase_id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetailPurchaseId(p.purchase_id);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`View purchase ${fmtPurchaseId(p.purchase_id)} details`}
              sx={{ borderRadius: 2, cursor: 'pointer', '&:hover': { borderColor: TOKENS.hlBlue, backgroundColor: TOKENS.hlBlueTint }, '&:focus-visible': { outline: `2px solid ${TOKENS.hlBlue}`, outlineOffset: 2 } }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box>
                    <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: TOKENS.hlBlueDark }}>
                      {columns[0].pdf(p.purchase_id)}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: TOKENS.gray5, mt: 0.5 }}>
                      {fmtDate(p.purchase_date)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Chip label={p.payment_status} color={p.payment_status === 'Fully Paid' ? 'success' : 'default'} size="small" />
                    <Chip label={p.purchase_status} size="small" sx={{ mt: 0.5, display: 'flex' }} />
                  </Box>
                </Box>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.gray5, letterSpacing: 0.5 }}>Supplier</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{p.supplier}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: 11, color: TOKENS.gray5 }}>Total</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: TOKENS.hlBlueDark }}>{peso(p.total)}</Typography>
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
            ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + pageRows.length} of ${rows.length} purchase${rows.length === 1 ? '' : 's'}`
            : '0 purchases'}
        />
      </Box>

      <DetailModal open={!!detailPurchase} title={detailPurchase ? 'Purchase ' + fmtPurchaseId(detailPurchase.purchase_id) : ''} onClose={() => setDetailPurchaseId(null)}>
        {detailPurchase && <PurchaseDetails purchase={detailPurchase} />}
      </DetailModal>
    </>
  );
}

function PurchaseDetails({ purchase }) {
  const { data, supplierById, detailsOf, productById } = useData();
  const supplier = supplierById(purchase.supplier_id);
  const rows = detailsOf(purchase.purchase_id);
  const subtotal = round2(rows.reduce((sum, d) => sum + d.subtotal, 0));
  const delivery = data.supplier_deliveries.find((d) => d.purchase_id === purchase.purchase_id);
  const recv = receivingStatusOfPurchase(purchase.purchase_id, data.supplier_deliveries);

  const style = {
    sectionTitle: { fontFamily: TOKENS.fontDisplay, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: TOKENS.hlBlueDark, margin: '0 0 10px 0', paddingLeft: 9, borderLeft: `3px solid ${TOKENS.hlGold}`, lineHeight: 1.2 },
    detail: {
      tableWrap: { border: `1px solid ${TOKENS.lineSoft}`, borderRadius: 1, overflow: 'auto', mb: 2 },
      itemsTable: {
        width: '100%',
        minWidth: 0,
        tableLayout: 'fixed',
        '& th, & td': {
          px: { xs: 0.75, sm: 1 },
          py: { xs: 0.75, sm: 1 },
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
        },
        '& th:first-of-type, & td:first-of-type': { width: '40%' },
        '& th:not(:first-of-type), & td:not(:first-of-type)': { width: '20%' },
      },
      infoLabel: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark, letterSpacing: 0.4, mb: 0.25 },
      infoValue: { fontSize: 13 },
      cellSub: { fontSize: 10.5, color: TOKENS.gray5, marginTop: '2px' },
      summaryRow: { display: 'flex', justifyContent: 'space-between', py: 0.5, fontSize: 13 },
      summaryRowBold: { display: 'flex', justifyContent: 'space-between', py: 0.5, fontSize: 13, fontWeight: 700, color: TOKENS.hlBlueDark },
    }
  };

  return (
    <Box>
      <Typography sx={style.sectionTitle}>Purchase information</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 2, mb: 2 }}>
        <Info label="Purchase ID" value={fmtPurchaseId(purchase.purchase_id)} />
        <Info label="Supplier" value={supplier?.supplier_name || '—'} />
        <Info label="Purchase Date" value={fmtDate(purchase.purchase_date)} />
        <Info label="Due Date" value={fmtDate(purchase.due_date)} />
        <Info label="Purchase Time" value={fmtTime(purchase.purchase_time)} />
        <Info label="Payment Status" value={<Box sx={{ display: 'inline-flex', gap: 0.5, flexWrap: 'wrap' }}>
          <Chip label={purchase.payment_status} color={purchase.payment_status === 'Fully Paid' ? 'success' : 'default'} size="small" />
          {isPurchaseOverdue(purchase, data.supplier_payments) && <Chip label="Overdue" color="error" size="small" />}
        </Box>} />
        <Info label="Receiving Status" value={<OperationalStatus
          status={recv}
          scheduledDate={scheduledDeliveryDateOf(delivery, recv)}
        />} />
        <Info label="Purchase Status" value={<Chip label={purchase.purchase_status} color={purchase.purchase_status === 'Completed' ? 'success' : 'default'} size="small" />} />
      </Box>

      <Typography sx={style.sectionTitle}>Purchase items</Typography>
      <Box sx={style.detail.tableWrap}>
        <Table size="small" sx={style.detail.itemsTable}>
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell><TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Unit Cost</TableCell><TableCell align="right">Subtotal</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((d) => {
              const p = productById(d.product_id);
              return (
                <TableRow key={d.purchase_detail_id}>
                  <TableCell>{p?.product_name || '—'}<Box sx={style.detail.cellSub}>{p?.product_code}</Box></TableCell>
                  <TableCell align="right">{d.quantity}</TableCell>
                  <TableCell align="right">{peso(d.unit_cost)}</TableCell>
                  <TableCell align="right">{peso(d.subtotal)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      <Typography sx={style.sectionTitle}>Receiving</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 2, mb: 2 }}>
        <Info label="Receiving Status" value={<OperationalStatus
          status={recv}
          scheduledDate={scheduledDeliveryDateOf(delivery, recv)}
        />} />
        <Info label="Scheduled Delivery" value={fmtDate(scheduledDeliveryDateOf(delivery, recv))} />
        <Info label="Date Received" value={delivery?.receiving_status === 'Received'
          ? fmtDate(delivery.actual_delivery_date || delivery.delivery_date)
          : '—'} />
      </Box>

      <Typography sx={style.sectionTitle}>Summary</Typography>
      <Box>
        <Box sx={style.detail.summaryRow}><span>Subtotal</span><span>{peso(subtotal)}</span></Box>
        <Box sx={style.detail.summaryRow}><span>Discount</span><span>{peso(purchase.discount_amount)}</span></Box>
        <Box sx={style.detail.summaryRowBold}><span>Total</span><span>{peso(purchase.total_amount)}</span></Box>
      </Box>
    </Box>
  );
}

const Info = ({ label, value }) => (
  <Box><Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark, letterSpacing: 0.4, mb: 0.25 }}>{label}</Typography><Typography sx={{ fontSize: 13 }}>{value}</Typography></Box>
);