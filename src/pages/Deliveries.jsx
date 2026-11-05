import React, { useMemo, useRef, useState } from 'react';
import {
  Box, TextField, MenuItem, Button, IconButton, Tooltip, Table, TableHead, TableBody,
  TableRow, TableCell, Typography, Card, CardContent, Divider
} from '@mui/material';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Topbar from '../components/Topbar';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';
import DetailModal from '../components/DetailModal';
import DateField from '../components/DateField';
import SaleDetails from '../components/SaleDetails';
import OperationalStatus from '../components/OperationalStatus';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useAudit } from '../utils/useAudit';
import style from '../styles/DeliveriesStyles';
import { TOKENS, filterChip, actionChip } from '../styles/HomeLineStyles';
import {
  PAGE_SIZE, OPERATIONAL_STATUSES, operationalStatusForDisplay,
  scheduledDeliveryDateOf, saleStatusOf, saleCancelBlockReason, stockStatusOf
} from '../utils/businessRules';
import { fmtDate, fmtSaleId, fmtDeliveryId, todayIso, isRealDate, round2 } from '../utils/format';
import {
  collection, doc, getDocs, query, runTransaction, where
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { stopRowActivationPropagation } from '../utils/keyboard';

const DL_DEFAULT = { search: '', status: '', sortKey: 'date', sortDir: 'desc', page: 1 };

const DL_COLUMNS = [
  { key: 'id', label: 'Delivery ID' },
  { key: 'sale', label: 'Sale ID' },
  { key: 'customer', label: 'Customer' },
  { key: 'date', label: 'Scheduled / Actual' },
  { key: 'status', label: 'Delivery Status' }
];

function InfoBlock({ label, value }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: TOKENS.hlBlueDark, mb: 0.25 }}>{label}</Typography>
      <Typography sx={{ fontSize: 13 }}>{value}</Typography>
    </Box>
  );
}

