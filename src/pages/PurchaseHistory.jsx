import React, { useMemo, useRef, useState } from 'react';
import {
  Box, TextField, MenuItem, Button, IconButton, Tooltip, Table, TableHead, TableBody,
  TableRow, TableCell, Typography, Chip, Card, CardContent, Divider
} from '@mui/material';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import StatusBadge from '../components/StatusBadge';
import StatusText from '../components/StatusText';
import OperationalStatus from '../components/OperationalStatus';
import Topbar from '../components/Topbar';
import Pagination from '../components/Pagination';
import DetailModal from '../components/DetailModal';
import Modal from '../components/Modal';
import DateField from '../components/DateField';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useAudit } from '../utils/useAudit';
import style from '../styles/PurchaseHistoryStyles';
import { TOKENS, filterChip, actionChip } from '../styles/HomeLineStyles';
import {
  PAGE_SIZE, RECEIVING_DISPLAY_STATUSES, PAYMENT_STATUSES,
  receivingStatusOfPurchase, purchaseCancelBlockReason,
  stockStatusOf, paymentStatusOf, operationalStatusForDisplay,
  scheduledDeliveryDateOf, isPurchaseOverdue, purchaseDueStatus
} from '../utils/businessRules';
import { peso, fmtDate, fmtTime, fmtPurchaseId, todayIso, round2, isRealDate } from '../utils/format';
import {
  collection, deleteField, doc, getDocs, query, runTransaction, where
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { stopRowActivationPropagation } from '../utils/keyboard';

const COLOR_MAP = {
  Active: 'warning', Completed: 'success', Cancelled: 'default',
  Unpaid: 'default', 'Partially Paid': 'warning', 'Fully Paid': 'success',
  Received: 'success', Checked: 'info', Pending: 'warning'
};

const PH_DEFAULT = { search: '', payment: '', receiving: '', from: '', to: '', sortKey: 'date', sortDir: 'desc', page: 1 };

export default function PurchaseHistory() {
  const {
    data, add, update, refresh,
    supplierById, productById, purchaseById
  } = useData();
  const showToast = useToast();
  const log = useAudit();
  const { isAdmin, user } = useAuth();

  const [ph, setPh] = useState({ ...PH_DEFAULT });
  const [detailId, setDetailId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [modalStep, setModalStep] = useState('details'); // 'details' or 'warning'
  const [checkingId, setCheckingId] = useState(null);
  const receivingRef = useRef(new Set());
  const [checkConfirmId, setCheckConfirmId] = useState(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [dueDate, setDueDate] = useState('');

  const staffRows = useMemo(() => {
    return data.purchase_staff_view
      .filter((p) => p.purchase_status !== 'Cancelled')
      .map((p) => ({
        _key: p.purchase_id,
        purchase_id: p.purchase_id,
        purchase_date: p.purchase_date,
        purchase_time: p.purchase_time,
        supplier: p.supplier_name || '—',
        items: p.item_count ?? 0,
        receiving_status: p.receiving_status || 'Pending',
        scheduled_delivery_date: p.scheduled_delivery_date || null,
        purchase_status: p.purchase_status || 'Active',
      }));
  }, [data.purchase_staff_view]);

  const adminRows = useMemo(() => data.purchases, [data.purchases]);

  const sourceRows = isAdmin ? adminRows : staffRows;

  const filtered = useMemo(() => {
    const q = ph.search.trim().toLowerCase();
    return sourceRows.filter((p) => {
      if (q) {
        const supName = isAdmin
          ? (supplierById(p.supplier_id)?.supplier_name.toLowerCase() || '')
          : (p.supplier || '').toLowerCase();
        if (!fmtPurchaseId(p.purchase_id).toLowerCase().includes(q) && !supName.includes(q)) return false;
      }
      if (isAdmin) {
        if (ph.payment && p.payment_status !== ph.payment) return false;
        const delivery = data.supplier_deliveries.find((d) => d.purchase_id === p.purchase_id);
        const status = receivingStatusOfPurchase(p.purchase_id, data.supplier_deliveries);
        if (ph.receiving && operationalStatusForDisplay(status, scheduledDeliveryDateOf(delivery, status)) !== ph.receiving) return false;
      } else {
        const status = p.receiving_status || 'Pending';
        if (ph.receiving && operationalStatusForDisplay(status, scheduledDeliveryDateOf(p, status)) !== ph.receiving) return false;
      }
      if (ph.from && p.purchase_date < ph.from) return false;
      if (ph.to && p.purchase_date > ph.to) return false;
      return true;
    });
  }, [sourceRows, isAdmin, data.supplier_deliveries, ph, supplierById]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let r = 0;
      switch (ph.sortKey) {
        case 'id': r = a.purchase_id - b.purchase_id; break;
        case 'supplier': {
          const an = isAdmin ? (supplierById(a.supplier_id)?.supplier_name || '') : a.supplier;
          const bn = isAdmin ? (supplierById(b.supplier_id)?.supplier_name || '') : b.supplier;
          r = an.localeCompare(bn);
          break;
        }
        case 'date': r = (a.purchase_date + ' ' + (a.purchase_time || '')).localeCompare(b.purchase_date + ' ' + (b.purchase_time || '')); break;
        case 'total': if (isAdmin) r = a.total_amount - b.total_amount; break;
        case 'payment': if (isAdmin) r = PAYMENT_STATUSES.indexOf(a.payment_status) - PAYMENT_STATUSES.indexOf(b.payment_status); break;
        case 'receiving': {
          const ar = isAdmin ? receivingStatusOfPurchase(a.purchase_id, data.supplier_deliveries) : a.receiving_status;
          const br = isAdmin ? receivingStatusOfPurchase(b.purchase_id, data.supplier_deliveries) : b.receiving_status;
          const aDelivery = isAdmin ? data.supplier_deliveries.find((d) => d.purchase_id === a.purchase_id) : a;
          const bDelivery = isAdmin ? data.supplier_deliveries.find((d) => d.purchase_id === b.purchase_id) : b;
          const aDisplay = operationalStatusForDisplay(ar, scheduledDeliveryDateOf(aDelivery, ar));
          const bDisplay = operationalStatusForDisplay(br, scheduledDeliveryDateOf(bDelivery, br));
          r = RECEIVING_DISPLAY_STATUSES.indexOf(aDisplay) - RECEIVING_DISPLAY_STATUSES.indexOf(bDisplay);
          break;
        }
        case 'status': r = a.purchase_status.localeCompare(b.purchase_status); break;
      }
      if (r === 0) r = a.purchase_id - b.purchase_id;
      return ph.sortDir === 'asc' ? r : -r;
    });
    return arr;
  }, [filtered, ph.sortKey, ph.sortDir, supplierById, data.supplier_deliveries, isAdmin]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, ph.page), totalPages);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const onSort = (key) => setPh((p) => ({
    ...p, sortKey: key,
    sortDir: p.sortKey === key && p.sortDir === 'asc' ? 'desc' : 'asc',
    page: 1
  }));
  const clearFilters = () => setPh({ ...PH_DEFAULT });

  const receivePurchase = async (purchaseId, isOverride = false) => {
    const pur = purchaseById(purchaseId);
    if (!pur) return;
    if (receivingRef.current.has(purchaseId)) return;

    const delivery = data.supplier_deliveries.find((d) => d.purchase_id === purchaseId);
    const deliveryId = delivery?.supplier_delivery_id
      ?? data.supplier_deliveries.reduce((m, x) => Math.max(m, x.supplier_delivery_id), 0) + 1;
    const deliveryRef = doc(db, 'supplier_deliveries', delivery?._docId || String(deliveryId));
    const purchaseRef = doc(db, 'purchases', String(purchaseId));
    const staffViewRef = doc(db, 'purchase_staff_view', String(purchaseId));
    const today = todayIso();

    receivingRef.current.add(purchaseId);
    try {
      const [detailsQuerySnap, paymentsQuerySnap] = await Promise.all([
        getDocs(query(collection(db, 'purchase_details'), where('purchase_id', '==', purchaseId))),
        getDocs(query(collection(db, 'supplier_payments'), where('purchase_id', '==', purchaseId)))
      ]);
      const detailProducts = [...new Set(detailsQuerySnap.docs
        .map((line) => Number(line.data().product_id))
        .filter(Number.isInteger))];
      const inventoryQuerySnaps = await Promise.all(detailProducts.map((productId) => getDocs(query(
        collection(db, 'inventory'),
        where('product_id', '==', productId)
      ))));

      const result = await runTransaction(db, async (transaction) => {
        const [
          purchaseSnap,
          deliverySnap,
          detailSnaps,
          paymentSnaps,
          inventorySnaps,
          staffSnap
        ] = await Promise.all([
          transaction.get(purchaseRef),
          transaction.get(deliveryRef),
          Promise.all(detailsQuerySnap.docs.map((line) => transaction.get(line.ref))),
          Promise.all(paymentsQuerySnap.docs.map((payment) => transaction.get(payment.ref))),
          Promise.all(inventoryQuerySnaps.flatMap((inventorySnap) =>
            inventorySnap.docs.map((inventory) => transaction.get(inventory.ref))
          )),
          transaction.get(staffViewRef)
        ]);

        if (!purchaseSnap.exists()) throw new Error('Purchase record no longer exists');
        const currentPurchase = purchaseSnap.data();
        if (currentPurchase.purchase_status === 'Cancelled') throw new Error('A cancelled purchase can’t be received');
        if (deliverySnap.exists() && Number(deliverySnap.data().purchase_id) !== purchaseId) {
          throw new Error('The purchase delivery record does not match this purchase');
        }

        const currentReceivingStatus = deliverySnap.exists()
          ? deliverySnap.data().receiving_status || 'Pending'
          : 'Pending';
        if (currentReceivingStatus === 'Received') throw new Error('This purchase has already been received');
        if (currentReceivingStatus === 'Cancelled') throw new Error('A cancelled purchase can’t be received');
        if (currentReceivingStatus !== 'Pending' && currentReceivingStatus !== 'Checked') {
          throw new Error('This purchase can’t be received from its current status');
        }
        if (currentReceivingStatus === 'Pending' && !isOverride) {
          return { needsCheckWarning: true };
        }

        const lines = detailSnaps.map((line) => line.data());
        if (!lines.length) throw new Error('Can’t receive a purchase with no items');

        const quantities = new Map();
        lines.forEach((line) => {
          const productId = Number(line.product_id);
          const quantity = Number(line.quantity);
          if (!Number.isInteger(productId) || !Number.isFinite(quantity) || quantity <= 0) {
            throw new Error('Purchase contains an invalid product quantity');
          }
          quantities.set(productId, (quantities.get(productId) || 0) + quantity);
        });

        const inventoryUpdates = [];
        [...quantities.keys()].forEach((productId) => {
          const queryIndex = detailProducts.indexOf(productId);
          const inventoryDocs = inventoryQuerySnaps[queryIndex]?.docs || [];
          if (inventoryDocs.length !== 1) {
            const productName = productById(productId)?.product_name || `product ${productId}`;
            throw new Error(`Can’t receive: expected one inventory record for ${productName}`);
          }
          const inventoryRef = inventoryDocs[0].ref;
          const inventorySnapshot = inventorySnaps.find((snapshot) =>
            snapshot.ref.path === inventoryRef.path
          );
          if (!inventorySnapshot?.exists()) {
            throw new Error(`Inventory record for ${productById(productId)?.product_name || productId} no longer exists`);
          }
          const inventory = inventorySnapshot.data();
          const newQty = round2(Number(inventory.quantity_on_hand) + quantities.get(productId));
          if (!Number.isFinite(newQty)) throw new Error('Inventory has an invalid stock quantity');
          inventoryUpdates.push({
            ref: inventoryRef,
            quantity_on_hand: newQty,
            stock_status: stockStatusOf(newQty, Number(inventory.reorder_level) || 0),
            last_updated: today
          });
        });

        const paid = round2(paymentSnaps.reduce((sum, payment) =>
          sum + (Number(payment.data().amount) || 0), 0));
        const paymentStatus = paymentStatusOf(Number(currentPurchase.total_amount) || 0, paid);
        const purchaseStatus = paymentStatus === 'Fully Paid' ? 'Completed' : 'Active';

        inventoryUpdates.forEach(({ ref, ...stock }) => transaction.update(ref, stock));
        if (deliverySnap.exists()) {
          transaction.update(deliveryRef, {
            receiving_status: 'Received',
            actual_delivery_date: today
          });
        } else {
          transaction.set(deliveryRef, {
            supplier_delivery_id: deliveryId,
            purchase_id: purchaseId,
            user_id: user?.uid || null,
            scheduled_delivery_date: null,
            actual_delivery_date: today,
            receiving_status: 'Received'
          });
        }
        transaction.update(purchaseRef, {
          payment_status: paymentStatus,
          purchase_status: purchaseStatus
        });
        if (staffSnap.exists()) {
          transaction.update(staffViewRef, {
            purchase_status: purchaseStatus,
            receiving_status: 'Received',
            actual_delivery_date: today
          });
        }
        return { paymentStatus, purchaseStatus };
      });

      if (result.needsCheckWarning) {
        setModalStep('warning');
        return;
      }

      setEditId(null);
      setModalStep('details');
      setConfirm(null);
      await refresh();
      await log('RECEIVE', 'Purchase', fmtPurchaseId(purchaseId), {
        summary: `Received purchase ${fmtPurchaseId(purchaseId)}${isOverride ? ' (Admin Override)' : ''} — stock updated`,
        purchase_id: purchaseId,
        total_amount: pur.total_amount,
        new_payment_status: result.paymentStatus,
        new_purchase_status: result.purchaseStatus,
        actual_delivery_date: today,
      });
      showToast('Purchase ' + fmtPurchaseId(purchaseId) + ' received — stock updated ✓');
    } catch (err) {
      console.error('Purchase receipt failed:', err);
      showToast(err.message || 'Could not receive purchase');
    } finally {
      receivingRef.current.delete(purchaseId);
    }
  };

  const cancelPurchase = async (purchaseId) => {
    const pur = purchaseById(purchaseId);
    if (!pur) return;
    const purchaseRef = doc(db, 'purchases', String(purchaseId));
    const delivery = data.supplier_deliveries.find((d) => d.purchase_id === purchaseId);
    const deliveryRef = delivery
      ? doc(db, 'supplier_deliveries', delivery._docId)
      : null;
    const staffViewRef = doc(db, 'purchase_staff_view', String(purchaseId));

    try {
      const paymentsQuerySnap = await getDocs(query(
        collection(db, 'supplier_payments'),
        where('purchase_id', '==', purchaseId)
      ));
      const totalAmount = await runTransaction(db, async (transaction) => {
        const [purchaseSnap, paymentSnaps, staffSnap, deliverySnap] = await Promise.all([
          transaction.get(purchaseRef),
          Promise.all(paymentsQuerySnap.docs.map((payment) => transaction.get(payment.ref))),
          transaction.get(staffViewRef),
          deliveryRef ? transaction.get(deliveryRef) : Promise.resolve(null)
        ]);
        if (!purchaseSnap.exists()) throw new Error('Purchase record no longer exists');

        const currentDelivery = deliverySnap?.exists()
          ? { ...deliverySnap.data(), _docId: deliverySnap.id }
          : null;
        const payments = paymentSnaps.map((payment) => payment.data());
        const blocked = purchaseCancelBlockReason(
          purchaseSnap.data(),
          currentDelivery ? [currentDelivery] : [],
          payments
        );
        if (blocked) throw new Error(blocked);

        if (currentDelivery && deliveryRef) {
          transaction.update(deliveryRef, { receiving_status: 'Cancelled' });
        }
        transaction.update(purchaseRef, { purchase_status: 'Cancelled' });
        if (staffSnap.exists()) {
          transaction.update(staffViewRef, {
            purchase_status: 'Cancelled',
            receiving_status: 'Cancelled'
          });
        }
        return purchaseSnap.data().total_amount;
      });

      await refresh();
      await log('CANCEL', 'Purchase', fmtPurchaseId(purchaseId), {
        summary: `Cancelled purchase ${fmtPurchaseId(purchaseId)}`,
        purchase_id: purchaseId,
        total_amount: totalAmount,
        reason: 'User cancelled',
      });
      setConfirm(null);
      setEditId(null);
      showToast('Purchase ' + fmtPurchaseId(purchaseId) + ' cancelled');
    } catch (err) {
      console.error('Purchase cancellation failed:', err);
      showToast(err.message || 'Could not cancel purchase');
    }
  };

  const markChecked = async (purchaseId) => {
    if (checkingId === purchaseId) return;
    setCheckingId(purchaseId);

    try {
      const delivery = data.supplier_deliveries.find((d) => d.purchase_id === purchaseId);
      const staffPurchase = data.purchase_staff_view.find((p) => p.purchase_id === purchaseId);
      if (!isAdmin && !staffPurchase) {
        showToast('Purchase record no longer exists.');
        return;
      }
      if (isAdmin && !delivery) {
        showToast('No delivery record found for this purchase.');
        return;
      }

      const staffViewRef = doc(db, 'purchase_staff_view', String(purchaseId));
      const result = await runTransaction(db, async (transaction) => {
        if (!isAdmin) {
          const staffSnap = await transaction.get(staffViewRef);
          if (!staffSnap.exists()) throw new Error('Purchase record no longer exists.');
          if (staffSnap.data().purchase_status === 'Cancelled') {
            throw new Error('This purchase has already been cancelled.');
          }

          const status = staffSnap.data().receiving_status || 'Pending';
          if (status !== 'Pending' && status !== 'Checked') {
            throw new Error('This purchase is already ' + status.toLowerCase() + '.');
          }
          if (status === 'Pending') {
            transaction.update(staffViewRef, { receiving_status: 'Checked' });
          }
          return status;
        }

        const deliveryRef = doc(db, 'supplier_deliveries', delivery._docId);
        const purchaseRef = doc(db, 'purchases', String(purchaseId));
        const [purchaseSnap, deliverySnap, staffSnap] = await Promise.all([
          transaction.get(purchaseRef),
          transaction.get(deliveryRef),
          transaction.get(staffViewRef)
        ]);
        if (!purchaseSnap.exists()) throw new Error('Purchase record no longer exists.');
        if (!deliverySnap.exists()) throw new Error('Delivery record no longer exists.');
        if (purchaseSnap.data().purchase_status === 'Cancelled') {
          throw new Error('This purchase has already been cancelled.');
        }

        const status = deliverySnap.data().receiving_status || 'Pending';
        if (status !== 'Pending' && status !== 'Checked') {
          throw new Error('This purchase is already ' + status.toLowerCase() + '.');
        }

        if (status === 'Pending') {
          transaction.update(deliveryRef, { receiving_status: 'Checked' });
          if (staffSnap.exists()) {
            transaction.update(staffViewRef, { receiving_status: 'Checked' });
          }
        }
        return status;
      });

      await refresh();
      if (result === 'Pending') {
        await log('CHECK', 'Purchase', fmtPurchaseId(purchaseId), {
          summary: `Marked purchase ${fmtPurchaseId(purchaseId)} as checked`,
          purchase_id: purchaseId,
        });
        showToast('Purchase marked as checked ✓');
      } else {
        showToast('Purchase is already checked ✓');
      }

    } catch (err) {
      console.error('Check failed:', err);
      showToast(err.message || 'Failed to mark as checked.');
    } finally {
      setCheckingId(null);
    }
  };

  const openPurchaseEdit = (purchaseId) => {
    const delivery = data.supplier_deliveries.find((d) => d.purchase_id === purchaseId);
    const purchase = purchaseById(purchaseId);
    setScheduledDate(delivery?.scheduled_delivery_date || delivery?.delivery_date || '');
    setDueDate(purchase?.due_date || '');
    setEditId(purchaseId);
  };

  const saveDueDate = async () => {
    if (!editPurchase || !dueDate) {
      showToast('Choose a due date');
      return;
    }
    if (!isRealDate(dueDate)) {
      showToast('Enter a valid due date');
      return;
    }
    if (editPurchase.purchase_date && dueDate < editPurchase.purchase_date) {
      showToast('Due date can’t be before the purchase date');
      return;
    }
    try {
      await update('purchases', editPurchase._docId || editPurchase.purchase_id, { due_date: dueDate });
      if (data.purchase_staff_view.some((p) => p.purchase_id === editPurchase.purchase_id)) {
        await update('purchase_staff_view', String(editPurchase.purchase_id), { due_date: deleteField() });
      }
      await refresh();
      await log('UPDATE', 'Purchase', fmtPurchaseId(editPurchase.purchase_id), {
        summary: `Updated due date for ${fmtPurchaseId(editPurchase.purchase_id)}`,
        purchase_id: editPurchase.purchase_id,
        due_date: dueDate,
      });
      showToast('Due date updated ✓');
    } catch (err) {
      console.error('Purchase due date update failed:', err);
      showToast(err.message || 'Could not update due date');
    }
  };

  const saveScheduledDate = async () => {
    if (!editPurchase || !scheduledDate) {
      showToast('Choose a scheduled delivery date');
      return;
    }
    if (!isRealDate(scheduledDate)) {
      showToast('Enter a valid scheduled delivery date');
      return;
    }
    if (editPurchase.purchase_date && scheduledDate < editPurchase.purchase_date) {
      showToast('Scheduled delivery date can’t be before the purchase date');
      return;
    }
    try {
      const delivery = data.supplier_deliveries.find((d) => d.purchase_id === editPurchase.purchase_id);
      if (delivery) {
        await update('supplier_deliveries', delivery._docId, {
          scheduled_delivery_date: scheduledDate
        });
      } else {
        const deliveryId = data.supplier_deliveries.reduce((max, d) => Math.max(max, d.supplier_delivery_id), 0) + 1;
        await add('supplier_deliveries', {
          supplier_delivery_id: deliveryId,
          purchase_id: editPurchase.purchase_id,
          user_id: user?.uid || null,
          scheduled_delivery_date: scheduledDate,
          actual_delivery_date: null,
          receiving_status: 'Pending'
        }, 'supplier_delivery_id');
      }
      if (data.purchase_staff_view.some((p) => p.purchase_id === editPurchase.purchase_id)) {
        await update('purchase_staff_view', String(editPurchase.purchase_id), {
          scheduled_delivery_date: scheduledDate
        });
      }
      await refresh();
      await log('UPDATE', 'Purchase', fmtPurchaseId(editPurchase.purchase_id), {
        summary: `Updated scheduled delivery date for ${fmtPurchaseId(editPurchase.purchase_id)}`,
        purchase_id: editPurchase.purchase_id,
        scheduled_delivery_date: scheduledDate,
      });
      showToast('Scheduled delivery date updated ✓');
    } catch (err) {
      console.error('Scheduled supplier delivery date update failed:', err);
      showToast(err.message || 'Could not update scheduled delivery date');
    }
  };

  const detailPurchase = detailId
    ? (isAdmin
      ? purchaseById(detailId)
      : data.purchase_staff_view.find((p) => p.purchase_id === detailId))
    : null;
  const editPurchase = editId ? purchaseById(editId) : null;
  const detailDelivery = detailPurchase
    ? data.supplier_deliveries.find((d) => d.purchase_id === detailPurchase.purchase_id)
    : null;

  return (
    <>
      <Topbar title="Purchase History" />

      <Box component="main" sx={style.content}>
        <Box sx={{
          ...style.filterBar,
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            sm: isAdmin
              ? 'minmax(150px, 1fr) auto auto auto auto auto'
              : 'minmax(150px, 1fr) auto auto auto auto'
          }
        }}>
          <TextField size="small" placeholder="Search purchase ID or supplier"
            value={ph.search}
            onChange={(e) => setPh((p) => ({ ...p, search: e.target.value, page: 1 }))}
            fullWidth />
          {isAdmin && (
            <TextField select size="small" label="Payment Status" value={ph.payment}
              onChange={(e) => setPh((p) => ({ ...p, payment: e.target.value, page: 1 }))}
              sx={{ minWidth: { xs: '100%', sm: 140 } }}>
              <MenuItem value="">All payment</MenuItem>
              {PAYMENT_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          )}
          <TextField select size="small" label="Receiving Status" value={ph.receiving}
            onChange={(e) => setPh((p) => ({ ...p, receiving: e.target.value, page: 1 }))}
            sx={{ minWidth: { xs: '100%', sm: 140 } }}>
            <MenuItem value="">All receiving</MenuItem>
            {RECEIVING_DISPLAY_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <DateField label="From" value={ph.from}
            onChange={(e) => setPh((p) => ({ ...p, from: e.target.value, page: 1 }))} />
          <DateField label="To" value={ph.to}
            onChange={(e) => setPh((p) => ({ ...p, to: e.target.value, page: 1 }))} />
          <Button sx={{ ...filterChip, height: 40, width: { xs: '100%', sm: 'auto' } }} startIcon={<FilterAltOffIcon />} onClick={clearFilters}>
            Clear
          </Button>
        </Box>

        <Box sx={{ display: { xs: 'none', sm: 'block' }, ...style.tableWrap }}>
          <Table sx={{ ...style.historyTable, minWidth: isAdmin ? 1085 : 760 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={style.idCol}>Purchase ID</TableCell>
                <TableCell sx={style.supplierCol}>Supplier</TableCell>
                <TableCell sx={style.dateCol}>Date / Time</TableCell>
                {isAdmin && <TableCell sx={style.paymentCol}>Payment</TableCell>}
                <TableCell sx={style.receivingCol}>Receiving</TableCell>
                {isAdmin && <TableCell align="right" sx={style.totalCol}>Total</TableCell>}
                {isAdmin && <TableCell sx={style.statusCol}>Purchase Status</TableCell>}
                <TableCell sx={style.actionsCol}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 8 : 5} sx={style.emptyCell}>
                    No purchases match these filters.{' '}
                    <Button sx={{ ...filterChip, ml: 1 }} startIcon={<FilterAltOffIcon />} onClick={clearFilters}>Clear Filters</Button>
                  </TableCell>
                </TableRow>
              ) : pageRows.map((p) => {
                const recv = isAdmin ? receivingStatusOfPurchase(p.purchase_id, data.supplier_deliveries) : p.receiving_status;
                const delivery = isAdmin
                  ? data.supplier_deliveries.find((d) => d.purchase_id === p.purchase_id)
                  : p;
                const supplierName = isAdmin ? (supplierById(p.supplier_id)?.supplier_name || '—') : p.supplier;
                const overdue = isAdmin && purchaseDueStatus(p, data.supplier_payments);
                return (
                  <TableRow key={p.purchase_id} hover tabIndex={0}
                    onDoubleClick={() => setDetailId(p.purchase_id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setDetailId(p.purchase_id); } }}
                    sx={{ cursor: 'pointer' }}>
                    <TableCell sx={{ ...style.idCol, fontWeight: 600 }}>{fmtPurchaseId(p.purchase_id)}</TableCell>
                    <TableCell sx={style.supplierCol}>{supplierName}</TableCell>
                    <TableCell sx={style.dateCol}>{fmtDate(p.purchase_date)}<br /><Box component="span" sx={{ fontSize: '10px', color: TOKENS.gray5 }}>{fmtTime(p.purchase_time)}</Box></TableCell>
                    {isAdmin && <TableCell sx={style.paymentCol}>
                      <StatusText status={p.payment_status} />
                      {overdue && <><Box component="span" sx={{ mx: 0.5, color: TOKENS.gray4 }}>·</Box><StatusText status={overdue} /></>}
                    </TableCell>}
                    <TableCell sx={style.receivingCol}>
                      <OperationalStatus
                        variant="text"
                        status={recv}
                        scheduledDate={scheduledDeliveryDateOf(delivery, recv)}
                      />
                    </TableCell>
                    {isAdmin && <TableCell align="right" sx={style.totalCol}>{peso(p.total_amount)}</TableCell>}
                    {isAdmin && <TableCell sx={style.statusCol}><StatusBadge status={p.purchase_status} /></TableCell>}
                    <TableCell sx={style.actionsCell}>
                      {isAdmin ? (
                        <Button
                          size="small"
                          sx={actionChip}
                          startIcon={<EditOutlinedIcon />}
                          onClick={(e) => { e.stopPropagation(); openPurchaseEdit(p.purchase_id); }}
                          onKeyDown={stopRowActivationPropagation}
                          aria-label={`Edit purchase ${fmtPurchaseId(p.purchase_id)}`}
                          disabled={recv === 'Received' || recv === 'Cancelled'}
                          title={recv === 'Received' ? 'Already received' : 'Edit'}
                        >
                          Edit
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          sx={actionChip}
                          startIcon={<FactCheckOutlinedIcon />}
                          disabled={recv !== 'Pending' || checkingId === p.purchase_id}
                          onClick={(e) => { e.stopPropagation(); setCheckConfirmId(p.purchase_id); }}
                        >
                          {checkingId === p.purchase_id
                            ? 'Checking…'
                            : recv === 'Pending' ? 'Mark as Checked' : 'Checked'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>

        <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 2 }}>
          {pageRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: TOKENS.gray5 }}>No purchases match these filters.</Box>
          ) : pageRows.map((p) => {
            const recv = isAdmin ? receivingStatusOfPurchase(p.purchase_id, data.supplier_deliveries) : p.receiving_status;
            const delivery = isAdmin
              ? data.supplier_deliveries.find((d) => d.purchase_id === p.purchase_id)
              : p;
            const supplierName = isAdmin ? (supplierById(p.supplier_id)?.supplier_name || '—') : p.supplier;
            const overdue = isAdmin && purchaseDueStatus(p, data.supplier_payments);
            return (
              <Card
                key={p.purchase_id}
                variant="outlined"
                onClick={() => setDetailId(p.purchase_id)}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDetailId(p.purchase_id);
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
                        {fmtPurchaseId(p.purchase_id)}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: TOKENS.gray5, mt: 0.5 }}>
                        {fmtDate(p.purchase_date)} · {fmtTime(p.purchase_time)}
                      </Typography>
                    </Box>
                    <Box sx={{ minWidth: 0, textAlign: 'right', ml: 'auto' }}>
                      {isAdmin && <Typography sx={{ fontWeight: 700, fontSize: 15, color: TOKENS.hlBlueDark }}>{peso(p.total_amount)}</Typography>}
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {isAdmin && <><StatusText status={p.payment_status} />{overdue && <><Typography component="span" sx={{ mx: 0.5, color: TOKENS.gray4 }}>·</Typography><StatusText status={overdue} /></>}</>}
                      </Box>
                    </Box>
                  </Box>
                  {isAdmin && (
                    <Box sx={{ mb: 1.5, pt: 1, borderTop: `1px solid ${TOKENS.lineSoft}` }}>
                      <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.gray5, letterSpacing: 0.5, mb: 0.5 }}>
                        Purchase Status
                      </Typography>
                      <StatusBadge status={p.purchase_status} />
                    </Box>
                  )}
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ minWidth: 0, flex: '1 1 140px' }}>
                      <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.gray5, letterSpacing: 0.5 }}>Supplier</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 500, overflowWrap: 'anywhere' }}>{supplierName}</Typography>
                      <Box sx={{ mt: 1 }}>
                        <Typography component="span" sx={{ fontSize: 10.5, color: TOKENS.gray5, mr: 0.5 }}>Receiving:</Typography>
                        <OperationalStatus
                          variant="text"
                          status={recv}
                          scheduledDate={scheduledDeliveryDateOf(delivery, recv)}
                        />
                      </Box>
                    </Box>
                    {isAdmin ? (
                      <Button
                        size="small"
                        sx={{ ...actionChip, flexShrink: 0 }}
                        startIcon={<EditOutlinedIcon />}
                        onClick={(e) => { e.stopPropagation(); openPurchaseEdit(p.purchase_id); }}
                        onKeyDown={stopRowActivationPropagation}
                        aria-label={`Edit purchase ${fmtPurchaseId(p.purchase_id)}`}
                        disabled={recv === 'Received' || recv === 'Cancelled'}
                      >
                        Edit
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        sx={actionChip}
                        startIcon={<FactCheckOutlinedIcon />}
                        disabled={recv !== 'Pending' || checkingId === p.purchase_id}
                        onClick={(e) => { e.stopPropagation(); setCheckConfirmId(p.purchase_id); }}
                      >
                        {checkingId === p.purchase_id ? 'Checking…' : 'Mark as Checked'}
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>

        <Typography sx={style.tableHint}>Double-click a row (or tap a card) to view the full purchase.</Typography>

        <Pagination page={safePage} totalPages={totalPages} onPrev={() => setPh((p) => ({ ...p, page: safePage - 1 }))} onNext={() => setPh((p) => ({ ...p, page: safePage + 1 }))}
          info={sorted.length ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + pageRows.length} of ${sorted.length} purchase${sorted.length === 1 ? '' : 's'}` : '0 purchases'} />
      </Box>

      <DetailModal open={!!detailPurchase} title={detailPurchase ? 'Purchase ' + fmtPurchaseId(detailPurchase.purchase_id) : ''} onClose={() => setDetailId(null)}>
        {detailPurchase && (isAdmin
          ? <PurchaseDetails purchase={detailPurchase} />
        : <StaffPurchaseDetails view={detailPurchase} delivery={detailDelivery} />)}
      </DetailModal>

      {/* MAIN EDIT MODAL - Changes layout based on modalStep */}
      {isAdmin && editPurchase && (
        <Modal
          open
          title={modalStep === 'warning' ? 'Mark as Received without staff check?' : 'Edit Purchase — ' + fmtPurchaseId(editPurchase.purchase_id)}
          onClose={() => { setEditId(null); setScheduledDate(''); setDueDate(''); setModalStep('details'); }}
          width="form"
          footerButtonSx={{
            height: { xs: 44, sm: 38 },
            minHeight: { xs: 44, sm: 38 },
            boxSizing: 'border-box',
            px: 1.5,
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
          footer={(() => {
            if (modalStep === 'warning') {
              return (
                <>
                  <Button variant="outlined" onClick={() => setModalStep('details')}>Cancel</Button>
                  <Button variant="contained" onClick={() => receivePurchase(editPurchase.purchase_id, true)}>
                    Mark as Received Anyway
                  </Button>
                </>
              );
            }

            const recv = receivingStatusOfPurchase(editPurchase.purchase_id, data.supplier_deliveries);
            const isCancelled = editPurchase.purchase_status === 'Cancelled';
            const cancelReason = !isCancelled ? purchaseCancelBlockReason(editPurchase, data.supplier_deliveries, data.supplier_payments) : '';

            if (isCancelled || recv === 'Received') {
              return null;
            }

            return (
              <>
                {recv === 'Pending' && (
                  cancelReason
                    ? <Button sx={actionChip} disabled title={cancelReason} startIcon={<CancelOutlinedIcon />}>Cancel Purchase</Button>
                    : <Button sx={actionChip} startIcon={<CancelOutlinedIcon />} onClick={() => setConfirm({ kind: 'cancel', purchaseId: editPurchase.purchase_id })}>Cancel Purchase</Button>
                )}

                <Button
                  variant="contained"
                  onClick={() => recv === 'Checked'
                    ? setConfirm({ kind: 'receive', purchaseId: editPurchase.purchase_id })
                    : receivePurchase(editPurchase.purchase_id)}
                >
                  Mark as Received
                </Button>
              </>
            );
          })()}
        >
          {modalStep === 'warning' ? (
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', pt: 1, pb: 1 }}>
              <WarningAmberIcon sx={{ color: TOKENS.hlError, fontSize: 28 }} />
              <Typography sx={{ fontSize: 13, lineHeight: 1.5 }}>
                This purchase hasn't been marked as <strong>Checked</strong> by staff. Marking it Received now will record an admin override in the audit trail.
              </Typography>
            </Box>
          ) : (
            <PurchaseEditBody
              purchase={editPurchase}
              scheduledDate={scheduledDate}
              onScheduledDateChange={setScheduledDate}
              onSaveScheduledDate={saveScheduledDate}
              dueDate={dueDate}
              onDueDateChange={setDueDate}
              onSaveDueDate={saveDueDate}
            />
          )}
        </Modal>
      )}

      {/* ACTION CONFIRM MODALS */}
      <Modal
        open={checkConfirmId !== null}
        title="Confirm purchase check"
        onClose={() => setCheckConfirmId(null)}
        onConfirm={() => {
          if (checkConfirmId !== null) return markChecked(checkConfirmId).finally(() => setCheckConfirmId(null));
          setCheckConfirmId(null);
        }}
        confirmLabel="Mark as Checked"
        width="confirm"
      >
        <Typography sx={{ fontSize: 13, lineHeight: 1.5 }}>
          Confirm that the delivery for purchase {checkConfirmId === null ? '' : fmtPurchaseId(checkConfirmId)} has been checked?
        </Typography>
      </Modal>
      {isAdmin && (
        <>
          <Modal open={!!confirm && confirm.kind === 'receive'} title="Mark Purchase as Received?" onClose={() => setConfirm(null)} onConfirm={() => receivePurchase(confirm.purchaseId)} confirmLabel="Mark as Received" width="form">
            <Typography sx={{ fontSize: 13, lineHeight: 1.5 }}>This action cannot be undone.</Typography>
          </Modal>

          <Modal open={!!confirm && confirm.kind === 'cancel'} title="Cancel Purchase?" onClose={() => setConfirm(null)} onConfirm={() => cancelPurchase(confirm.purchaseId)} confirmLabel="Cancel Purchase" width="form">
            <Typography sx={{ fontSize: 13, lineHeight: 1.5 }}>This action cannot be undone.</Typography>
          </Modal>
        </>
      )}
    </>
  );
}

function PurchaseEditBody({
  purchase, scheduledDate, onScheduledDateChange, onSaveScheduledDate,
  dueDate, onDueDateChange, onSaveDueDate
}) {
  const { data, supplierById } = useData();
  const recv = receivingStatusOfPurchase(purchase.purchase_id, data.supplier_deliveries);
  const delivery = data.supplier_deliveries.find((d) => d.purchase_id === purchase.purchase_id);

  return (
    <Box>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: { xs: 1.5, sm: 2 },
        alignItems: 'start'
      }}>
        <Box sx={{ ...style.editInfo, mb: 0 }}>
          <Typography sx={style.detail.infoLabel}>Purchase ID</Typography>
          <Typography sx={style.detail.infoValue}>{fmtPurchaseId(purchase.purchase_id)}</Typography>
        </Box>
        <Box sx={{ ...style.editInfo, mb: 0 }}>
          <Typography sx={style.detail.infoLabel}>Supplier</Typography>
          <Typography sx={style.detail.infoValue}>{supplierById(purchase.supplier_id)?.supplier_name || '—'}</Typography>
        </Box>
        <Box sx={{ ...style.editInfo, mb: 0 }}>
          <Typography sx={style.detail.infoLabel}>Purchase Date</Typography>
          <Typography sx={style.detail.infoValue}>{fmtDate(purchase.purchase_date)}</Typography>
        </Box>
        <Box sx={{ ...style.editInfo, mb: 0 }}>
          <Typography sx={style.detail.infoLabel}>Total Amount</Typography>
          <Typography sx={style.detail.infoValue}>{peso(purchase.total_amount)}</Typography>
        </Box>
        <Box sx={{ ...style.editInfo, mb: 0 }}>
          <Typography sx={{ ...style.detail.infoLabel, mb: 0.5 }}>Due Date</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <DateField
              value={dueDate}
              onChange={(e) => onDueDateChange(e.target.value)}
              min={purchase.purchase_date}
              fullWidth
              sx={{ flex: 1, minWidth: 0, width: 'auto' }}
            />
            {dueDate !== (purchase.due_date || '') && (
              <Tooltip title="Save due date">
                <IconButton
                  aria-label="Save due date"
                  onClick={onSaveDueDate}
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    flexShrink: 0,
                    color: '#fff',
                    backgroundColor: TOKENS.hlBlue,
                    '&:hover': { backgroundColor: TOKENS.hlBlueDark }
                  }}
                >
                  <SaveOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
        <Box sx={{ ...style.editInfo, mb: 0 }}>
          <Typography sx={style.detail.infoLabel}>Payment Status</Typography>
          <Chip label={purchase.payment_status} color={COLOR_MAP[purchase.payment_status] || 'default'} size="small" />
        </Box>
        <Box sx={{ ...style.editInfo, mb: 0 }}>
          <Typography sx={style.detail.infoLabel}>Receiving Status</Typography>
          <OperationalStatus
            status={recv}
            scheduledDate={scheduledDate}
          />
        </Box>
        <Box sx={{ ...style.editInfo, mb: 0 }}>
          <Typography sx={style.detail.infoLabel}>Purchase Status</Typography>
          <StatusBadge status={purchase.purchase_status} />
        </Box>
        <Box sx={{ ...style.editInfo, mb: 0 }}>
          <Typography sx={{ ...style.detail.infoLabel, mb: 0.5 }}>Scheduled Delivery Date</Typography>
          {recv === 'Pending' || recv === 'Checked' ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <DateField
                value={scheduledDate}
                onChange={(e) => onScheduledDateChange(e.target.value)}
                min={purchase.purchase_date}
                fullWidth
                sx={{ flex: 1, minWidth: 0, width: 'auto' }}
              />
              {scheduledDate !== (delivery?.scheduled_delivery_date || delivery?.delivery_date || '') && (
                <Tooltip title="Save scheduled date">
                  <IconButton
                    aria-label="Save scheduled delivery date"
                    onClick={onSaveScheduledDate}
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1,
                      flexShrink: 0,
                      color: '#fff',
                      backgroundColor: TOKENS.hlBlue,
                      '&:hover': { backgroundColor: TOKENS.hlBlueDark }
                    }}
                  >
                    <SaveOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          ) : (
            <Typography sx={style.detail.infoValue}>
              {fmtDate(delivery?.scheduled_delivery_date || (recv !== 'Received' ? delivery?.delivery_date : null))}
            </Typography>
          )}
        </Box>
        {recv === 'Received' && (delivery.actual_delivery_date || delivery.delivery_date) && (
          <Box sx={{ ...style.editInfo, mb: 0 }}>
            <Typography sx={style.detail.infoLabel}>Actual Delivery Date</Typography>
            <Typography sx={style.detail.infoValue}>{fmtDate(delivery.actual_delivery_date || delivery.delivery_date)}</Typography>
          </Box>
        )}
      </Box>
      <Typography sx={{ ...style.editNote, mt: 2 }}>
        {recv === 'Pending'
          ? 'Waiting for staff to mark this delivery as "Checked" before it can be received into inventory.'
          : recv === 'Checked'
            ? 'Staff has checked this purchase. You can now mark it as Received to add the items to stock.'
            : 'This purchase is ' + (purchase.purchase_status === 'Cancelled' ? 'Cancelled' : recv) + ' and its receiving can’t be changed.'}
      </Typography>
    </Box>
  );
}

function StaffPurchaseDetails({ view, delivery }) {
  const recv = view.receiving_status || 'Pending';
  const scheduledDate = delivery?.scheduled_delivery_date
    || view.scheduled_delivery_date
    || scheduledDeliveryDateOf(delivery, recv);

  return (
    <Box>
      <Typography sx={style.sectionTitle}>Purchase information</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 2, mb: 2 }}>
        <Info label="Purchase ID" value={fmtPurchaseId(view.purchase_id)} />
        <Info label="Supplier" value={view.supplier_name || '—'} />
        <Info label="Purchase Date" value={fmtDate(view.purchase_date)} />
        <Info label="Purchase Time" value={fmtTime(view.purchase_time)} />
        <Info label="Receiving Status" value={<OperationalStatus status={recv} scheduledDate={scheduledDate} />} />
        <Info label="Scheduled Delivery" value={fmtDate(scheduledDate)} />
        <Info label="Actual Delivery" value={fmtDate(delivery?.actual_delivery_date || (view.receiving_status === 'Received' ? delivery?.delivery_date : null))} />
      </Box>

      <Typography sx={style.sectionTitle}>Items</Typography>
      <Box sx={style.detail.tableWrap}>
        <Table size="small" sx={style.detail.itemsTable}>
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell align="right">Quantity</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(view.items || []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} sx={style.detail.emptyCell}>No items recorded.</TableCell>
              </TableRow>
            ) : view.items.map((it) => (
              <TableRow key={it.product_id}>
                <TableCell>{it.product_name}<Box sx={style.detail.cellSub}>{it.product_code}</Box></TableCell>
                <TableCell align="right">{it.quantity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}

function PurchaseDetails({ purchase }) {
  const { data, supplierById, detailsOf, productById } = useData();
  const supplier = supplierById(purchase.supplier_id);
  const rows = detailsOf(purchase.purchase_id);
  const subtotal = round2(rows.reduce((sum, d) => sum + d.subtotal, 0));
  const delivery = data.supplier_deliveries.find((d) => d.purchase_id === purchase.purchase_id);
  const recv = receivingStatusOfPurchase(purchase.purchase_id, data.supplier_deliveries);
  const overdue = isPurchaseOverdue(purchase, data.supplier_payments);

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
          <Chip label={purchase.payment_status} color={COLOR_MAP[purchase.payment_status] || 'default'} size="small" />
          {overdue && <Chip label={overdue} color={overdue === 'Overdue' ? 'error' : overdue === 'Due Today' ? 'warning' : 'info'} size="small" />}
        </Box>} />
        <Info label="Receiving Status" value={<OperationalStatus
          status={recv}
          scheduledDate={scheduledDeliveryDateOf(delivery, recv)}
        />} />
        <Info label="Purchase Status" value={<StatusBadge status={purchase.purchase_status} />} />
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
        <Info label="Actual Delivery" value={delivery?.receiving_status === 'Received'
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
  <Box>
    <Typography sx={style.detail.infoLabel}>{label}</Typography>
    <Typography component="div" sx={style.detail.infoValue}>{value}</Typography>
  </Box>
);