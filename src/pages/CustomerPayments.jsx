import React, { useEffect, useMemo, useState } from 'react';
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
import PaymentStatusBadges from '../components/PaymentStatusBadges';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import style from '../styles/PaymentsStyles';
import { TOKENS, filterChip } from '../styles/HomeLineStyles';
import {
  PAGE_SIZE, PAYMENT_STATUSES, PAYMENT_METHODS,
  PAYMENT_CONFIRMATION_PENDING_LABEL, saleBalance, paymentStatusOf, saleStatusOf, parsePayAmount, isValidTermNumber,
  saleDueStatus
} from '../utils/businessRules';
import {
  peso, fmtDate, fmtSaleId, fmtCustPayId, round2, todayIso, isRealDate
} from '../utils/format';
import { writeAudit } from '../utils/auditHelpers';
import { collection, doc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const COLOR_MAP = {
  Active: 'warning', Completed: 'success', Cancelled: 'default',
  Unpaid: 'default', 'Partially Paid': 'warning', 'Fully Paid': 'success',
  Paid: 'success'
};

const CP_DEFAULT = { search: '', status: '', dueStatus: '', sortKey: 'date', sortDir: 'desc', page: 1 };

const CP_COLUMNS = [
  { key: 'id', label: 'Sale ID' },
  { key: 'party', label: 'Customer' },
  { key: 'date', label: 'Sale Date' },
  { key: 'total', label: 'Total Amount', num: true },
  { key: 'paid', label: 'Amount Paid', num: true },
  { key: 'balance', label: 'Balance', num: true },
  { key: 'status', label: 'Payment Status' }
];

const PAY_STATUS_RANK = (s) => PAYMENT_STATUSES.indexOf(s);

export default function CustomerPayments() {
  const { data, refresh, saleById, saleCustomerName } = useData();
  const { user } = useAuth();
  const showToast = useToast();

  const [cp, setCp] = useState({ ...CP_DEFAULT });
  const [detailSaleId, setDetailSaleId] = useState(null);
  const [recordSaleId, setRecordSaleId] = useState(null);
  const [recordDraft, setRecordDraft] = useState({
    term_id: '', date: todayIso(), amount: '', method: ''
  });
  const [payBusy, setPayBusy] = useState(false);

  const allRows = useMemo(() => data.sales.filter((s) => s.sale_status !== 'Cancelled'), [data.sales]);

  const filtered = useMemo(() => {
    const q = cp.search.trim().toLowerCase();
    return allRows.filter((s) => {
      if (cp.status && s.payment_status !== cp.status) return false;
      if (cp.dueStatus && saleDueStatus(s, data.payment_terms, data.customer_payments) !== cp.dueStatus) return false;
      if (!q) return true;
      const hay = [
        fmtSaleId(s.sale_id), saleCustomerName(s), fmtDate(s.sale_date), s.sale_date,
        s.payment_status,
        s.payment_confirmation?.status, s.payment_confirmation?.payment_method,
        String(s.payment_confirmation?.amount ?? ''),
        String(s.total_amount), peso(s.total_amount),
        String(s.amount_paid), peso(s.amount_paid),
        String(saleBalance(s)), peso(saleBalance(s))
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [allRows, cp.search, cp.status, cp.dueStatus, saleCustomerName, data.payment_terms, data.customer_payments]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let r = 0;
      switch (cp.sortKey) {
        case 'id': r = a.sale_id - b.sale_id; break;
        case 'party': r = saleCustomerName(a).localeCompare(saleCustomerName(b)); break;
        case 'date': r = a.sale_date.localeCompare(b.sale_date); break;
        case 'total': r = a.total_amount - b.total_amount; break;
        case 'paid': r = a.amount_paid - b.amount_paid; break;
        case 'balance': r = saleBalance(a) - saleBalance(b); break;
        case 'status': r = PAY_STATUS_RANK(a.payment_status) - PAY_STATUS_RANK(b.payment_status); break;
      }
      if (r === 0) r = a.sale_id - b.sale_id;
      return cp.sortDir === 'asc' ? r : -r;
    });
    return arr;
  }, [filtered, cp.sortKey, cp.sortDir, saleCustomerName]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, cp.page), totalPages);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const onSort = (key) => setCp((p) => ({
    ...p, sortKey: key,
    sortDir: p.sortKey === key && p.sortDir === 'asc' ? 'desc'
      : (p.sortKey === key ? 'asc'
        : (['date', 'total', 'paid', 'balance'].includes(key) ? 'desc' : 'asc')),
    page: 1
  }));

  const clearFilters = () => setCp({ ...CP_DEFAULT });

  const openRecord = (saleId) => {
    const sale = saleById(saleId);
    if (!sale) return;
    if (sale.sale_status === 'Cancelled') { showToast('A cancelled sale can’t receive payments'); return; }
    if (sale.payment_confirmation?.status === 'Pending Confirmation') {
      showToast('Confirm this transfer from Sales History.');
      return;
    }
    if (!(saleBalance(sale) > 0)) { showToast('This sale has no remaining balance'); return; }
    setRecordSaleId(saleId);
    setRecordDraft({
      term_id: '',
      date: todayIso(),
      amount: '',
      method: ''
    });
    setPayBusy(false);
  };

  const saveRecord = async () => {
    if (payBusy) return;
    const sale = saleById(recordSaleId);
    if (!sale) return;
    if (sale.sale_status === 'Cancelled') { showToast('A cancelled sale can’t receive payments'); return; }
    if (sale.payment_confirmation?.status === 'Pending Confirmation') {
      showToast('Confirm this transfer from Sales History.');
      setRecordSaleId(null);
      return;
    }
    const balance = saleBalance(sale);
    if (!(balance > 0)) { showToast('This sale has no remaining balance'); return; }

    const { term_id, date, amount: amountRaw, method } = recordDraft;
    const fail = (msg) => showToast(msg);
    if (!date) return fail('Choose a payment date');
    if (!isRealDate(date)) return fail('Enter a valid payment date');
    if (date > todayIso()) return fail('Payment date can’t be in the future');
    if (date < sale.sale_date) return fail('Payment date can’t be before the sale date');
    const a = parsePayAmount(amountRaw, balance, 'the remaining balance');
    if (a.error) return fail(a.error);
    if (!PAYMENT_METHODS.includes(method)) return fail('Choose a payment method');

    let termId = null;
    if (term_id) {
      const term = data.payment_terms.find((t) => t.payment_term_id === Number(term_id));
      if (!term || term.sale_id !== sale.sale_id) return fail('That payment term doesn’t belong to this sale');
      termId = term.payment_term_id;
      const termPaid = round2(data.customer_payments
        .filter((p) => p.payment_term_id === termId)
        .reduce((s, p) => s + p.amount, 0));
      const termLeft = round2(term.amount_due - termPaid);
      if (a.amount > termLeft) return fail(`That term only has ${peso(termLeft)} left. Choose None for the extra amount.`);
    }

    setPayBusy(true);
    try {
      if (!sale._docId) throw new Error('Could not find the Firestore record for this sale. Refresh and try again.');
      const paymentQuerySnap = await getDocs(query(
        collection(db, 'customer_payments'),
        where('sale_id', '==', sale.sale_id)
      ));
      const saleDeliveryQuerySnap = await getDocs(query(
        collection(db, 'customer_deliveries'),
        where('sale_id', '==', sale.sale_id)
      ));
      const paymentResult = await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', sale._docId);
        const term = termId
          ? data.payment_terms.find((item) => item.payment_term_id === termId)
          : null;
        if (termId && (!term?._docId || term.sale_id !== sale.sale_id)) {
          throw new Error('That payment term no longer belongs to this sale.');
        }
        const termRef = term ? doc(db, 'payment_terms', term._docId) : null;
        const currentPaymentRefs = paymentQuerySnap.docs.map((payment) => payment.ref);
        const [saleSnap, currentPayments, deliverySnaps, termSnap] = await Promise.all([
          transaction.get(saleRef),
          Promise.all(currentPaymentRefs.map((ref) => transaction.get(ref))),
          Promise.all(saleDeliveryQuerySnap.docs.map((delivery) => transaction.get(delivery.ref))),
          termRef ? transaction.get(termRef) : Promise.resolve(null)
        ]);
        if (!saleSnap.exists()) throw new Error('Sale record no longer exists.');
        const currentSale = saleSnap.data();
        if (currentSale.sale_status === 'Cancelled') {
          throw new Error('A cancelled sale can’t receive payments.');
        }
        if (currentSale.payment_confirmation?.status === 'Pending Confirmation') {
          throw new Error('This transfer must be confirmed from Sales History.');
        }

        const recordedTotal = currentPayments.reduce((sum, payment) =>
          sum + (Number(payment.data()?.amount) || 0), 0);
        const paidBefore = Math.max(Number(currentSale.amount_paid) || 0, recordedTotal);
        const currentBalance = round2(Number(currentSale.total_amount) - paidBefore);
        if (!(currentBalance > 0)) throw new Error('This sale has no remaining balance.');
        if (a.amount > currentBalance) {
          throw new Error(`Payment exceeds the remaining balance of ${peso(currentBalance)}.`);
        }
        const newPaid = round2(paidBefore + a.amount);
        const newPayStatus = paymentStatusOf(Number(currentSale.total_amount), newPaid);
        let newTermStatus = null;
        let newTermPaid = null;
        if (term && termSnap?.exists()) {
          const priorTermPaid = Number.isFinite(Number(termSnap.data().amount_paid))
            ? Number(termSnap.data().amount_paid)
            : currentPayments.reduce((sum, payment) => {
              const paymentData = payment.data() || {};
              return sum + (Number(paymentData.payment_term_id) === termId
                ? Number(paymentData.amount) || 0
                : 0);
            }, 0);
          newTermPaid = round2(priorTermPaid + (termId ? a.amount : 0));
          if (newTermPaid > round2(Number(termSnap.data().amount_due))) {
            throw new Error(`That term only has ${peso(round2(Number(termSnap.data().amount_due) - priorTermPaid))} left.`);
          }
          newTermStatus = newTermPaid <= 0 ? 'Unpaid'
            : (newTermPaid < round2(Number(termSnap.data().amount_due)) ? 'Partially Paid' : 'Paid');
        } else if (termId) {
          throw new Error('That payment term no longer exists.');
        }

        const currentDeliveries = deliverySnaps.map((delivery) => delivery.data());
        const newSaleStatus = saleStatusOf({
          ...currentSale,
          amount_paid: newPaid,
          payment_status: newPayStatus
        }, currentDeliveries);

        let payId = data.customer_payments.reduce((max, payment) =>
          Math.max(max, Number(payment.customer_payment_id) || 0), 0) + 1;
        let newPaymentRef = null;
        for (let attempt = 0; attempt < 100; attempt += 1, payId += 1) {
          const candidate = doc(db, 'customer_payments', String(payId));
          if (!(await transaction.get(candidate)).exists()) {
            newPaymentRef = candidate;
            break;
          }
        }
        if (!newPaymentRef) throw new Error('Could not allocate a payment ID. Refresh and try again.');

        transaction.set(newPaymentRef, {
          customer_payment_id: payId,
          sale_id: sale.sale_id,
          payment_term_id: termId,
          user_id: user?.uid || null,
          payment_date: date,
          amount: a.amount,
          payment_method: method,
        });
        transaction.update(saleRef, {
          amount_paid: newPaid,
          payment_status: newPayStatus,
          sale_status: newSaleStatus
        });
        if (termRef && newTermStatus) {
          transaction.update(termRef, { status: newTermStatus, amount_paid: newTermPaid });
        }
        return { paymentRef: newPaymentRef, paymentStatus: newPayStatus };
      });

      await writeAudit({
        user,
        actionType: 'PAYMENT',
        recordType: 'Payment',
        recordId: fmtCustPayId(Number(paymentResult.paymentRef.id)),
        details: {
          summary: `Recorded ${peso(a.amount)} payment on ${fmtSaleId(sale.sale_id)} (${method})`,
          sale_id: sale.sale_id,
          amount: a.amount,
          method,
          payment_date: date,
          new_sale_payment_status: paymentResult.paymentStatus,
        },
      });

      await refresh();
      setRecordSaleId(null);
      showToast(`Payment ${fmtCustPayId(Number(paymentResult.paymentRef.id))} recorded — sale is ${paymentResult.paymentStatus} ✓`);
    } catch (err) {
      console.error(err); showToast(err.message);
    } finally {
      setPayBusy(false);
    }
  };

  const detailSale = detailSaleId ? saleById(detailSaleId) : null;
  const recordSale = recordSaleId ? saleById(recordSaleId) : null;

  useEffect(() => {
    if (recordSale?.payment_confirmation?.status === 'Pending Confirmation') {
      setRecordSaleId(null);
    }
  }, [recordSale]);

  return (
    <>
      <Topbar title="Customer Payments" />

      <Box component="main" sx={style.content}>
        {/* FILTER BAR */}
        <Box sx={style.filterBar}>
          <TextField size="small" placeholder="Search sale ID, customer, amount or payment method"
            value={cp.search}
            onChange={(e) => setCp((p) => ({ ...p, search: e.target.value, page: 1 }))}
            fullWidth />
          <TextField select size="small" label="Payment Status" value={cp.status}
            onChange={(e) => setCp((p) => ({ ...p, status: e.target.value, page: 1 }))}
            fullWidth>
            <MenuItem value="">All payment statuses</MenuItem>
            {PAYMENT_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Due Status" value={cp.dueStatus}
            onChange={(e) => setCp((p) => ({ ...p, dueStatus: e.target.value, page: 1 }))}
            fullWidth>
            <MenuItem value="">All due statuses</MenuItem>
            <MenuItem value="Overdue">Overdue</MenuItem>
            <MenuItem value="Due Today">Due Today</MenuItem>
            <MenuItem value="Due Soon">Due Soon</MenuItem>
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
                {CP_COLUMNS.map((c) => {
                  const active = cp.sortKey === c.key;
                  const arrow = active ? (cp.sortDir === 'asc' ? '▲' : '▼') : '↕';
                  return (
                    <TableCell key={c.key} align={c.num ? 'right' : 'left'}
                      aria-sort={active ? (cp.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
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
                  <TableCell colSpan={7} sx={style.emptyCell}>{allRows.length ? 'No sales match these filters.' : 'No sales yet.'}</TableCell>
                </TableRow>
              ) : pageRows.map((s) => (
                <TableRow key={s.sale_id} hover tabIndex={0} onDoubleClick={() => setDetailSaleId(s.sale_id)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setDetailSaleId(s.sale_id); } }} sx={{ cursor: 'pointer' }}>
                  <TableCell>{fmtSaleId(s.sale_id)}</TableCell>
                  <TableCell>{saleCustomerName(s)}</TableCell>
                  <TableCell>{fmtDate(s.sale_date)}</TableCell>
                  <TableCell align="right">{peso(s.total_amount)}</TableCell>
                  <TableCell align="right">{peso(s.amount_paid)}</TableCell>
                  <TableCell align="right">{peso(saleBalance(s))}</TableCell>
                  <TableCell><PaymentStatusBadges
                    status={s.payment_status}
                    dueStatus={saleDueStatus(s, data.payment_terms, data.customer_payments)}
                    pendingConfirmation={s.payment_confirmation?.status === 'Pending Confirmation'}
                  /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        {/* MOBILE CARDS */}
        <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 2 }}>
          {pageRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: TOKENS.gray5 }}>No sales match these filters.</Box>
          ) : pageRows.map((s) => (
            <Card
              key={s.sale_id}
              variant="outlined"
              onClick={() => setDetailSaleId(s.sale_id)}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetailSaleId(s.sale_id);
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
                    <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: TOKENS.hlBlueDark }}>{fmtSaleId(s.sale_id)}</Typography>
                    <Typography sx={{ fontSize: 12, color: TOKENS.gray5, mt: 0.5 }}>{fmtDate(s.sale_date)}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <PaymentStatusBadges
                      status={s.payment_status}
                      dueStatus={saleDueStatus(s, data.payment_terms, data.customer_payments)}
                      pendingConfirmation={s.payment_confirmation?.status === 'Pending Confirmation'}
                    />
                  </Box>
                </Box>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.gray5, letterSpacing: 0.5 }}>Customer</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{saleCustomerName(s)}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: 11, color: TOKENS.gray5 }}>Balance</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: TOKENS.hlBlueDark }}>{peso(saleBalance(s))}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Typography sx={style.tableHint}>
          Double-click a row to view payment details and history. Confirm pending transfers from Sales History.
        </Typography>

        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPrev={() => setCp((p) => ({ ...p, page: safePage - 1 }))}
          onNext={() => setCp((p) => ({ ...p, page: safePage + 1 }))}
          info={sorted.length
            ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + pageRows.length} of ${sorted.length} sale${sorted.length === 1 ? '' : 's'}`
            : '0 sales'}
        />
      </Box>

      <DetailModal
        open={!!detailSale}
        title={detailSale ? 'Payment Details — ' + fmtSaleId(detailSale.sale_id) : ''}
        onClose={() => setDetailSaleId(null)}
      >
        {detailSale && <PaymentDetails sale={detailSale} onRecord={() => openRecord(detailSale.sale_id)} />}
      </DetailModal>

      {recordSale && (
        recordSale.payment_confirmation?.status !== 'Pending Confirmation' && <Modal
          open
          title={`Record Payment — ${fmtSaleId(recordSale.sale_id)}`}
          onClose={() => setRecordSaleId(null)}
          onConfirm={saveRecord}
          confirmLabel="Save payment"
          confirmationTitle="Confirm customer payment"
          confirmationMessage="Record this payment against the customer’s balance?"
          confirmationLabel="Record payment"
          width="form"
        >
          <RecordPaymentBody sale={recordSale} draft={recordDraft} setDraft={setRecordDraft} />
        </Modal>
      )}
    </>
  );
}

function PaymentDetails({ sale, onRecord }) {
  const { data, saleCustomerName } = useData();
  const balance = saleBalance(sale);
  const payments = data.customer_payments
    .filter((p) => p.sale_id === sale.sale_id)
    .sort((a, b) => a.payment_date.localeCompare(b.payment_date) || a.customer_payment_id - b.customer_payment_id);
  const terms = data.payment_terms
    .filter((t) => t.sale_id === sale.sale_id)
    .sort((a, b) => (a.term_number || 0) - (b.term_number || 0));
  const pendingConfirmation = sale.payment_confirmation?.status === 'Pending Confirmation';
  const canRecord = sale.sale_status !== 'Cancelled' && balance > 0 && !pendingConfirmation;

  return (
    <Box>
      <Typography sx={style.sectionTitle}>Sale information</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 2, mb: 2 }}>
        <Info label="Sale ID" value={fmtSaleId(sale.sale_id)} />
        <Info label="Customer" value={saleCustomerName(sale)} />
        <Info label="Sale Type" value={sale.sale_type} />
        <Info label="Sale Date" value={fmtDate(sale.sale_date)} />
        <Info label="Sale Status" value={<Chip label={sale.sale_status} color={COLOR_MAP[sale.sale_status] || 'default'} size="small" />} />
      </Box>

      <Typography sx={style.sectionTitle}>Payment summary</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 2, mb: 2 }}>
        <Info label="Total Amount" value={peso(sale.total_amount)} />
        <Info label="Amount Paid" value={peso(sale.amount_paid)} />
        <Info label="Remaining Balance" value={<strong>{peso(balance)}</strong>} />
        <Info label="Payment Status" value={<PaymentStatusBadges
          status={sale.payment_status}
          dueStatus={saleDueStatus(sale, data.payment_terms, data.customer_payments)}
          pendingConfirmation={sale.payment_confirmation?.status === 'Pending Confirmation'}
        />} />
        {sale.payment_confirmation && (
          <Info
            label="Payment Confirmation"
            value={`${sale.payment_confirmation.payment_method} — ${sale.payment_confirmation.status === 'Pending Confirmation'
              ? PAYMENT_CONFIRMATION_PENDING_LABEL
              : sale.payment_confirmation.status} (${peso(sale.payment_confirmation.amount)})`}
          />
        )}
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
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow><TableCell colSpan={3} sx={style.emptyCell}>No payments received yet.</TableCell></TableRow>
            ) : payments.map((p) => (
              <TableRow key={p.customer_payment_id}>
                <TableCell>{fmtDate(p.payment_date)}</TableCell>
                <TableCell align="right">{peso(p.amount)}</TableCell>
                <TableCell>{p.payment_method}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {terms.length > 0 && (
        <>
          <Typography sx={style.sectionTitle}>Payment schedule</Typography>
          <Box sx={style.detailTable}>
            <Table size="small" sx={style.detailTableInner}>
              <TableHead>
                <TableRow>
                  <TableCell>Term</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell align="right">Amount Due</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {terms.map((t) => (
                  <TableRow key={t.payment_term_id}>
                    <TableCell>{isValidTermNumber(t.term_number) ? 'Term ' + t.term_number : 'Term —'}</TableCell>
                    <TableCell>{fmtDate(t.due_date)}</TableCell>
                    <TableCell align="right">{peso(t.amount_due)}</TableCell>
                    <TableCell><Chip label={t.status} color={COLOR_MAP[t.status] || 'default'} size="small" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </>
      )}

      {!canRecord && (
        <Typography sx={style.note}>
          {sale.sale_status === 'Cancelled'
            ? 'This sale was cancelled, so it can’t receive payments.'
            : pendingConfirmation
              ? 'Confirm the pending transfer from Sales History before recording other payments.'
              : 'This sale is fully paid.'}
        </Typography>
      )}
    </Box>
  );
}

function RecordPaymentBody({ sale, draft, setDraft }) {
  const { data, saleCustomerName } = useData();
  const balance = saleBalance(sale);
  const openTerms = data.payment_terms
    .filter((t) => t.sale_id === sale.sale_id && t.status !== 'Paid')
    .sort((a, b) => (a.term_number || 0) - (b.term_number || 0));
  return (
    <Box>
      <Box sx={style.paySummary}>
        <Info label="Sale ID" value={fmtSaleId(sale.sale_id)} />
        <Info label="Customer" value={saleCustomerName(sale)} />
        <Info label="Total Amount" value={peso(sale.total_amount)} />
        <Info label="Amount Paid" value={peso(sale.amount_paid)} />
        <Info label="Remaining Balance" value={<strong>{peso(balance)}</strong>} />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, pt: 1 }}>
        <Field label="Payment Term (optional)">
          <TextField select fullWidth size="small"
            value={draft.term_id}
            disabled={openTerms.length === 0}
            onChange={(e) => setDraft((d) => ({ ...d, term_id: e.target.value }))}
            helperText={openTerms.length ? 'Leave as None if this payment isn’t for a scheduled term.' : 'This sale has no unpaid payment terms.'}>
            <MenuItem value="">None</MenuItem>
            {openTerms.map((t) => (
              <MenuItem key={t.payment_term_id} value={t.payment_term_id}>
                {isValidTermNumber(t.term_number) ? 'Term ' + t.term_number : 'Term —'}
                {' — Due '}{fmtDate(t.due_date)}{' — '}{peso(t.amount_due)}{' ('}{t.status}{')'}
              </MenuItem>
            ))}
          </TextField>
        </Field>

        <Field label="Payment Date">
          <TextField fullWidth size="small" type="date"
            inputProps={{ min: sale.sale_date, max: todayIso() }}
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
        </Field>

        <Field label="Amount">
          <TextField fullWidth size="small" type="number"
            inputProps={{ min: 0.01, max: balance, step: 0.01 }}
            helperText={`Up to ${peso(balance)} (the remaining balance).`}
            value={draft.amount}
            onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))} />
        </Field>

        <Field label="Payment Method">
          <TextField select fullWidth size="small"
            value={draft.method}
            onChange={(e) => setDraft((d) => ({ ...d, method: e.target.value }))}>
            <MenuItem value="">Select payment method</MenuItem>
            {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
        </Field>
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