export default function Deliveries() {
  const { data, update, refresh, saleById, saleCustomerName } = useData();
  const showToast = useToast();
  const log = useAudit();
  const { isAdmin } = useAuth();
  const finishingDeliveryRef = useRef(new Set());

  const [dl, setDl] = useState({ ...DL_DEFAULT });
  const [editId, setEditId] = useState(null);
  const [modalStep, setModalStep] = useState('details');
  const [pendingAction, setPendingAction] = useState(null);
  const [checkConfirmId, setCheckConfirmId] = useState(null);
  const [detailSaleId, setDetailSaleId] = useState(null);
  const [checkingId, setCheckingId] = useState(null);
  const [scheduledDate, setScheduledDate] = useState('');

  const allRows = useMemo(() => data.customer_deliveries
    .map((delivery) => ({ delivery, sale: saleById(delivery.sale_id) }))
    .filter((r) => r.sale),
    [data.customer_deliveries, saleById]);

  const filtered = useMemo(() => {
    const q = dl.search.trim().toLowerCase();
    return allRows.filter(({ delivery, sale }) => {
      if (q) {
        const hay = [fmtDeliveryId(delivery.customer_delivery_id), fmtSaleId(sale.sale_id), saleCustomerName(sale)].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const status = operationalStatusForDisplay(
        delivery.delivery_status,
        scheduledDeliveryDateOf(delivery, delivery.delivery_status)
      );
      if (dl.status && status !== dl.status) return false;
      return true;
    });
  }, [allRows, dl.search, dl.status, saleCustomerName]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let r = 0;
      switch (dl.sortKey) {
        case 'id': r = a.delivery.customer_delivery_id - b.delivery.customer_delivery_id; break;
        case 'sale': r = a.sale.sale_id - b.sale.sale_id; break;
        case 'customer': r = saleCustomerName(a.sale).localeCompare(saleCustomerName(b.sale)); break;
        case 'date': r = (a.delivery.scheduled_delivery_date || a.delivery.delivery_date || '')
          .localeCompare(b.delivery.scheduled_delivery_date || b.delivery.delivery_date || ''); break;
        case 'status': {
          const aStatus = operationalStatusForDisplay(a.delivery.delivery_status, scheduledDeliveryDateOf(a.delivery, a.delivery.delivery_status));
          const bStatus = operationalStatusForDisplay(b.delivery.delivery_status, scheduledDeliveryDateOf(b.delivery, b.delivery.delivery_status));
          r = OPERATIONAL_STATUSES.indexOf(aStatus) - OPERATIONAL_STATUSES.indexOf(bStatus);
          break;
        }
      }
      if (r === 0) r = a.delivery.customer_delivery_id - b.delivery.customer_delivery_id;
      return dl.sortDir === 'asc' ? r : -r;
    });
    return arr;
  }, [filtered, dl.sortKey, dl.sortDir, saleCustomerName]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, dl.page), totalPages);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const onSort = (key) => setDl((p) => ({
    ...p, sortKey: key,
    sortDir: p.sortKey === key && p.sortDir === 'asc' ? 'desc' : 'asc',
    page: 1
  }));
  const clearFilters = () => setDl({ ...DL_DEFAULT });

  const markChecked = async (deliveryId) => {
    if (checkingId === deliveryId) return;
    setCheckingId(deliveryId);

    try {
      const delivery = data.customer_deliveries.find((d) => d.customer_delivery_id === deliveryId);
      if (!delivery) return;
      const sale = saleById(delivery.sale_id);
      if (!delivery._docId || !sale?._docId) {
        throw new Error('Could not find the Firestore record for this delivery or sale. Refresh and try again.');
      }

      const deliveryRef = doc(db, 'customer_deliveries', delivery._docId);
      const saleRef = doc(db, 'sales', sale._docId);
      const status = await runTransaction(db, async (transaction) => {
        const [deliverySnap, saleSnap] = await Promise.all([
          transaction.get(deliveryRef),
          transaction.get(saleRef)
        ]);
        if (!deliverySnap.exists()) throw new Error('Delivery record no longer exists.');
        if (!saleSnap.exists()) throw new Error('Sale record no longer exists.');
        if (saleSnap.data().sale_status === 'Cancelled') {
          throw new Error('This sale was cancelled — its delivery can’t be checked.');
        }

        const currentStatus = deliverySnap.data().delivery_status || 'Pending';
        if (currentStatus !== 'Pending' && currentStatus !== 'Checked') {
          throw new Error('This delivery is already ' + currentStatus.toLowerCase() + '.');
        }
        if (currentStatus === 'Pending') {
          transaction.update(deliveryRef, { delivery_status: 'Checked' });
        }
        return currentStatus;
      });

      await refresh();
      if (status === 'Pending') {
        await log('CHECK', 'Delivery', fmtDeliveryId(deliveryId), {
          summary: `Marked delivery ${fmtDeliveryId(deliveryId)} as checked`,
          delivery_id: deliveryId,
          sale_id: delivery.sale_id,
        });
        setEditId(null);
        showToast(`Delivery ${fmtDeliveryId(deliveryId)} marked as checked ✓`);
      } else {
        showToast('Delivery is already checked ✓');
      }

    } catch (err) {
      console.error('Check failed:', err);
      showToast(err.message || 'Failed to mark as checked.');
    } finally {
      setCheckingId(null);
    }
  };

  const finishDelivery = async (deliveryId, newStatus, isOverride = false, cancelSale = false) => {
    const delivery = data.customer_deliveries.find((d) => d.customer_delivery_id === deliveryId);
    const sale = delivery && saleById(delivery.sale_id);
    if (!sale) return;
    if (finishingDeliveryRef.current.has(deliveryId)) return;
    if (!delivery._docId || !sale._docId) {
      showToast('Could not find the Firestore record for this delivery or sale. Refresh and try again.');
      return;
    }

    // If marking as delivered, and it's Pending, and we aren't overriding yet, show the warning
    if (newStatus === 'Delivered' && delivery.delivery_status === 'Pending' && !isOverride) {
      setModalStep('warning');
      return;
    }

    finishingDeliveryRef.current.add(deliveryId);
    const actionDate = todayIso();
    const actualDate = ['Delivered', 'Picked Up'].includes(newStatus) ? actionDate : null;
    const deliveryRef = doc(db, 'customer_deliveries', delivery._docId);
    const saleRef = doc(db, 'sales', sale._docId);

    try {
      const deliveryQuerySnap = await getDocs(query(
        collection(db, 'customer_deliveries'),
        where('sale_id', '==', sale.sale_id)
      ));
      const paymentQuerySnap = cancelSale
        ? await getDocs(query(collection(db, 'customer_payments'), where('sale_id', '==', sale.sale_id)))
        : null;
      const detailQuerySnap = cancelSale
        ? await getDocs(query(collection(db, 'sale_details'), where('sale_id', '==', sale.sale_id)))
        : null;
      const detailProducts = [...new Set((detailQuerySnap?.docs || [])
        .map((line) => Number(line.data().product_id))
        .filter(Number.isInteger))];
      const inventoryQuerySnaps = cancelSale
        ? await Promise.all(detailProducts.map((productId) => getDocs(query(
          collection(db, 'inventory'),
          where('product_id', '==', productId)
        ))))
        : [];

      const result = await runTransaction(db, async (transaction) => {
        const [
          deliverySnap,
          saleSnap,
          deliverySnaps,
          paymentSnaps,
          detailSnaps,
          inventorySnaps
        ] = await Promise.all([
          transaction.get(deliveryRef),
          transaction.get(saleRef),
          Promise.all(deliveryQuerySnap.docs.map((relatedDelivery) => transaction.get(relatedDelivery.ref))),
          Promise.all((paymentQuerySnap?.docs || []).map((payment) => transaction.get(payment.ref))),
          Promise.all((detailQuerySnap?.docs || []).map((line) => transaction.get(line.ref))),
          Promise.all(inventoryQuerySnaps.flatMap((inventoryQuerySnap) =>
            inventoryQuerySnap.docs.map((inventory) => transaction.get(inventory.ref))
          ))
        ]);
        if (!deliverySnap.exists()) throw new Error('Delivery record no longer exists');
        if (!saleSnap.exists()) throw new Error('Sale record no longer exists');

        const currentDelivery = deliverySnap.data();
        const currentSale = saleSnap.data();
        if (currentSale.sale_status === 'Cancelled') {
          throw new Error('This sale was cancelled — its delivery can’t be changed');
        }
        if (!['Pending', 'Checked'].includes(currentDelivery.delivery_status)) {
          throw new Error('This delivery is already ' + currentDelivery.delivery_status);
        }
        if (newStatus === 'Cancelled' && cancelSale) {
          const payments = paymentSnaps.map((payment) => payment.data());
          const liveDeliveries = deliverySnaps.map((deliveryDoc) => ({
            ...deliveryDoc.data(),
            _docId: deliveryDoc.ref.id
          }));
          const blocked = saleCancelBlockReason(currentSale, payments, liveDeliveries);
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

          const productIds = [...quantities.keys()];
          const inventoryByProduct = new Map();
          inventoryQuerySnaps.forEach((snapshot, index) => {
            inventoryByProduct.set(detailProducts[index], snapshot.docs);
          });
          const inventoryUpdates = productIds.map((productId) => {
            const inventoryDocs = inventoryByProduct.get(productId) || [];
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
            return {
              ref: inventoryRef,
              quantity_on_hand: newQty,
              stock_status: stockStatusOf(newQty, Number(inventory.reorder_level) || 0),
              last_updated: actionDate
            };
          });

          inventoryUpdates.forEach(({ ref, ...stock }) => transaction.update(ref, stock));
          deliverySnaps
            .filter((deliveryDoc) => ['Pending', 'Checked'].includes(deliveryDoc.data().delivery_status))
            .forEach((deliveryDoc) => transaction.update(
              deliveryDoc.ref,
              { delivery_status: 'Cancelled' }
            ));
          transaction.update(saleRef, { sale_status: 'Cancelled' });
          return {
            newSaleStatus: 'Cancelled',
            saleCancelled: true,
            totalAmount: currentSale.total_amount
          };
        }
        if (newStatus === 'Delivered' && currentDelivery.delivery_status === 'Pending' && !isOverride) {
          return { needsOverride: true };
        }

        const deliveries = deliverySnaps.map((deliveryDoc) => ({
          ...deliveryDoc.data(),
          ...(deliveryDoc.ref.path === deliverySnap.ref.path ? { delivery_status: newStatus } : {})
        }));
        const newSaleStatus = saleStatusOf(currentSale, deliveries);
        transaction.update(deliveryRef, {
          delivery_status: newStatus,
          ...(actualDate ? { actual_delivery_date: actualDate } : {})
        });
        if (newSaleStatus !== currentSale.sale_status) {
          transaction.update(saleRef, { sale_status: newSaleStatus });
        }
        return { newSaleStatus };
      });

      if (result.needsOverride) {
        setModalStep('warning');
        return;
      }

      setEditId(null);
      setModalStep('details');
      setPendingAction(null);
      await refresh();
      await log(
        newStatus === 'Delivered' ? 'DELIVER' : newStatus === 'Picked Up' ? 'PICK-UP' : 'CANCEL',
        'Delivery',
        fmtDeliveryId(deliveryId),
        {
          summary: result.saleCancelled
            ? `Cancelled delivery ${fmtDeliveryId(deliveryId)} and sale ${fmtSaleId(sale.sale_id)} — stock restored`
            : `Marked delivery ${fmtDeliveryId(deliveryId)} as ${newStatus}${isOverride ? ' (Admin Override)' : ''}`,
          delivery_id: deliveryId,
          sale_id: sale.sale_id,
          new_status: newStatus,
          ...(result.saleCancelled ? { sale_resolution: 'cancel-sale', total_amount: result.totalAmount } : {}),
          ...(actualDate ? { actual_delivery_date: actualDate } : {}),
          new_sale_status: result.newSaleStatus,
        }
      );
      if (result.saleCancelled) {
        await log('CANCEL', 'Sale', fmtSaleId(sale.sale_id), {
          summary: `Cancelled sale ${fmtSaleId(sale.sale_id)} — stock restored`,
          sale_id: sale.sale_id,
          total_amount: result.totalAmount,
          reason: 'Delivery cancelled; customer cancelled the order'
        });
        showToast(`Delivery ${fmtDeliveryId(deliveryId)} and sale cancelled — stock restored ✓`);
      } else {
        showToast('Delivery ' + fmtDeliveryId(deliveryId) + ' — ' + newStatus + ' ✓');
      }
    } catch (err) {
      console.error('Delivery status update failed:', err);
      showToast(err.message || 'Could not update delivery status');
    } finally {
      finishingDeliveryRef.current.delete(deliveryId);
    }
  };

  const editDelivery = editId ? data.customer_deliveries.find((d) => d.customer_delivery_id === editId) : null;
  const editSale = editDelivery ? saleById(editDelivery.sale_id) : null;
  const editDeliveryStatus = editDelivery?.delivery_status;
  const detailSale = detailSaleId ? saleById(detailSaleId) : null;

  const openEdit = (deliveryId) => {
    const delivery = data.customer_deliveries.find((d) => d.customer_delivery_id === deliveryId);
    setScheduledDate(delivery?.scheduled_delivery_date || delivery?.delivery_date || '');
    setEditId(deliveryId);
  };

  const saveScheduledDate = async () => {
    if (!editDelivery || !scheduledDate) {
      showToast('Choose a scheduled delivery date');
      return;
    }
    if (!isRealDate(scheduledDate)) {
      showToast('Enter a valid scheduled delivery date');
      return;
    }
    if (editSale?.sale_date && scheduledDate < editSale.sale_date) {
      showToast('Scheduled delivery date can’t be before the sale date');
      return;
    }
    try {
      await update('customer_deliveries', editDelivery._docId, {
        scheduled_delivery_date: scheduledDate
      });
      await refresh();
      await log('UPDATE', 'Delivery', fmtDeliveryId(editDelivery.customer_delivery_id), {
        summary: `Updated scheduled delivery date for ${fmtDeliveryId(editDelivery.customer_delivery_id)}`,
        delivery_id: editDelivery.customer_delivery_id,
        sale_id: editDelivery.sale_id,
        scheduled_delivery_date: scheduledDate,
      });
      showToast('Scheduled delivery date updated ✓');
    } catch (err) {
      console.error('Scheduled delivery date update failed:', err);
      showToast(err.message || 'Could not update scheduled delivery date');
    }
  };

  const closeEdit = () => {
    setEditId(null);
    setScheduledDate('');
    setPendingAction(null);
    setModalStep('details');
  };

  return (
    <>
      <Topbar title="Deliveries" />

      <Box sx={style.content}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'minmax(200px, 1fr) auto auto' },
          gap: 2,
          mb: 3,
          alignItems: 'center'
        }}>
          <TextField size="small" placeholder="Search delivery ID, sale ID or customer"
            value={dl.search}
            onChange={(e) => setDl((p) => ({ ...p, search: e.target.value, page: 1 }))}
            fullWidth />
          <TextField select size="small" label="Delivery Status" value={dl.status}
            onChange={(e) => setDl((p) => ({ ...p, status: e.target.value, page: 1 }))}
            sx={{ minWidth: { xs: '100%', sm: 200 } }}>
            <MenuItem value="">All delivery statuses</MenuItem>
            {OPERATIONAL_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <Button sx={{ ...filterChip, height: 40 }} startIcon={<FilterAltOffIcon />} onClick={clearFilters}>
            Clear Filters
          </Button>
        </Box>

        <Box sx={{ display: { xs: 'none', sm: 'block' }, ...style.tableWrap }}>
          <Table sx={style.historyTable}>
            <TableHead>
              <TableRow>
                {DL_COLUMNS.map((c) => {
                  const active = dl.sortKey === c.key;
                  const arrow = active ? (dl.sortDir === 'asc' ? '▲' : '▼') : '↕';
                  return (
                    <TableCell key={c.key}
                      aria-sort={active ? (dl.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      onClick={() => onSort(c.key)}
                      sx={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      {c.label}
                      <Box component="span" sx={{ fontSize: 9, ml: '6px' }}>{arrow}</Box>
                    </TableCell>
                  );
                })}
                <TableCell sx={style.actionsCol}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={style.emptyCell}>
                    {data.customer_deliveries.length ? 'No deliveries match these filters.' : 'No deliveries yet. Deliveries are created from a Delivery Sale.'}
                  </TableCell>
                </TableRow>
              ) : pageRows.map(({ delivery, sale }) => (
                <TableRow key={delivery.customer_delivery_id} hover tabIndex={0}
                  onDoubleClick={() => setDetailSaleId(sale.sale_id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setDetailSaleId(sale.sale_id); } }}
                  sx={{ cursor: 'pointer' }}>
                  <TableCell>{fmtDeliveryId(delivery.customer_delivery_id)}</TableCell>
                  <TableCell>{fmtSaleId(sale.sale_id)}</TableCell>
                  <TableCell>{saleCustomerName(sale)}</TableCell>
                  <TableCell>
                    <Box sx={{ fontSize: 12 }}>{fmtDate(delivery.scheduled_delivery_date || delivery.delivery_date)}</Box>
                    {delivery.actual_delivery_date && (
                      <Box sx={{ fontSize: 10.5, color: TOKENS.gray5, mt: 0.25 }}>
                        Actual: {fmtDate(delivery.actual_delivery_date)}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    <OperationalStatus
                      status={delivery.delivery_status}
                      scheduledDate={scheduledDeliveryDateOf(delivery, delivery.delivery_status)}
                    />
                  </TableCell>
                  <TableCell sx={style.actionsCell}>
                    {isAdmin ? (
                      <Button
                        size="small"
                        sx={actionChip}
                        startIcon={<EditOutlinedIcon />}
                        onClick={(e) => { e.stopPropagation(); openEdit(delivery.customer_delivery_id); }}
                        onKeyDown={stopRowActivationPropagation}
                        aria-label={`Edit delivery ${fmtDeliveryId(delivery.customer_delivery_id)}`}
                        disabled={['Delivered', 'Picked Up', 'Cancelled'].includes(delivery.delivery_status)}
                      >
                        Edit
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        sx={actionChip}
                        startIcon={<FactCheckOutlinedIcon />}
                        disabled={delivery.delivery_status !== 'Pending' || checkingId === delivery.customer_delivery_id}
                        onClick={(e) => { e.stopPropagation(); setCheckConfirmId(delivery.customer_delivery_id); }}
                      >
                        {checkingId === delivery.customer_delivery_id
                          ? 'Checking…'
                          : delivery.delivery_status === 'Pending' ? 'Mark as Checked' : 'Checked'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 2 }}>
          {pageRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: TOKENS.gray5 }}>No deliveries match these filters.</Box>
          ) : pageRows.map(({ delivery, sale }) => (
            <Card
              key={delivery.customer_delivery_id}
              variant="outlined"
              onClick={() => setDetailSaleId(sale.sale_id)}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetailSaleId(sale.sale_id);
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
                      {fmtDeliveryId(delivery.customer_delivery_id)}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: TOKENS.gray5, mt: 0.5 }}>
                      Scheduled: {fmtDate(delivery.scheduled_delivery_date || delivery.delivery_date)}
                      {delivery.actual_delivery_date
                        ? ` · Actual: ${fmtDate(delivery.actual_delivery_date)}`
                        : ''}
                    </Typography>
                  </Box>
                  <Box sx={{ minWidth: 0, textAlign: 'right', ml: 'auto' }}>
                    <OperationalStatus
                      status={delivery.delivery_status}
                      scheduledDate={scheduledDeliveryDateOf(delivery, delivery.delivery_status)}
                    />
                  </Box>
                </Box>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                  <Box sx={{ minWidth: 0, flex: '1 1 140px' }}>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.gray5, letterSpacing: 0.5 }}>Sale / Customer</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 500, overflowWrap: 'anywhere' }}>{fmtSaleId(sale.sale_id)} · {saleCustomerName(sale)}</Typography>
                  </Box>
                  {isAdmin ? (
                    <Button
                      size="small"
                      sx={{ ...actionChip, flexShrink: 0 }}
                      startIcon={<EditOutlinedIcon />}
                      onClick={(e) => { e.stopPropagation(); openEdit(delivery.customer_delivery_id); }}
                      onKeyDown={stopRowActivationPropagation}
                      aria-label={`Edit delivery ${fmtDeliveryId(delivery.customer_delivery_id)}`}
                      disabled={['Delivered', 'Picked Up', 'Cancelled'].includes(delivery.delivery_status)}
                    >
                      Edit
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      sx={{ ...actionChip, flexShrink: 0 }}
                      startIcon={<FactCheckOutlinedIcon />}
                      disabled={delivery.delivery_status !== 'Pending' || checkingId === delivery.customer_delivery_id}
                      onClick={(e) => { e.stopPropagation(); setCheckConfirmId(delivery.customer_delivery_id); }}
                    >
                      {checkingId === delivery.customer_delivery_id ? 'Checking…' : 'Mark as Checked'}
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Typography sx={style.tableHint}>Double-click a row (or tap a card) to view the related sale.</Typography>

        <Pagination page={safePage} totalPages={totalPages} onPrev={() => setDl((p) => ({ ...p, page: safePage - 1 }))} onNext={() => setDl((p) => ({ ...p, page: safePage + 1 }))}
          info={sorted.length ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + pageRows.length} of ${sorted.length} deliver${sorted.length === 1 ? 'y' : 'ies'}` : '0 deliveries'} />
      </Box>

      {/* MAIN EDIT MODAL - Changes layout based on modalStep */}
      {isAdmin && editDelivery && editSale && (
        <Modal
          open
          title={modalStep === 'warning' ? 'Mark as Delivered without staff check?' : 'Edit Delivery — ' + fmtDeliveryId(editDelivery.customer_delivery_id)}
          onClose={closeEdit}
          width="narrow"
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
                  <Button variant="contained" onClick={() => finishDelivery(editDelivery.customer_delivery_id, 'Delivered', true)}>
                    Mark as Delivered Anyway
                  </Button>
                </>
              );
            }

            const isCancelled = editSale.sale_status === 'Cancelled';

            if (isCancelled || ['Delivered', 'Picked Up'].includes(editDeliveryStatus)) {
              return null;
            }

            return (
              <>
                {['Pending', 'Checked'].includes(editDeliveryStatus) && (
                  <Button sx={actionChip} startIcon={<CancelOutlinedIcon />} onClick={() => setPendingAction('cancel')}>Cancel Delivery</Button>
                )}
                <Button
                  variant="contained"
                  startIcon={<LocalShippingOutlinedIcon />}
                  onClick={() => editDelivery.delivery_status === 'Checked'
                    ? setPendingAction('deliver')
                    : finishDelivery(editDelivery.customer_delivery_id, 'Delivered')}
                >
                  Mark as Delivered
                </Button>
              </>
            );
          })()}
        >
          {modalStep === 'warning' ? (
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', pt: 1, pb: 1 }}>
              <WarningAmberIcon sx={{ color: TOKENS.hlError, fontSize: 28 }} />
              <Typography sx={{ fontSize: 13, lineHeight: 1.5 }}>
                This delivery hasn't been marked as <strong>Checked</strong> by staff. Marking it Delivered now will record an admin override in the audit trail.
              </Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '14px 20px', mb: 2 }}>
                <InfoBlock label="Delivery ID" value={fmtDeliveryId(editDelivery.customer_delivery_id)} />
                <InfoBlock label="Sale ID" value={fmtSaleId(editSale.sale_id)} />
                <InfoBlock label="Customer" value={saleCustomerName(editSale)} />
                <Box>
                  <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: TOKENS.hlBlueDark, mb: 0.5 }}>Delivery Status</Typography>
                  <OperationalStatus
                    status={editDelivery.delivery_status}
                    scheduledDate={scheduledDate}
                  />
                </Box>
                {editDeliveryStatus === 'Pending' || editDeliveryStatus === 'Checked' ? (
                  <Box>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: TOKENS.hlBlueDark, mb: 0.5 }}>
                      Scheduled Delivery Date
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <DateField
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={editSale?.sale_date}
                        fullWidth
                        sx={{ flex: 1, minWidth: 0, width: 'auto' }}
                      />
                      {scheduledDate !== (editDelivery.scheduled_delivery_date || editDelivery.delivery_date || '') && (
                        <Tooltip title="Save scheduled date">
                          <IconButton
                            aria-label="Save scheduled delivery date"
                            onClick={saveScheduledDate}
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
                ) : (
                  <InfoBlock label="Scheduled Delivery Date" value={fmtDate(editDelivery.scheduled_delivery_date || editDelivery.delivery_date)} />
                )}
                {editDelivery.actual_delivery_date && (
                  <InfoBlock label="Actual Delivery Date" value={fmtDate(editDelivery.actual_delivery_date)} />
                )}
              </Box>
              <Typography sx={{ fontSize: 11.5, lineHeight: 1.5, color: TOKENS.gray5, borderTop: `1px solid ${TOKENS.lineSoft}`, pt: 1.5 }}>
                {editDelivery.delivery_status === 'Pending'
                  ? 'This delivery is waiting to be checked by staff.'
                  : editDelivery.delivery_status === 'Checked'
                    ? 'Staff has checked this delivery. You can mark it as Delivered.'
                    : 'This delivery is ' + editDelivery.delivery_status + ' and can’t be changed.'}
              </Typography>
            </>
          )}
        </Modal>
      )}

      {/* ACTION CONFIRM MODALS */}
      <Modal
        open={checkConfirmId !== null}
        title="Confirm delivery check"
        onClose={() => setCheckConfirmId(null)}
        onConfirm={() => {
          if (checkConfirmId !== null) return markChecked(checkConfirmId).finally(() => setCheckConfirmId(null));
          setCheckConfirmId(null);
        }}
        confirmLabel="Mark as Checked"
        width="confirm"
      >
        <Typography sx={{ fontSize: 13, lineHeight: 1.5 }}>
          Confirm that delivery {checkConfirmId === null ? '' : fmtDeliveryId(checkConfirmId)} has been checked?
        </Typography>
      </Modal>
      {isAdmin && (
        <>
          <Modal open={!!pendingAction && pendingAction === 'deliver'} title="Mark Delivery as Delivered?" onClose={() => setPendingAction(null)} onConfirm={() => editDelivery && finishDelivery(editDelivery.customer_delivery_id, 'Delivered')} confirmLabel="Mark as Delivered" width="confirm">
            <Typography sx={{ fontSize: 13, lineHeight: 1.5 }}>This action cannot be undone.</Typography>
          </Modal>

          <Modal
            open={pendingAction === 'cancel'}
            title="Cancel Delivery"
            onClose={() => setPendingAction(null)}
            hideConfirm
            width="form"
            footer={<Button variant="outlined" onClick={() => setPendingAction(null)}>Go Back</Button>}
          >
            <Typography sx={{ fontSize: 13, lineHeight: 1.5, mb: 2 }}>
              This delivery will be cancelled. What would you like to do with the sale?
            </Typography>
            <Box sx={{ display: 'grid', gap: 1.5, pb: 1 }}>
              <Button
                variant="contained"
                color="error"
                disabled={Boolean(editSale && saleCancelBlockReason(
                  editSale, data.customer_payments, data.customer_deliveries
                ))}
                onClick={() => editDelivery && finishDelivery(
                  editDelivery.customer_delivery_id, 'Cancelled', false, true
                )}
                sx={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  whiteSpace: 'normal',
                  py: 1.25,
                  px: 1.75
                }}
              >
                <Typography component="span" sx={{ fontWeight: 700, fontSize: 14 }}>
                  Cancel Sale &amp; Restock Items
                </Typography>
                <Typography component="span" sx={{ fontSize: 12, opacity: 0.9, mt: 0.25 }}>
                  Use this if the customer cancelled the order entirely.
                </Typography>
              </Button>
              {editSale && saleCancelBlockReason(editSale, data.customer_payments, data.customer_deliveries) && (
                <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                  The sale can’t be cancelled: {saleCancelBlockReason(
                    editSale, data.customer_payments, data.customer_deliveries
                  )}.
                </Typography>
              )}
              <Button
                variant="outlined"
                onClick={() => editDelivery && finishDelivery(
                  editDelivery.customer_delivery_id, 'Picked Up'
                )}
                sx={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  whiteSpace: 'normal',
                  py: 1.25,
                  px: 1.75
                }}
              >
                <Typography component="span" sx={{ fontWeight: 700, fontSize: 14 }}>
                  Mark as Picked Up
                </Typography>
                <Typography component="span" sx={{ fontSize: 12, mt: 0.25 }}>
                  Use this if the customer took the items in-store instead.
                </Typography>
              </Button>
            </Box>
          </Modal>
        </>
      )}

      <DetailModal open={!!detailSale} title={detailSale ? 'Sale ' + fmtSaleId(detailSale.sale_id) : ''} onClose={() => setDetailSaleId(null)}>
        {detailSale && <SaleDetails sale={detailSale} />}
      </DetailModal>
    </>
  );
}