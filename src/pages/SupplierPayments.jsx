import React, { useMemo, useState } from 'react';
import {
  Box, TextField, MenuItem, Button, Table, TableHead, TableBody, Tooltip,
  TableRow, TableCell, Typography, Chip, Card, CardContent, Divider
} from '@mui/material';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import Topbar from '../components/Topbar';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';
import DetailModal from '../components/DetailModal';
import Field from '../components/Field';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import style from '../styles/PaymentsStyles';
import { TOKENS, filterChip } from '../styles/HomeLineStyles';
import {
  PAGE_SIZE, PAYMENT_STATUSES, PAYMENT_METHODS,
  purchaseStatusOf, paymentStatusOf, parsePayAmount, isPurchaseOverdue, purchaseDueStatus,
  chequeDuplicateError
} from '../utils/businessRules';
import {
  peso, fmtDate, fmtPurchaseId, fmtSuppPayId, round2, todayIso, isRealDate
} from '../utils/format';
import { writeAudit } from '../utils/auditHelpers';
import { hasAtMostTwoDecimalPlaces } from '../utils/validation';

const COLOR_MAP = {
  Active: 'warning', Completed: 'success', Cancelled: 'default',
  Unpaid: 'default', 'Partially Paid': 'warning', 'Fully Paid': 'success',
  Received: 'success'
};

const SP_DEFAULT = { search: '', status: '', dueStatus: '', sortKey: 'date', sortDir: 'desc', page: 1 };

const SP_COLUMNS = [
  { key: 'id', label: 'Purchase ID' },
  { key: 'party', label: 'Supplier' },
  { key: 'date', label: 'Purchase Date' },
  { key: 'total', label: 'Total Amount', num: true },
  { key: 'paid', label: 'Amount Paid', num: true },
  { key: 'balance', label: 'Balance', num: true },
  { key: 'status', label: 'Payment Status' }
];

const PAY_STATUS_RANK = (s) => PAYMENT_STATUSES.indexOf(s);

