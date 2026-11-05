import React, { useMemo, useRef, useState } from 'react';
import {
  Alert, Box, TextField, MenuItem, Button, Table, TableHead, TableBody, Tooltip,
  TableRow, TableCell, Typography, Card, CardContent, Divider
} from '@mui/material';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import Topbar from '../components/Topbar';
import Pagination from '../components/Pagination';
import DetailModal from '../components/DetailModal';
import Modal from '../components/Modal';
import DateField from '../components/DateField';
import SaleDetails from '../components/SaleDetails';
import StatusBadge from '../components/StatusBadge';
import StatusText from '../components/StatusText';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useAudit } from '../utils/useAudit';
import style from '../styles/SalesHistoryStyles';
import { TOKENS, filterChip, actionChip } from '../styles/HomeLineStyles';
import {
  PAGE_SIZE, PAYMENT_STATUSES, DELIVERY_STATUSES, DELIVERY_NOT_APPLICABLE,
  PAYMENT_CONFIRMATION_PENDING_LABEL, SALE_STATUSES, saleCancelBlockReason, paymentStatusOf, saleStatusOf,
  saleDueStatus, customerDeliveryStatusForDisplay, stockStatusOf
} from '../utils/businessRules';
import { peso, fmtDate, fmtTime, fmtSaleId, fmtCustPayId, isoDate, todayIso, round2 } from '../utils/format';
import { generateSaleReceipt } from '../utils/pdfReport';
import { collection, doc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const SH_DEFAULT = { search: '', paymentStatus: '', dueStatus: '', delivery: '', from: '', to: '', sortKey: 'date', sortDir: 'desc', page: 1 };

export default function SalesHistory() {
  const {
    data, refresh,
    saleById, customerById, productById, saleDetailsOf,
    saleCustomerName
  } = useData();
  const showToast = useToast();
  const log = useAudit();
  const { isAdmin, user } = useAuth();
  const cancellingRef = useRef(new Set());
  const confirmingPaymentRef = useRef(new Set());
  const [confirmingPaymentId, setConfirmingPaymentId] = useState(null);
  const [paymentBusy, setPaymentBusy] = useState(false);

  const [sh, setSh] = useState({ ...SH_DEFAULT });
  const [detailId, setDetailId] = useState(null);
  const [cancelId, setCancelId] = useState(null);
  const [confirmPaymentId, setConfirmPaymentId] = useState(null);

  const SH_COLUMNS = useMemo(() => {
    const cols = [
      { key: 'id', label: 'Sale ID' },
      { key: 'customer', label: 'Customer' },
      { key: 'date', label: 'Date & Time' },
    ];
    if (isAdmin) cols.push({ key: 'payment', label: 'Payment' });
    cols.push({ key: 'total', label: 'Total Amount', num: true });
    cols.push(isAdmin
      ? { key: 'status', label: 'Sale Status' }
      : { key: 'payment', label: 'Status' });
    return cols;
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = sh.search.trim().toLowerCase();
    return data.sales.filter((s) => {
      if (q) {
        const c = s.customer_id ? customerById(s.customer_id) : null;
        const paymentMethods = data.customer_payments
          .filter((payment) => payment.sale_id === s.sale_id)
          .map((payment) => payment.payment_method || '');
        const hay = [
          fmtSaleId(s.sale_id), saleCustomerName(s), c ? c.contact_number : '',
          s.payment_confirmation?.payment_method || '',
          ...paymentMethods
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (!isAdmin && sh.paymentStatus === 'Cancelled') {
        if (s.sale_status !== 'Cancelled') return false;
      } else if (sh.paymentStatus === 'Pending Confirmation') {
        if (s.payment_confirmation?.status !== 'Pending Confirmation') return false;
      } else if (PAYMENT_STATUSES.includes(sh.paymentStatus) && s.payment_status !== sh.paymentStatus) {
        return false;
      }
      if (isAdmin && sh.dueStatus
        && saleDueStatus(s, data.payment_terms, data.customer_payments) !== sh.dueStatus) {
        return false;
      }
      const deliveryStatus = customerDeliveryStatusForDisplay(s, data.customer_deliveries);
      if (sh.delivery && deliveryStatus !== sh.delivery) return false;
      if (sh.from && s.sale_date < sh.from) return false;
      if (sh.to && s.sale_date > sh.to) return false;
      return true;
    });
  }, [data.sales, data.payment_terms, data.customer_payments, data.customer_deliveries, sh, customerById, saleCustomerName, isAdmin]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let r = 0;
      switch (sh.sortKey) {
        case 'id': r = a.sale_id - b.sale_id; break;
        case 'customer': r = saleCustomerName(a).localeCompare(saleCustomerName(b)); break;
        case 'date': r = (a.sale_date + ' ' + a.sale_time).localeCompare(b.sale_date + ' ' + b.sale_time); break;
        case 'total': r = a.total_amount - b.total_amount; break;
        case 'payment': r = PAYMENT_STATUSES.indexOf(a.payment_status) - PAYMENT_STATUSES.indexOf(b.payment_status); break;
        case 'status': r = SALE_STATUSES.indexOf(a.sale_status) - SALE_STATUSES.indexOf(b.sale_status); break;
      }
      if (r === 0) r = a.sale_id - b.sale_id;
      return sh.sortDir === 'asc' ? r : -r;
    });
    return arr;
  }, [filtered, sh.sortKey, sh.sortDir, saleCustomerName]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, sh.page), totalPages);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const onSort = (key) => setSh((p) => ({
    ...p, sortKey: key,
    sortDir: p.sortKey === key && p.sortDir === 'asc' ? 'desc' : 'asc',
    page: 1
  }));
  const goto = (page) => setSh((p) => ({ ...p, page }));
  const clearFilters = () => setSh({ ...SH_DEFAULT });

  const openCancel = (saleId) => {
    const s = saleById(saleId);
    if (!s) return;
    const pendingTransfer = s.payment_confirmation?.status === 'Pending Confirmation';
    if (!isAdmin && !pendingTransfer) return;
    const reason = saleCancelBlockReason(s, data.customer_payments, data.customer_deliveries);
    if (reason) { showToast(reason); return; }
    setCancelId(saleId);
  };

  const cancelSale = async (saleId) => {
    const s = saleById(saleId);
    if (!s) return;
    if (cancellingRef.current.has(saleId)) return;
    if (!isAdmin && s.payment_confirmation?.status !== 'Pending Confirmation') {
      showToast('Staff can only cancel sales with an unconfirmed GCash or Bank Transfer.');
      return;
    }
    cancellingRef.current.add(saleId);

    if (!s._docId) {
      cancellingRef.current.delete(saleId);
      showToast('Could not find the Firestore record for this sale. Refresh and try again.');
      return;
    }
    const saleRef = doc(db, 'sales', s._docId);
    const today = isoDate(new Date());
    try {
      const [paymentsQuerySnap, deliveriesQuerySnap, detailsQuerySnap] = await Promise.all([
        getDocs(query(collection(db, 'customer_payments'), where('sale_id', '==', saleId))),
        getDocs(query(collection(db, 'customer_deliveries'), where('sale_id', '==', saleId))),
        getDocs(query(collection(db, 'sale_details'), where('sale_id', '==', saleId)))
      ]);
      const productIds = [...new Set(detailsQuerySnap.docs
        .map((line) => Number(line.data().product_id))
        .filter(Number.isInteger))];
      const inventoryQuerySnaps = await Promise.all(productIds.map((productId) => getDocs(query(
        collection(db, 'inventory'),
        where('product_id', '==', productId)
      ))));

      const result = await runTransaction(db, async (transaction) => {
        const [saleSnap, paymentSnaps, deliverySnaps, detailSnaps, inventorySnaps] = await Promise.all([
          transaction.get(saleRef),
          Promise.all(paymentsQuerySnap.docs.map((payment) => transaction.get(payment.ref))),
          Promise.all(deliveriesQuerySnap.docs.map((delivery) => transaction.get(delivery.ref))),
          Promise.all(detailsQuerySnap.docs.map((line) => transaction.get(line.ref))),
          Promise.all(inventoryQuerySnaps.flatMap((inventorySnap) =>
            inventorySnap.docs.map((inventory) => transaction.get(inventory.ref))
          ))
        ]);

        if (!saleSnap.exists()) throw new Error('Sale record no longer exists');
        const currentSale = saleSnap.data();
        if (!isAdmin && currentSale.payment_confirmation?.status !== 'Pending Confirmation') {
          throw new Error('Staff can only cancel sales with an unconfirmed GCash or Bank Transfer.');
        }
        const payments = paymentSnaps.map((payment) => payment.data());
        const deliveries = deliverySnaps.map((delivery) => ({
          _docId: delivery.ref.id,
          ...delivery.data()
        }));
        const blocked = saleCancelBlockReason(currentSale, payments, deliveries);
        if (blocked) throw new Error(blocked);

        const lines = detailSnaps.map((line) => line.data());
        if (!lines.length) throw new Error('Can’t cancel a sale with no items');
        const quantities = new Map();
        lines.forEach((line) => {
          const productId = Number(line.product_id);
          const quantity = Number(line.quantity);
          if (!Number.isInteger(productId) || !Number.isFinite(quantity) || quantity <= 0) {
            throw new Error('Sale contains an invalid product quantity');
          }
          quantities.set(productId, (quantities.get(productId) || 0) + quantity);
        });

        const inventoryUpdates = [];
        [...quantities.keys()].forEach((productId) => {
          const queryIndex = productIds.indexOf(productId);
          const inventoryDocs = inventoryQuerySnaps[queryIndex]?.docs || [];
          if (inventoryDocs.length !== 1) {
            throw new Error(`Can’t cancel: expected one inventory record for product ${productId}`);
          }
          const inventoryRef = inventoryDocs[0].ref;
          const inventorySnapshot = inventorySnaps.find((snapshot) =>
            snapshot.ref.path === inventoryRef.path
          );
          if (!inventorySnapshot?.exists()) {
            throw new Error(`Inventory record for product ${productId} no longer exists`);
          }
          const inventory = inventorySnapshot.data();
          const currentQty = Number(inventory.quantity_on_hand);
          const newQty = round2(currentQty + quantities.get(productId));
          if (!Number.isFinite(currentQty) || !Number.isFinite(newQty)) {
            throw new Error('Inventory has an invalid stock quantity');
          }
          inventoryUpdates.push({
            ref: inventoryRef,
            quantity_on_hand: newQty,
            stock_status: stockStatusOf(newQty, Number(inventory.reorder_level) || 0),
            last_updated: today
          });
        });

        inventoryUpdates.forEach(({ ref, ...stock }) => transaction.update(ref, stock));
        deliveries
          .filter((delivery) => ['Pending', 'Checked'].includes(delivery.delivery_status))
          .forEach((delivery) => transaction.update(
            doc(db, 'customer_deliveries', delivery._docId),
            { delivery_status: 'Cancelled' }
          ));
        transaction.update(saleRef, {
          sale_status: 'Cancelled',
          ...(currentSale.payment_confirmation?.status === 'Pending Confirmation' ? {
            payment_confirmation: {
              ...currentSale.payment_confirmation,
              status: 'Cancelled',
              cancelled_date: today,
              cancelled_by: user?.uid || null
            }
          } : {})
        });
        return { totalAmount: currentSale.total_amount };
      });

      await refresh();
      await log('CANCEL', 'Sale', fmtSaleId(saleId), {
        summary: `Cancelled sale ${fmtSaleId(saleId)} — stock restored`,
        sale_id: saleId,
        total_amount: result.totalAmount,
        reason: 'User cancelled',
      });
      setCancelId(null);
      showToast('Sale ' + fmtSaleId(saleId) + ' cancelled — stock restored');
    } catch (err) {
      console.error('Sale cancellation failed:', err);
      showToast(err.message || 'Could not cancel sale');
    } finally {
      cancellingRef.current.delete(saleId);
    }
  };

  const confirmPendingPayment = async (saleId) => {
    if (paymentBusy || confirmingPaymentRef.current.size > 0) return;
    const sale = saleById(saleId);
    if (!sale?._docId) {
      showToast('Could not find the Firestore record for this sale. Refresh and try again.');
      return;
    }
    confirmingPaymentRef.current.add(saleId);
    setConfirmingPaymentId(saleId);
    setPaymentBusy(true);

    try {
      const pending = sale.payment_confirmation;
      if (sale.sale_status === 'Cancelled') {
        throw new Error('A cancelled sale can’t receive payments.');
      }
      if (pending?.status !== 'Pending Confirmation') {
        throw new Error('This sale has no payment awaiting confirmation.');
      }
      const amount = round2(Number(pending.amount));
      if (!(amount > 0) || !['GCash', 'Bank Transfer'].includes(pending.payment_method)) {
        throw new Error('The pending transfer details are invalid. Refresh and review the sale.');
      }

      const [paymentsQuerySnap, deliveryQuerySnap] = await Promise.all([
        getDocs(query(collection(db, 'customer_payments'), where('sale_id', '==', saleId))),
        getDocs(query(collection(db, 'customer_deliveries'), where('sale_id', '==', saleId)))
      ]);
      const paymentDate = todayIso();
      const result = await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', sale._docId);
        const [saleSnap, paymentSnaps, deliverySnaps] = await Promise.all([
          transaction.get(saleRef),
          Promise.all(paymentsQuerySnap.docs.map((payment) => transaction.get(payment.ref))),
          Promise.all(deliveryQuerySnap.docs.map((delivery) => transaction.get(delivery.ref)))
        ]);
        if (!saleSnap.exists()) throw new Error('Sale record no longer exists.');
        const currentSale = saleSnap.data();
        if (currentSale.sale_status === 'Cancelled') {
          throw new Error('A cancelled sale can’t receive payments.');
        }
        const currentPending = currentSale.payment_confirmation;
        if (currentPending?.status !== 'Pending Confirmation') {
          throw new Error('This transfer has already been confirmed or is no longer pending.');
        }
        if (round2(Number(currentPending.amount)) !== amount
          || currentPending.payment_method !== pending.payment_method) {
          throw new Error('The pending transfer details changed. Refresh and review the sale.');
        }

        const recordedTotal = paymentSnaps.reduce((sum, payment) =>
          sum + (Number(payment.data()?.amount) || 0), 0);
        const paidBefore = Math.max(Number(currentSale.amount_paid) || 0, recordedTotal);
        const balance = round2(Number(currentSale.total_amount) - paidBefore);
        if (amount > balance) {
          throw new Error(`Pending payment exceeds the remaining balance of ${peso(balance)}.`);
        }
        const amountPaid = round2(paidBefore + amount);
        const paymentStatus = paymentStatusOf(Number(currentSale.total_amount), amountPaid);
        const deliveries = deliverySnaps.map((delivery) => delivery.data());
        const saleStatus = saleStatusOf({
          ...currentSale,
          amount_paid: amountPaid,
          payment_status: paymentStatus
        }, deliveries);

        let paymentId = data.customer_payments.reduce((max, payment) =>
          Math.max(max, Number(payment.customer_payment_id) || 0), 0) + 1;
        let paymentRef = null;
        for (let attempt = 0; attempt < 100; attempt += 1, paymentId += 1) {
          const candidate = doc(db, 'customer_payments', String(paymentId));
          if (!(await transaction.get(candidate)).exists()) {
            paymentRef = candidate;
            break;
          }
        }
        if (!paymentRef) throw new Error('Could not allocate a payment ID. Refresh and try again.');

        transaction.set(paymentRef, {
          customer_payment_id: paymentId,
          sale_id: saleId,
          payment_term_id: null,
          user_id: user?.uid || null,
          payment_date: paymentDate,
          amount,
          payment_method: pending.payment_method
        });
        transaction.update(saleRef, {
          amount_paid: amountPaid,
          payment_status: paymentStatus,
          sale_status: saleStatus,
          payment_confirmation: {
            ...currentPending,
            status: 'Confirmed',
            confirmed_date: paymentDate,
            confirmed_by: user?.uid || null
          }
        });
        return { paymentId, paymentStatus };
      });

      await refresh();
      await log('PAYMENT', 'Payment', fmtCustPayId(result.paymentId), {
        summary: `Confirmed ${peso(amount)} ${pending.payment_method} payment on ${fmtSaleId(saleId)}`,
        sale_id: saleId,
        amount,
        method: pending.payment_method,
        payment_date: paymentDate,
        new_sale_payment_status: result.paymentStatus
      });
      setConfirmPaymentId(null);
      showToast(`${pending.payment_method} payment confirmed — sale is ${result.paymentStatus} ✓`);
    } catch (err) {
      console.error('Payment confirmation failed:', err);
      showToast(err.message || 'Could not confirm payment');
    } finally {
      confirmingPaymentRef.current.delete(saleId);
      setConfirmingPaymentId(null);
      setPaymentBusy(false);
    }
  };

  const detailSale = detailId ? saleById(detailId) : null;
  const cancelSaleObj = cancelId ? saleById(cancelId) : null;
  const confirmPaymentSale = confirmPaymentId ? saleById(confirmPaymentId) : null;

  const generateReceipt = async (sale) => {
    try {
      const lines = saleDetailsOf(sale.sale_id);
      await generateSaleReceipt({
        sale,
        customer: customerById(sale.customer_id),
        lines,
        products: new Map(lines.map((line) => [Number(line.product_id), productById(line.product_id)])),
        payments: data.customer_payments.filter((payment) => payment.sale_id === sale.sale_id),
        delivery: data.customer_deliveries.find((item) => item.sale_id === sale.sale_id) || null,
      });
      showToast('Receipt PDF downloaded');
    } catch (err) {
      console.error('Sale receipt failed:', err);
      showToast('Could not generate the sale receipt');
    }
  };

  return (
    <>
      <Topbar title="Sales History" />

      <Box component="main" sx={style.content}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: isAdmin
              ? 'minmax(120px, 1fr) repeat(3, minmax(120px, auto)) repeat(2, minmax(130px, auto)) 40px'
              : 'minmax(120px, 1fr) repeat(2, minmax(120px, auto)) repeat(2, minmax(130px, auto)) 40px'
          },
          gap: 2,
          mb: 3,
          alignItems: 'center'
        }}>
          <TextField size="small" placeholder="Search sale ID, customer or payment method"
            value={sh.search}
            onChange={(e) => setSh((p) => ({ ...p, search: e.target.value, page: 1 }))}
            fullWidth />
          <TextField select size="small" label={isAdmin ? 'Payment Status' : 'Status'} value={sh.paymentStatus}
            onChange={(e) => setSh((p) => ({ ...p, paymentStatus: e.target.value, page: 1 }))}
            sx={{ minWidth: { xs: '100%', sm: 140 } }}>
            <MenuItem value="">{isAdmin ? 'All payment statuses' : 'All statuses'}</MenuItem>
            {!isAdmin && <MenuItem value="Cancelled">Cancelled</MenuItem>}
            <MenuItem value="Pending Confirmation">{PAYMENT_CONFIRMATION_PENDING_LABEL}</MenuItem>
            {PAYMENT_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          {isAdmin && <TextField select size="small" label="Due Status" value={sh.dueStatus}
            onChange={(e) => setSh((p) => ({ ...p, dueStatus: e.target.value, page: 1 }))}
            sx={{ minWidth: { xs: '100%', sm: 140 } }}>
            <MenuItem value="">All due statuses</MenuItem>
            <MenuItem value="Overdue">Overdue</MenuItem>
            <MenuItem value="Due Today">Due Today</MenuItem>
            <MenuItem value="Due Soon">Due Soon</MenuItem>
          </TextField>}
          <TextField select size="small" label="Delivery" value={sh.delivery}
            onChange={(e) => setSh((p) => ({ ...p, delivery: e.target.value, page: 1 }))}
            sx={{ minWidth: { xs: '100%', sm: 140 } }}>
            <MenuItem value="">All delivery</MenuItem>
            {[...DELIVERY_STATUSES, DELIVERY_NOT_APPLICABLE].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            <MenuItem value="Overdue">Overdue</MenuItem>
            <MenuItem value="Due Today">Due Today</MenuItem>
            <MenuItem value="Due Soon">Due Soon</MenuItem>
          </TextField>
          <DateField label="From" value={sh.from}
            onChange={(e) => setSh((p) => ({ ...p, from: e.target.value, page: 1 }))} />
          <DateField label="To" value={sh.to}
            onChange={(e) => setSh((p) => ({ ...p, to: e.target.value, page: 1 }))} />
          <Tooltip title="Clear filters">
            <Button aria-label="Clear filters" sx={{ ...filterChip, width: { xs: '100%', sm: 40 }, minWidth: { xs: '100%', sm: 40 }, height: 40, p: { xs: '0 16px', sm: 0 }, justifySelf: { sm: 'end' } }} onClick={clearFilters}>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Clear Filters</Box>
              <FilterAltOffIcon sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
            </Button>
          </Tooltip>
        </Box>

        <Box sx={{ display: { xs: 'none', sm: 'block' }, ...style.tableWrap }}>
          <Table sx={{ ...style.historyTable, minWidth: isAdmin ? 1000 : 850 }}>
            <TableHead>
              <TableRow>
                {SH_COLUMNS.map((c) => {
                  const active = sh.sortKey === c.key;
                  const arrow = active ? (sh.sortDir === 'asc' ? '▲' : '▼') : '↕';
                  const columnStyle = {
                    id: style.idCol,
                    customer: style.customerCol,
                    date: style.dateCol,
                    payment: style.paymentCol,
                    total: style.totalCol,
                    status: style.statusCol
                  }[c.key];
                  return (
                    <TableCell key={c.key} align={c.num ? 'right' : 'left'}
                      aria-sort={active ? (sh.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      sx={{
                        ...columnStyle,
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                      onClick={() => onSort(c.key)}>
                      {c.label}
                      <Box component="span" sx={{ fontSize: 9, ml: '6px', color: active ? TOKENS.hlGoldDark : TOKENS.gray4 }}>{arrow}</Box>
                    </TableCell>
                  );
                })}
                <TableCell sx={style.actionsCol}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={SH_COLUMNS.length + 1} sx={style.emptyCell}>
                    No sales match these filters.{' '}
                    <Button sx={{ ...filterChip, ml: 1 }} startIcon={<FilterAltOffIcon />} onClick={clearFilters}>Clear Filters</Button>
                  </TableCell>
                </TableRow>
              ) : pageRows.map((s) => {
                const paymentConfirmationPending = s.payment_confirmation?.status === 'Pending Confirmation';
                const hasCancel = s.sale_status === 'Active'
                  && (isAdmin || paymentConfirmationPending);
                const reason = hasCancel ? saleCancelBlockReason(s, data.customer_payments, data.customer_deliveries) : '';
                const overdue = isAdmin && saleDueStatus(s, data.payment_terms, data.customer_payments);
                return (
                  <TableRow key={s.sale_id} hover tabIndex={0}
                    onDoubleClick={() => setDetailId(s.sale_id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setDetailId(s.sale_id); } }}
                    sx={{ cursor: 'pointer' }}>
                    <TableCell sx={style.idCol}>{fmtSaleId(s.sale_id)}</TableCell>
                    <TableCell sx={style.customerCol}>{saleCustomerName(s)}</TableCell>
                    <TableCell sx={style.dateCol}>
                      {fmtDate(s.sale_date)}
                      <br />
                      <Box component="span" sx={{ fontSize: '10px', color: TOKENS.gray5 }}>
                        {fmtTime(s.sale_time)}
                      </Box>
                    </TableCell>
                    {isAdmin && (
                      <TableCell sx={style.paymentCol}>
                        <StatusText status={s.payment_status} />
                        {paymentConfirmationPending && <> <StatusText status={PAYMENT_CONFIRMATION_PENDING_LABEL} /></>}
                        {overdue && <><Box component="span" sx={{ mx: 0.5, color: TOKENS.gray4 }}>·</Box><StatusText status={overdue} /></>}
                      </TableCell>
                    )}
                    <TableCell align="right" sx={style.totalCol}>{peso(s.total_amount)}</TableCell>
                    {isAdmin ? (
                      <TableCell sx={style.statusCol}>
                        <StatusBadge status={s.sale_status} />
                      </TableCell>
                    ) : (
                      <TableCell sx={style.paymentCol}>
                        {s.sale_status === 'Cancelled'
                          ? <StatusText status="Cancelled" />
                          : <>
                            <StatusText status={s.payment_status} />
                            {paymentConfirmationPending && <> <StatusText status={PAYMENT_CONFIRMATION_PENDING_LABEL} /></>}
                          </>}
                      </TableCell>
                    )}
                    <TableCell sx={style.actionsCell}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                        {paymentConfirmationPending && (
                          <Button
                            sx={actionChip}
                            size="small"
                            startIcon={<PaymentsOutlinedIcon />}
                            disabled={paymentBusy}
                            onClick={(e) => { e.stopPropagation(); setConfirmPaymentId(s.sale_id); }}
                          >
                            {confirmingPaymentId === s.sale_id ? 'Confirming…' : 'Confirm'}
                          </Button>
                        )}
                        {hasCancel && (reason
                          ? <Button sx={actionChip} disabled title={reason} startIcon={<CancelOutlinedIcon />}>Cancel</Button>
                          : <Button sx={actionChip} startIcon={<CancelOutlinedIcon />} onClick={(e) => { e.stopPropagation(); openCancel(s.sale_id); }}>Cancel</Button>)}
                      </Box>
                      {!paymentConfirmationPending && !hasCancel && '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>

        <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 2 }}>
          {pageRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: TOKENS.gray5 }}>No sales match these filters.</Box>
          ) : pageRows.map((s) => {
            const overdue = isAdmin && saleDueStatus(s, data.payment_terms, data.customer_payments);
            const paymentConfirmationPending = s.payment_confirmation?.status === 'Pending Confirmation';
            const hasCancel = s.sale_status === 'Active'
              && (isAdmin || paymentConfirmationPending);
            const reason = hasCancel ? saleCancelBlockReason(s, data.customer_payments, data.customer_deliveries) : '';

            return (
              <Card
                key={s.sale_id}
                variant="outlined"
                onClick={() => setDetailId(s.sale_id)}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDetailId(s.sale_id);
                  }
                }}
                sx={{
                  borderRadius: 2,
                  cursor: 'pointer',
                  '&:focus-visible': { outline: `3px solid ${TOKENS.hlBlueDark}`, outlineOffset: '2px' }
                }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: TOKENS.hlBlueDark }}>
                        {fmtSaleId(s.sale_id)}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: TOKENS.gray5, mt: 0.5 }}>
                        {fmtDate(s.sale_date)} · {fmtTime(s.sale_time)}
                      </Typography>
                      <Box sx={{ mt: 0.75 }}>
                          <Typography component="span" sx={{ fontSize: 10.5, color: TOKENS.gray5, mr: 0.5 }}>
                            {s.sale_status === 'Cancelled' ? 'Status:' : 'Payment:'}
                          </Typography>
                          {s.sale_status === 'Cancelled'
                            ? <StatusText status="Cancelled" />
                            : <>
                              <StatusText status={s.payment_status} />
                              {paymentConfirmationPending && <> <StatusText status={PAYMENT_CONFIRMATION_PENDING_LABEL} /></>}
                              {overdue && <><Typography component="span" sx={{ mx: 0.5, color: TOKENS.gray4 }}>·</Typography><StatusText status={overdue} /></>}
                            </>}
                      </Box>
                    </Box>
                    <Box sx={{ minWidth: 0, textAlign: 'right', ml: 'auto' }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 15, color: TOKENS.hlBlueDark }}>{peso(s.total_amount)}</Typography>
                      <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${TOKENS.lineSoft}` }}>
                        <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.gray5, letterSpacing: 0.5, mb: 0.5 }}>
                          {isAdmin ? 'Sale Status' : 'Status'}
                        </Typography>
                        {isAdmin
                          ? <StatusBadge status={s.sale_status} />
                          : s.sale_status === 'Cancelled'
                            ? <StatusText status="Cancelled" />
                            : <StatusText status={s.payment_status} />}
                      </Box>
                    </Box>
                  </Box>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ minWidth: 0, flex: '1 1 140px' }}>
                      <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.gray5, letterSpacing: 0.5 }}>Customer</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 500, overflowWrap: 'anywhere' }}>{saleCustomerName(s)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {paymentConfirmationPending && (
                        <Button
                          size="small"
                          sx={{ ...actionChip, flexShrink: 0 }}
                          startIcon={<PaymentsOutlinedIcon />}
                          disabled={paymentBusy}
                          onClick={(e) => { e.stopPropagation(); setConfirmPaymentId(s.sale_id); }}
                        >
                          {confirmingPaymentId === s.sale_id ? 'Confirming…' : 'Confirm'}
                        </Button>
                      )}
                      {hasCancel && (
                        <Button size="small" sx={{ ...actionChip, flexShrink: 0 }} startIcon={<CancelOutlinedIcon />} disabled={!!reason} onClick={(e) => { e.stopPropagation(); openCancel(s.sale_id); }}>Cancel</Button>
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>

        <Typography sx={style.tableHint}>Double-click a row (or tap a card) to view the full sale.</Typography>

        <Pagination page={safePage} totalPages={totalPages} onPrev={() => goto(safePage - 1)} onNext={() => goto(safePage + 1)}
          info={sorted.length ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + pageRows.length} of ${sorted.length} sale${sorted.length === 1 ? '' : 's'}` : '0 sales'} />
      </Box>

      <DetailModal
        open={!!detailSale}
        title={detailSale ? 'Sale ' + fmtSaleId(detailSale.sale_id) : ''}
        actions={detailSale && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {detailSale.payment_confirmation?.status === 'Pending Confirmation' && (
              <Button
                size="small"
                variant="contained"
                startIcon={<PaymentsOutlinedIcon />}
                disabled={paymentBusy}
                onClick={() => setConfirmPaymentId(detailSale.sale_id)}
              >
                Confirm
              </Button>
            )}
            <Button size="small" variant="outlined" startIcon={<ReceiptLongIcon />}
              onClick={() => generateReceipt(detailSale)}>
              Generate Receipt
            </Button>
          </Box>
        )}
        onClose={() => setDetailId(null)}
      >
        {detailSale && (
          <SaleDetails sale={detailSale} />
        )}
      </DetailModal>

      {confirmPaymentSale && (
        <Modal
          open
          title="Confirm transfer receipt"
          onClose={() => setConfirmPaymentId(null)}
          onConfirm={() => confirmPendingPayment(confirmPaymentSale.sale_id)}
          confirmLabel={paymentBusy ? 'Confirming…' : 'Confirm receipt'}
          width="narrow"
        >
          <Alert severity="warning" sx={{ mb: 2 }}>
            {confirmPaymentSale.payment_confirmation?.payment_method} — {peso(confirmPaymentSale.payment_confirmation?.amount)}
          </Alert>
          <Typography sx={{ fontSize: 13, lineHeight: 1.6 }}>
            Confirm only after verifying that this transfer was received. Once confirmed, it will be recorded as a payment for sale {fmtSaleId(confirmPaymentSale.sale_id)}.
          </Typography>
        </Modal>
      )}

      {cancelSaleObj && (isAdmin || cancelSaleObj.payment_confirmation?.status === 'Pending Confirmation') && (
        <Modal open title={'Cancel sale ' + fmtSaleId(cancelSaleObj.sale_id) + '?'} onClose={() => setCancelId(null)} onConfirm={() => cancelSale(cancelSaleObj.sale_id)} confirmLabel="Yes, cancel sale" width="form">
          <Typography sx={style.cancelIntro}>
            {cancelSaleObj.payment_confirmation?.status === 'Pending Confirmation'
              ? `Cancel the unconfirmed ${cancelSaleObj.payment_confirmation.payment_method} payment and this sale? The reserved items will be returned to stock.`
              : 'Are you sure you want to cancel this sale?'}
          </Typography>
          <Box sx={{ mb: 1.75 }}>
            <Typography sx={style.infoLabel}>Customer</Typography>
            <Typography sx={style.infoValue}>{saleCustomerName(cancelSaleObj)}</Typography>
          </Box>
          <Box sx={{ mb: 1.75 }}>
            <Typography sx={style.infoLabel}>Total Amount</Typography>
            <Typography sx={style.infoValue}>{peso(cancelSaleObj.total_amount)}</Typography>
          </Box>
          <Typography sx={style.cancelNote}>The sale stays in Sales History marked Cancelled, and its items go back into stock. This can’t be undone.</Typography>
        </Modal>
      )}
    </>
  );
}