export default function SupplierPayments() {
  const { data, add, update, refresh, purchaseById, supplierById } = useData();
  const { user } = useAuth();
  const showToast = useToast();

  const [sp, setSp] = useState({ ...SP_DEFAULT });
  const [detailPurchaseId, setDetailPurchaseId] = useState(null);
  const [recordPurchaseId, setRecordPurchaseId] = useState(null);
  const [recordDraft, setRecordDraft] = useState({
    date: todayIso(), amount: '', method: '', cheque: ''
  });
  const [payBusy, setPayBusy] = useState(false);

  const allRows = useMemo(() => data.purchases.filter((p) => p.purchase_status !== 'Cancelled'), [data.purchases]);

  const purchasePaid = (purchaseId) =>
    round2(data.supplier_payments
      .filter((x) => x.purchase_id === purchaseId)
      .reduce((s, x) => s + x.amount, 0));
  const purchaseBalance = (pur) => round2(pur.total_amount - purchasePaid(pur.purchase_id));
  const purchasePayStatus = (pur) => paymentStatusOf(pur.total_amount, purchasePaid(pur.purchase_id));
  const purchaseOverdue = (pur) => purchaseDueStatus(pur, data.supplier_payments);
  const supplierName = (pur) => supplierById(pur.supplier_id)?.supplier_name || '—';

  const filtered = useMemo(() => {
    const q = sp.search.trim().toLowerCase();
    return allRows.filter((p) => {
      const st = purchasePayStatus(p);
      if (sp.status && st !== sp.status) return false;
      if (sp.dueStatus && purchaseDueStatus(p, data.supplier_payments) !== sp.dueStatus) return false;
      if (!q) return true;
      const hay = [
        fmtPurchaseId(p.purchase_id), supplierName(p), fmtDate(p.purchase_date), p.purchase_date,
        st,
        purchaseOverdue(p),
        String(p.total_amount), peso(p.total_amount),
        String(purchasePaid(p.purchase_id)), peso(purchasePaid(p.purchase_id)),
        String(purchaseBalance(p)), peso(purchaseBalance(p))
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, sp.search, sp.status, sp.dueStatus, supplierById, data.supplier_payments]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let r = 0;
      switch (sp.sortKey) {
        case 'id': r = a.purchase_id - b.purchase_id; break;
        case 'party': r = supplierName(a).localeCompare(supplierName(b)); break;
        case 'date': r = a.purchase_date.localeCompare(b.purchase_date); break;
        case 'total': r = a.total_amount - b.total_amount; break;
        case 'paid': r = purchasePaid(a.purchase_id) - purchasePaid(b.purchase_id); break;
        case 'balance': r = purchaseBalance(a) - purchaseBalance(b); break;
        case 'status': r = PAY_STATUS_RANK(purchasePayStatus(a)) - PAY_STATUS_RANK(purchasePayStatus(b)); break;
      }
      if (r === 0) r = a.purchase_id - b.purchase_id;
      return sp.sortDir === 'asc' ? r : -r;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sp.sortKey, sp.sortDir, supplierById, data.supplier_payments]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, sp.page), totalPages);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const onSort = (key) => setSp((p) => ({
    ...p, sortKey: key,
    sortDir: p.sortKey === key && p.sortDir === 'asc' ? 'desc'
      : (p.sortKey === key ? 'asc'
        : (['date', 'total', 'paid', 'balance'].includes(key) ? 'desc' : 'asc')),
    page: 1
  }));

  const clearFilters = () => setSp({ ...SP_DEFAULT });

  const openRecord = (purchaseId) => {
    const pur = purchaseById(purchaseId);
    if (!pur) return;
    if (pur.purchase_status === 'Cancelled') { showToast('A cancelled purchase can’t be paid'); return; }
    if (!(purchaseBalance(pur) > 0)) { showToast('This purchase has no remaining balance'); return; }
    setRecordPurchaseId(purchaseId);
    setRecordDraft({ date: todayIso(), amount: '', method: '', cheque: '' });
    setPayBusy(false);
  };

  const saveRecord = async () => {
    if (payBusy) return;
    const pur = purchaseById(recordPurchaseId);
    if (!pur) return;
    if (pur.purchase_status === 'Cancelled') { showToast('A cancelled purchase can’t be paid'); return; }
    const balance = purchaseBalance(pur);
    if (!(balance > 0)) { showToast('This purchase has no remaining balance'); return; }

    const { amount: amountRaw, method, cheque } = recordDraft;
    const date = method === 'Cheque' ? pur.due_date : recordDraft.date;
    const fail = (msg) => showToast(msg);
    if (!date) return fail('Choose a payment date');
    if (!isRealDate(date)) return fail('Enter a valid payment date');
    if (method !== 'Cheque' && date > todayIso()) return fail('Payment date can’t be in the future');
    if (date < pur.purchase_date) return fail('Payment date can’t be before the purchase date');
    if (!PAYMENT_METHODS.includes(method)) return fail('Choose a payment method');
    const a = method === 'Cheque'
      ? (() => {
        const value = Number(String(amountRaw).trim());
        if (String(amountRaw).trim() === '') return { amount: 0 };
        if (!Number.isFinite(value) || value < 0) return { error: 'Enter 0 or a valid amount' };
        if (!hasAtMostTwoDecimalPlaces(value)) return { error: 'Amount can have at most 2 decimal places' };
        if (value !== 0) return { error: 'Deferred cheque amount must be 0' };
        return { amount: round2(value) };
      })()
      : parsePayAmount(amountRaw, balance, 'the remaining balance');
    if (a.error) return fail(a.error);
    if (method === 'Cheque' && !cheque.trim()) return fail('Enter the cheque number');
    if (method === 'Cheque') {
      const duplicateError = chequeDuplicateError(data.supplier_payments, {
        purchaseId: pur.purchase_id,
        dueDate: date,
        chequeNumber: cheque,
      });
      if (duplicateError) return fail(duplicateError);
    }

    setPayBusy(true);
    try {
      const payId = data.supplier_payments.reduce((m, x) => Math.max(m, x.supplier_payment_id), 0) + 1;
      await add('supplier_payments', {
        supplier_payment_id: payId,
        purchase_id: pur.purchase_id,
        user_id: user?.uid || null,
        payment_date: date,
        amount: a.amount,
        payment_method: method,
        cheque_number: method === 'Cheque' ? cheque.trim() : null
      }, 'supplier_payment_id');

      const newPaid = round2(purchasePaid(pur.purchase_id) + a.amount);
      const newPayStatus = paymentStatusOf(pur.total_amount, newPaid);
      const newPurchaseStatus = purchaseStatusOf(
        { ...pur, payment_status: newPayStatus },
        data.supplier_deliveries
      );
      await update('purchases', pur._docId, {
        payment_status: newPayStatus,
        purchase_status: newPurchaseStatus
      });

      await writeAudit({
        user,
        actionType: 'PAYMENT',
        recordType: 'Payment',
        recordId: fmtSuppPayId(payId),
        details: {
          summary: `Recorded ${peso(a.amount)} payment on ${fmtPurchaseId(pur.purchase_id)} (${method})`,
          purchase_id: pur.purchase_id,
          amount: a.amount,
          method,
          cheque_number: method === 'Cheque' ? cheque.trim() : null,
          payment_date: date,
          new_purchase_payment_status: newPayStatus,
        },
      });

      await refresh();
      setRecordPurchaseId(null);
      showToast(`Payment ${fmtSuppPayId(payId)} recorded — purchase is ${newPayStatus} ✓`);
    } catch (err) {
      console.error(err); showToast(err.message);
    } finally {
      setPayBusy(false);
    }
  };

  const detailPurchase = detailPurchaseId ? purchaseById(detailPurchaseId) : null;
  const recordPurchase = recordPurchaseId ? purchaseById(recordPurchaseId) : null;

  return (
    <>
      <Topbar title="Supplier Payments" />

      <Box component="main" sx={style.content}>
        {/* FILTER BAR */}
        <Box sx={style.filterBar}>
          <TextField size="small" placeholder="Search purchase ID, supplier or amount"
            value={sp.search}
            onChange={(e) => setSp((p) => ({ ...p, search: e.target.value, page: 1 }))}
            fullWidth />
          <TextField select size="small" label="Payment Status" value={sp.status}
            onChange={(e) => setSp((p) => ({ ...p, status: e.target.value, page: 1 }))}
            fullWidth>
            <MenuItem value="">All payment statuses</MenuItem>
            {PAYMENT_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Due Status" value={sp.dueStatus}
            onChange={(e) => setSp((p) => ({ ...p, dueStatus: e.target.value, page: 1 }))}
            fullWidth>
            <MenuItem value="">All due statuses</MenuItem>
            <MenuItem value="Due Soon">Due Soon</MenuItem>
            <MenuItem value="Due Today">Due Today</MenuItem>
            <MenuItem value="Overdue">Overdue</MenuItem>
          </TextField>
          <Tooltip title="Clear filters">
            <Button aria-label="Clear filters" sx={{ ...filterChip, width: { xs: '100%', md: 34 }, minWidth: { xs: '100%', md: 34 }, height: 34, p: { xs: '0 12px', md: 0 }, justifySelf: { md: 'end' } }} onClick={clearFilters}>
              <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>Clear Filters</Box>
              <FilterAltOffIcon sx={{ display: { xs: 'none', md: 'inline-flex' } }} />
            </Button>
          </Tooltip>
        </Box>

        {/* DESKTOP & TABLET TABLE */}
        <Box sx={{ display: { xs: 'none', sm: 'block' }, ...style.tableWrap }}>
          <Table sx={style.historyTable}>
            <TableHead>
              <TableRow>
                {SP_COLUMNS.map((c) => {
                  const active = sp.sortKey === c.key;
                  const arrow = active ? (sp.sortDir === 'asc' ? '▲' : '▼') : '↕';
                  return (
                    <TableCell key={c.key} align={c.num ? 'right' : 'left'}
                      aria-sort={active ? (sp.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      onClick={() => onSort(c.key)}
                      sx={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      {c.label}
                      <Box component="span" sx={{ fontSize: 9, ml: '6px', color: active ? TOKENS.hlGoldDark : TOKENS.gray4 }}>{arrow}</Box>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={style.emptyCell}>{allRows.length ? 'No purchases match these filters.' : 'No purchases yet.'}</TableCell>
                </TableRow>
              ) : pageRows.map((p) => (
                <TableRow key={p.purchase_id} hover tabIndex={0} onDoubleClick={() => setDetailPurchaseId(p.purchase_id)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setDetailPurchaseId(p.purchase_id); } }} sx={{ cursor: 'pointer' }}>
                  <TableCell>{fmtPurchaseId(p.purchase_id)}</TableCell>
                  <TableCell>{supplierName(p)}</TableCell>
                  <TableCell>{fmtDate(p.purchase_date)}</TableCell>
                  <TableCell align="right">{peso(p.total_amount)}</TableCell>
                  <TableCell align="right">{peso(purchasePaid(p.purchase_id))}</TableCell>
                  <TableCell align="right">{peso(purchaseBalance(p))}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'inline-flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <Chip label={purchasePayStatus(p)} color={COLOR_MAP[purchasePayStatus(p)] || 'default'} size="small" />
                      {purchaseOverdue(p) && <Chip label={purchaseOverdue(p)} color={purchaseOverdue(p) === 'Overdue' ? 'error' : purchaseOverdue(p) === 'Due Today' ? 'warning' : 'info'} size="small" />}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        {/* MOBILE CARDS */}
        <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 2 }}>
          {pageRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: TOKENS.gray5 }}>No purchases match these filters.</Box>
          ) : pageRows.map((p) => (
            <Card
              key={p.purchase_id}
              variant="outlined"
              onClick={() => setDetailPurchaseId(p.purchase_id)}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetailPurchaseId(p.purchase_id);
                }
              }}
              sx={{
                borderRadius: 2,
                cursor: 'pointer',
                '&:focus-visible': { outline: `3px solid ${TOKENS.hlBlueDark}`, outlineOffset: '2px' }
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box>
                    <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: TOKENS.hlBlueDark }}>{fmtPurchaseId(p.purchase_id)}</Typography>
                    <Typography sx={{ fontSize: 12, color: TOKENS.gray5, mt: 0.5 }}>{fmtDate(p.purchase_date)}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Box sx={{ display: 'inline-flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <Chip label={purchasePayStatus(p)} color={COLOR_MAP[purchasePayStatus(p)] || 'default'} size="small" />
                      {purchaseOverdue(p) && <Chip label={purchaseOverdue(p)} color={purchaseOverdue(p) === 'Overdue' ? 'error' : purchaseOverdue(p) === 'Due Today' ? 'warning' : 'info'} size="small" />}
                    </Box>
                  </Box>
                </Box>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.gray5, letterSpacing: 0.5 }}>Supplier</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{supplierName(p)}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: 11, color: TOKENS.gray5 }}>Balance</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: TOKENS.hlBlueDark }}>{peso(purchaseBalance(p))}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Typography sx={style.tableHint}>
          Double-click a row to view the payment details, payment history and record a payment.
        </Typography>

        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPrev={() => setSp((p) => ({ ...p, page: safePage - 1 }))}
          onNext={() => setSp((p) => ({ ...p, page: safePage + 1 }))}
          info={sorted.length
            ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + pageRows.length} of ${sorted.length} purchase${sorted.length === 1 ? '' : 's'}`
            : '0 purchases'}
        />
      </Box>

      <DetailModal
        open={!!detailPurchase}
        title={detailPurchase ? 'Payment Details — ' + fmtPurchaseId(detailPurchase.purchase_id) : ''}
        onClose={() => setDetailPurchaseId(null)}
      >
        {detailPurchase && <SupplierPaymentDetails purchase={detailPurchase} onRecord={() => openRecord(detailPurchase.purchase_id)} />}
      </DetailModal>

      {recordPurchase && (
        <Modal
          open
          title={'Record Payment — ' + fmtPurchaseId(recordPurchase.purchase_id)}
          onClose={() => setRecordPurchaseId(null)}
          onConfirm={saveRecord}
          confirmLabel="Save payment"
          confirmationTitle="Confirm supplier payment"
          confirmationMessage="Record this payment against the supplier purchase balance?"
          confirmationLabel="Record payment"
          width="form"
        >
          <RecordSupplierPaymentBody purchase={recordPurchase} draft={recordDraft} setDraft={setRecordDraft} />
        </Modal>
      )}
    </>
  );
}

function SupplierPaymentDetails({ purchase, onRecord }) {
  const { data, supplierById } = useData();
  const paid = round2(data.supplier_payments
    .filter((p) => p.purchase_id === purchase.purchase_id)
    .reduce((s, p) => s + p.amount, 0));
  const balance = round2(purchase.total_amount - paid);
  const payments = data.supplier_payments
    .filter((p) => p.purchase_id === purchase.purchase_id)
    .sort((a, b) => a.payment_date.localeCompare(b.payment_date) || a.supplier_payment_id - b.supplier_payment_id);
  const canRecord = purchase.purchase_status !== 'Cancelled' && balance > 0;
  const overdue = isPurchaseOverdue(purchase, data.supplier_payments);

  return (
    <Box>
      <Typography sx={style.sectionTitle}>Purchase information</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 2, mb: 2 }}>
        <Info label="Purchase ID" value={fmtPurchaseId(purchase.purchase_id)} />
        <Info label="Supplier" value={supplierById(purchase.supplier_id)?.supplier_name || '—'} />
        <Info label="Purchase Date" value={fmtDate(purchase.purchase_date)} />
        <Info label="Due Date" value={fmtDate(purchase.due_date)} />
        <Info label="Purchase Status" value={<Chip label={purchase.purchase_status} color={COLOR_MAP[purchase.purchase_status] || 'default'} size="small" />} />
      </Box>

      <Typography sx={style.sectionTitle}>Payment summary</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 2, mb: 2 }}>
        <Info label="Total Amount" value={peso(purchase.total_amount)} />
        <Info label="Amount Paid" value={peso(paid)} />
        <Info label="Remaining Balance" value={<strong>{peso(balance)}</strong>} />
        <Info label="Payment Status" value={<Box sx={{ display: 'inline-flex', gap: 0.5, flexWrap: 'wrap' }}>
          <Chip label={purchase.payment_status} color={COLOR_MAP[purchase.payment_status] || 'default'} size="small" />
          {overdue && <Chip label={overdue} color={overdue === 'Overdue' ? 'error' : overdue === 'Due Today' ? 'warning' : 'info'} size="small" />}
        </Box>} />
      </Box>

      <Box sx={style.sectionTitleWithAction}>
        <span>Payment history</span>
        {canRecord && (
          <Button size="small" variant="contained" startIcon={<PaymentsOutlinedIcon />} onClick={onRecord}>
            Record Payment
          </Button>
        )}
      </Box>

      <Box sx={style.detailTable}>
        <Table size="small" sx={style.detailTableInner}>
          <TableHead>
            <TableRow>
              <TableCell>Payment Date</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Payment Method</TableCell>
              <TableCell>Cheque No.</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow><TableCell colSpan={4} sx={style.emptyCell}>No payments made yet.</TableCell></TableRow>
            ) : payments.map((p) => (
              <TableRow key={p.supplier_payment_id}>
                <TableCell>{fmtDate(p.payment_date)}</TableCell>
                <TableCell align="right">{peso(p.amount)}</TableCell>
                <TableCell>{p.payment_method}</TableCell>
                <TableCell>{p.cheque_number || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {!canRecord && (
        <Typography sx={style.note}>
          {purchase.purchase_status === 'Cancelled'
            ? 'This purchase was cancelled, so it can’t be paid.'
            : 'This purchase is fully paid.'}
        </Typography>
      )}
    </Box>
  );
}

function RecordSupplierPaymentBody({ purchase, draft, setDraft }) {
  const { data, supplierById } = useData();
  const paid = round2(data.supplier_payments
    .filter((p) => p.purchase_id === purchase.purchase_id)
    .reduce((s, p) => s + p.amount, 0));
  const balance = round2(purchase.total_amount - paid);

  return (
    <Box>
      <Box sx={style.paySummary}>
        <Info label="Purchase ID" value={fmtPurchaseId(purchase.purchase_id)} />
        <Info label="Supplier" value={supplierById(purchase.supplier_id)?.supplier_name || '—'} />
        <Info label="Total Amount" value={peso(purchase.total_amount)} />
        <Info label="Amount Paid" value={peso(paid)} />
        <Info label="Remaining Balance" value={<strong>{peso(balance)}</strong>} />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, pt: 1 }}>
        <Field label={draft.method === 'Cheque' ? 'Cheque Due Date' : 'Payment Date'}>
          <TextField fullWidth size="small" type="date"
            inputProps={{ min: purchase.purchase_date, max: draft.method === 'Cheque' ? purchase.due_date : todayIso() }}
            value={draft.method === 'Cheque' ? purchase.due_date : draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            disabled={draft.method === 'Cheque'}
          />
        </Field>

        <Field label="Amount">
          <TextField fullWidth size="small" type="number"
            inputProps={{ min: 0, max: balance, step: 0.01 }}
            helperText={`Up to ${peso(balance)} (the remaining balance).`}
            value={draft.amount}
            onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))} />
        </Field>

        <Field label="Payment Method">
          <TextField select fullWidth size="small"
            value={draft.method}
            onChange={(e) => setDraft((d) => ({
              ...d,
              method: e.target.value,
              date: e.target.value === 'Cheque' ? purchase.due_date : (d.method === 'Cheque' ? todayIso() : d.date)
            }))}>
            <MenuItem value="">Select payment method</MenuItem>
            {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
        </Field>

        {draft.method === 'Cheque' && (
          <Field label="Cheque Number">
            <TextField fullWidth size="small"
              value={draft.cheque}
              onChange={(e) => setDraft((d) => ({ ...d, cheque: e.target.value }))} />
          </Field>
        )}

      </Box>
    </Box>
  );
}

const Info = ({ label, value }) => (
  <Box>
    <Typography sx={style.infoLabel}>{label}</Typography>
    <Typography sx={style.infoValue}>{value}</Typography>
  </Box>
);