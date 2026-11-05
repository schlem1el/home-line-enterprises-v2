import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, TextField, MenuItem, Button, Divider, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import Field from '../components/Field';
import Modal from '../components/Modal';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import style from '../styles/NewPurchaseStyles';
import { TOKENS, disabledFieldText } from '../styles/HomeLineStyles';
import {
  PAYMENT_METHODS, calcTotals, lineSubtotal, parsePayAmount,
  paymentStatusOf, chequeDuplicateError
} from '../utils/businessRules';
import { peso, isoDate, isoTime, round2, isRealDate, todayIso, fmtDate, fmtPurchaseId } from '../utils/format';
import { writeAudit } from '../utils/auditHelpers';
import { hasAtMostTwoDecimalPlaces } from '../utils/validation';

const emptyState = () => ({
  supplierId: '',
  date: isoDate(new Date()),
  dueDate: '',
  scheduledDeliveryDate: '',
  items: [],
  editingIndex: -1,
  discount: '',
  payDate: '',
  payAmount: '',
  payMethod: '',
  payCheque: ''
});

function discountError(raw, subtotal) {
  const s = String(raw ?? '').trim();
  if (s === '') return '';
  const n = Number(s);
  if (!Number.isFinite(n)) return 'Enter a valid amount';
  if (n < 0) return 'Discount can’t be negative';
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return 'At most 2 decimal places';
  if (n > subtotal) return 'Discount can’t be more than the subtotal';
  return '';
}
function dateFieldError(raw, label, { required = true, maxToday = false, minDate = '' } = {}) {
  const value = String(raw ?? '').trim();
  if (!value) return required ? `Choose a ${label.toLowerCase()}` : '';
  if (!isRealDate(value)) return `Enter a valid ${label.toLowerCase()}`;
  if (maxToday && value > todayIso()) return `${label} can’t be in the future`;
  if (minDate && value < minDate) return `${label} can’t be before the purchase date`;
  return '';
}
function quantityFieldError(raw) {
  if (String(raw ?? '').trim() === '') return 'Enter a quantity';
  const value = Number(raw);
  return !Number.isInteger(value) || value < 1 ? 'Quantity must be 1 or more' : '';
}
function costFieldError(raw) {
  if (String(raw ?? '').trim() === '') return 'Enter a unit cost';
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 'Enter a unit cost above 0';
  return hasAtMostTwoDecimalPlaces(value) ? '' : 'At most 2 decimal places';
}

export default function NewPurchase() {
  const { data, add, update, refresh, productById, supplierById, supplierProduct } = useData();
  const { user, isAdmin } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();

  const [np, setNp] = useState(emptyState());
  const [saving, setSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [touched, setTouched] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeConfirmIndex, setRemoveConfirmIndex] = useState(null);

  const [editProductId, setEditProductId] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editCost, setEditCost] = useState('');
  const markTouched = (field) => setTouched((current) => ({ ...current, [field]: true }));

  useEffect(() => { setNp(emptyState()); }, []);

  const subtotal = useMemo(() => round2(np.items.reduce((s, it) => s + lineSubtotal(it), 0)), [np.items]);
  const totals = useMemo(() => calcTotals(subtotal, np.discount), [subtotal, np.discount]);
  const discountErr = discountError(np.discount, subtotal);
  const supplierErr = (showValidation || touched.supplier) && !np.supplierId ? 'Select a supplier' : '';
  const purchaseDateErr = (showValidation || touched.purchaseDate) ? dateFieldError(np.date, 'Purchase date', { maxToday: true }) : '';
  const dueDateErr = (showValidation || touched.dueDate) ? dateFieldError(np.dueDate, 'Due date', { minDate: np.date }) : '';
  const scheduledDateErr = (showValidation || touched.scheduledDate) ? dateFieldError(np.scheduledDeliveryDate, 'Scheduled delivery date', {
    required: false, minDate: np.date
  }) : '';
  const productErr = touched.product && !editProductId ? 'Select a product' : '';
  const quantityErr = touched.quantity ? quantityFieldError(editQty) : '';
  const costErr = touched.cost ? costFieldError(editCost) : '';
  const paymentStarted = [np.payDate, np.payAmount, np.payMethod, np.payCheque]
    .some((value) => String(value ?? '').trim() !== '');
  const chequePayment = np.payMethod === 'Cheque';
  const paymentDate = chequePayment ? np.dueDate : np.payDate;
  const paymentDateErr = (showValidation || touched.paymentDate) && paymentStarted
    ? dateFieldError(paymentDate, chequePayment ? 'Cheque due date' : 'Payment date', {
      maxToday: !chequePayment, minDate: np.date
    })
    : '';
  const paymentAmountErr = (showValidation || touched.paymentAmount) && paymentStarted
    ? (chequePayment && String(np.payAmount).trim() === ''
      ? ''
      : String(np.payAmount).trim() === ''
      ? 'Enter a payment amount'
      : (chequePayment
        ? (() => {
          const value = Number(np.payAmount);
          return !Number.isFinite(value) || value < 0 || !hasAtMostTwoDecimalPlaces(value)
            ? 'Enter 0 or a valid amount with at most 2 decimal places'
            : value !== 0
              ? 'Deferred cheque amount must be 0'
              : '';
        })()
        : parsePayAmount(np.payAmount, totals.total, 'the purchase total').error || ''))
    : '';
  const paymentMethodErr = (showValidation || touched.paymentMethod) && paymentStarted && !PAYMENT_METHODS.includes(np.payMethod)
    ? 'Choose a payment method'
    : '';
  const chequeErr = (showValidation || touched.cheque) && np.payMethod === 'Cheque' && !np.payCheque.trim() ? 'Enter the cheque number' : '';
  const activeProducts = data.products.filter((p) => p.status === 'Active');

  const productOptions = useMemo(() => {
    if (!np.supplierId) return activeProducts;
    const sid = Number(np.supplierId);
    const listed = activeProducts.filter((p) => supplierProduct(sid, p.product_id));
    const others = activeProducts.filter((p) => !supplierProduct(sid, p.product_id));
    return { listed, others };
  }, [activeProducts, np.supplierId, supplierProduct]);

  const productMenuChildren = useMemo(() => {
    const items = [<MenuItem key="__placeholder" value="">Select product…</MenuItem>];
    if (Array.isArray(productOptions)) {
      productOptions.forEach((p) => items.push(
        <MenuItem key={`p_${p.product_id}`} value={p.product_id}>{p.product_name} ({p.unit})</MenuItem>
      ));
      return items;
    }
    if (productOptions.listed.length > 0) {
      items.push(<MenuItem key="__hdr_listed" disabled sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: TOKENS.hlBlueDark }}>Listed for this supplier</MenuItem>);
      productOptions.listed.forEach((p) => items.push(
        <MenuItem key={`listed_${p.product_id}`} value={p.product_id}>{p.product_name} ({p.unit})</MenuItem>
      ));
    }
    if (productOptions.others.length > 0) {
      items.push(<MenuItem key="__hdr_others" disabled sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: TOKENS.hlBlueDark }}>Other products</MenuItem>);
      productOptions.others.forEach((p) => items.push(
        <MenuItem key={`other_${p.product_id}`} value={p.product_id}>{p.product_name} ({p.unit})</MenuItem>
      ));
    }
    return items;
  }, [productOptions]);

  const onSupplierChange = (sid) => {
    setNp((p) => ({ ...p, supplierId: sid }));
    setEditProductId(''); setEditQty(''); setEditCost('');
  };

  const onProductChange = (pid) => {
    setEditProductId(pid);
    if (!pid) { setEditCost(''); return; }
    const sp = supplierProduct(Number(np.supplierId), Number(pid));
    setEditCost(sp ? sp.supplier_price.toFixed(2) : '');
  };

  const submitItem = () => {
    const sid = Number(np.supplierId) || 0;
    const pid = Number(editProductId) || 0;
    const qty = Number(editQty);
    const cost = Number(editCost);
    if (!sid) return showToast('Select a supplier first');
    if (!pid) return showToast('Select a product');
    if (!Number.isInteger(qty) || qty < 1) return showToast('Quantity must be 1 or more');
    if (!(cost > 0)) return showToast('Enter a unit cost above 0');
    if (!hasAtMostTwoDecimalPlaces(cost)) return showToast('Unit cost can have at most 2 decimal places');

    const editing = np.editingIndex >= 0;
    const dup = np.items.findIndex((it, i) => it.product_id === pid && i !== np.editingIndex);
    if (dup >= 0) return showToast('That product is already in this purchase');

    const item = { product_id: pid, quantity: qty, unit_cost: round2(cost) };
    setNp((p) => {
      const items = [...p.items];
      if (editing) items[p.editingIndex] = item; else items.push(item);
      return { ...p, items, editingIndex: -1 };
    });
    setEditProductId(''); setEditQty(''); setEditCost('');
    setTouched((current) => ({
      ...current,
      product: false,
      quantity: false,
      cost: false,
    }));
    showToast(editing ? 'Item updated' : 'Item added to purchase');
  };

  const editItem = (i) => {
    const it = np.items[i];
    if (!it) return;
    setNp((p) => ({ ...p, editingIndex: i }));
    setEditProductId(String(it.product_id));
    setEditQty(String(it.quantity));
    setEditCost(it.unit_cost.toFixed(2));
  };

  const cancelEdit = () => {
    setNp((p) => ({ ...p, editingIndex: -1 }));
    setEditProductId(''); setEditQty(''); setEditCost('');
    setTouched((current) => ({ ...current, product: false, quantity: false, cost: false }));
  };

  const removeItem = (i) => setNp((p) => {
    const items = p.items.filter((_, idx) => idx !== i);
    return { ...p, items, editingIndex: -1 };
  });

  const readPayment = (purchaseDate, total) => {
    const fail = (msg) => { showToast(msg); return false; };
    const { payAmount: amountRaw, payMethod: method, payCheque: cheque } = np;
    const date = method === 'Cheque' ? np.dueDate : np.payDate;
    const trimmedAmount = String(amountRaw).trim();
    if (!PAYMENT_METHODS.includes(method)) return fail('Choose a payment method');
    if (method === 'Cheque' && !cheque.trim()) return fail('Enter the cheque number');
    if (method === 'Cheque') {
      const duplicateError = chequeDuplicateError(data.supplier_payments, {
        purchaseId: null,
        dueDate: date,
        chequeNumber: cheque,
      });
      if (duplicateError) return fail(duplicateError);
    }
    if (trimmedAmount === '') {
      if (method === 'Cheque') return { date, amount: 0, method, cheque: cheque.trim() };
      if (date || method || cheque) return fail('Enter the payment amount, or clear the supplier payment fields');
      return null;
    }
    if (!date) return fail('Choose the payment date');
    if (!isRealDate(date)) return fail('Enter a valid payment date');
    if (date < purchaseDate) return fail('Payment date can’t be before the purchase date (' + fmtDate(purchaseDate) + ')');
    if (method !== 'Cheque' && date > todayIso()) return fail('Payment date can’t be in the future');
    const a = method === 'Cheque'
      ? (() => {
        const value = Number(trimmedAmount);
        if (!Number.isFinite(value) || value < 0) return { error: 'Enter 0 or a valid amount' };
        if (!hasAtMostTwoDecimalPlaces(value)) return { error: 'Amount can have at most 2 decimal places' };
        if (value !== 0) return { error: 'Deferred cheque amount must be 0' };
        return { amount: round2(value) };
      })()
      : parsePayAmount(trimmedAmount, total, 'the purchase total');
    if (a.error) return fail(a.error);
    return { date, amount: a.amount, method, cheque: method === 'Cheque' ? cheque.trim() : null };
  };

  const completePurchase = async () => {
    if (saving) return;
    setShowValidation(true);
    const sid = Number(np.supplierId);
    if (!sid) return showToast('Select a supplier');
    if (!np.items.length) return showToast('Add at least one item');
    if (!np.date) return showToast('Choose a purchase date');
    if (!isRealDate(np.date)) return showToast('Enter a valid purchase date');
    if (np.date > todayIso()) return showToast('Purchase date can’t be in the future');
    if (!np.dueDate) return showToast('Choose a due date');
    if (!isRealDate(np.dueDate)) return showToast('Enter a valid due date');
    if (np.dueDate < np.date) return showToast('Due date can’t be before the purchase date');
    if (np.scheduledDeliveryDate) {
      if (!isRealDate(np.scheduledDeliveryDate)) return showToast('Enter a valid scheduled delivery date');
      if (np.scheduledDeliveryDate < np.date) {
        return showToast('Scheduled delivery date can’t be before the purchase date (' + fmtDate(np.date) + ')');
      }
    }
    if (discountErr) return showToast(discountErr);
    if (totals.overLimit) return showToast('Discount can’t be more than the subtotal');
    const pay = readPayment(np.date, totals.total);
    if (pay === false) return;

    setSaving(true);
    try {
      const purchaseId = data.purchases.reduce((m, p) => Math.max(m, p.purchase_id), 0) + 1;
      const purchaseTime = isoTime(new Date());

      await add('purchases', {
        purchase_id: purchaseId,
        supplier_id: sid,
        user_id: user?.uid || null,
        purchase_date: np.date,
        due_date: np.dueDate,
        purchase_time: purchaseTime,
        discount_amount: totals.discount,
        total_amount: totals.total,
        payment_status: 'Unpaid',
        purchase_status: 'Active'
      }, 'purchase_id');

      const delId = data.supplier_deliveries.reduce((m, x) => Math.max(m, x.supplier_delivery_id), 0) + 1;
      await add('supplier_deliveries', {
        supplier_delivery_id: delId,
        purchase_id: purchaseId,
        user_id: user?.uid || null,
        scheduled_delivery_date: np.scheduledDeliveryDate || null,
        actual_delivery_date: null,
        receiving_status: 'Pending',
      }, 'supplier_delivery_id');

      let detailId = data.purchase_details.reduce((m, d) => Math.max(m, d.purchase_detail_id), 0);
      for (const it of np.items) {
        detailId += 1;
        await add('purchase_details', {
          purchase_detail_id: detailId, purchase_id: purchaseId,
          product_id: it.product_id, quantity: it.quantity,
          unit_cost: it.unit_cost, subtotal: lineSubtotal(it)
        }, 'purchase_detail_id');
      }

      let payId = null;
      let newPayStatus = 'Unpaid';
      if (pay) {
        payId = data.supplier_payments.reduce((m, x) => Math.max(m, x.supplier_payment_id), 0) + 1;
        await add('supplier_payments', {
          supplier_payment_id: payId,
          purchase_id: purchaseId,
          user_id: user?.uid || null,
          payment_date: pay.date,
          amount: pay.amount,
          payment_method: pay.method,
          cheque_number: pay.cheque,
        }, 'supplier_payment_id');
        const paid = round2(data.supplier_payments
          .filter((x) => x.purchase_id === purchaseId)
          .reduce((s, x) => s + x.amount, 0) + pay.amount);
        newPayStatus = paymentStatusOf(totals.total, paid);
        await update('purchases', String(purchaseId), { payment_status: newPayStatus });
      }

      /* ---------- Staff-facing, money-free mirror ---------- */
      await add('purchase_staff_view', {
        purchase_id: purchaseId,
        supplier_id: sid,
        supplier_name: supplierById(sid)?.supplier_name || '—',
        purchase_date: np.date,
        purchase_time: purchaseTime,
        scheduled_delivery_date: np.scheduledDeliveryDate || null,
        actual_delivery_date: null,
        purchase_status: 'Active',
        receiving_status: 'Pending',
        item_count: np.items.length,
        items: np.items.map((it) => ({
          product_id: it.product_id,
          product_name: productById(it.product_id)?.product_name || '—',
          product_code: productById(it.product_id)?.product_code || '',
          quantity: it.quantity,
        })),
        updated_at: purchaseTime,
      }, 'purchase_id');

      await writeAudit({
        user,
        actionType: 'CREATE',
        recordType: 'Purchase',
        recordId: fmtPurchaseId(purchaseId),
        details: {
          summary: `Created purchase ${fmtPurchaseId(purchaseId)} — total ${peso(totals.total)}, ${np.items.length} item(s)`,
          supplier_id: sid,
          supplier_name: supplierById(sid)?.supplier_name || null,
          due_date: np.dueDate,
          scheduled_delivery_date: np.scheduledDeliveryDate || null,
          total_amount: totals.total,
          payment_status: newPayStatus,
          initial_payment: pay ? pay.amount : 0,
        },
      });

      await refresh();
      showToast(pay ? 'Purchase and payment recorded ✓' : 'Purchase recorded ✓');
      setTimeout(() => navigate('/purchases/history'), 650);
    } catch (err) {
      console.error('PURCHASE FAILED:', err?.code, err?.message, err);
      showToast(`Purchase failed: ${err?.code || ''} ${err?.message || ''}`);
    } finally {
      setSaving(false);
    }
  };

  const chequeVisible = np.payMethod === 'Cheque';

  return (
    <>
      <Topbar title="New Purchase" />
      <Box sx={style.pageContent}>
        <Box sx={style.grid}>
          <Box>
            <Box sx={style.card}>
              <Typography sx={style.sectionTitle}>Purchase information</Typography>

              <Field label="Supplier" error={supplierErr} sx={{ mb: 1 }}>
                <TextField select size="small" fullWidth
                  value={np.supplierId}
                  onChange={(e) => onSupplierChange(e.target.value)}
                  onBlur={() => markTouched('supplier')}
                  SelectProps={{
                    MenuProps: { sx: { zIndex: 9999 }, PaperProps: { sx: { maxHeight: 320 } } },
                  }}>
                  <MenuItem value="">Select supplier…</MenuItem>
                  {data.suppliers.map((s) => (
                    <MenuItem key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</MenuItem>
                  ))}
                </TextField>
              </Field>
              {np.supplierId && supplierById(np.supplierId) && (
                <Typography sx={style.supplierHint}>
                  {supplierById(np.supplierId).contact_person}, {supplierById(np.supplierId).contact_number}
                </Typography>
              )}

              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
                <Field label="Purchase Date" error={purchaseDateErr}>
                  <TextField size="small" type="date" fullWidth
                    inputProps={{ max: todayIso() }}
                    value={np.date}
                    onChange={(e) => setNp((p) => ({ ...p, date: e.target.value }))}
                    onBlur={() => markTouched('purchaseDate')}
                    error={!!purchaseDateErr} />
                </Field>
                <Field label="Purchase Time">
                  <TextField size="small" fullWidth value="Set when saved" disabled sx={disabledFieldText} />
                </Field>
              </Box>
              <Field label="Due Date" error={dueDateErr} sx={{ mt: 1.5 }}>
                <TextField size="small" type="date" fullWidth
                  inputProps={{ min: np.date }}
                  value={np.dueDate}
                  onChange={(e) => setNp((p) => ({ ...p, dueDate: e.target.value }))}
                  onBlur={() => markTouched('dueDate')}
                  error={!!dueDateErr} />
              </Field>
              <Field label="Scheduled Delivery Date (optional)" error={scheduledDateErr} sx={{ mt: 1.5 }}>
                <TextField size="small" type="date" fullWidth
                  inputProps={{ min: np.date }}
                  value={np.scheduledDeliveryDate}
                  onChange={(e) => setNp((p) => ({ ...p, scheduledDeliveryDate: e.target.value }))}
                  onBlur={() => markTouched('scheduledDate')}
                  error={!!scheduledDateErr} />
              </Field>
            </Box>

            <Box sx={style.cardMt}>
              <Typography sx={style.sectionTitle}>
                {np.editingIndex >= 0 ? 'Edit item' : 'Add item'}
              </Typography>

              <Field label="Product" error={productErr} sx={{ mb: 1.5 }}>
                <TextField select size="small" fullWidth
                  value={editProductId}
                  error={!!productErr}
                  onChange={(e) => onProductChange(e.target.value)}
                  onBlur={() => markTouched('product')}
                  SelectProps={{
                    MenuProps: { sx: { zIndex: 9999 }, PaperProps: { sx: { maxHeight: 320 } } },
                  }}>
                  {productMenuChildren}
                </TextField>
              </Field>

              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
                <Field label="Quantity" error={quantityErr}>
                  <TextField size="small" type="number" fullWidth
                    inputProps={{ min: 1, step: 1 }}
                    value={editQty} onChange={(e) => setEditQty(e.target.value)}
                    onBlur={() => markTouched('quantity')}
                    error={!!quantityErr} />
                </Field>
                <Field label="Unit Cost" error={costErr}>
                  <TextField size="small" type="number" fullWidth
                    inputProps={{ min: 0.01, step: 0.01 }}
                    value={editCost} onChange={(e) => setEditCost(e.target.value)}
                    onBlur={() => markTouched('cost')}
                    error={!!costErr}
                    helperText={editProductId && supplierProduct(Number(np.supplierId), Number(editProductId))
                      ? 'Filled from this supplier’s price.'
                      : ''} />
                </Field>
              </Box>

              <Box sx={style.itemActions}>
                <Button variant="outlined" onClick={submitItem}>
                  {np.editingIndex >= 0 ? 'Update item' : '+ Add item'}
                </Button>
                {np.editingIndex >= 0 && <Button onClick={cancelEdit}>Cancel edit</Button>}
              </Box>
            </Box>

            {isAdmin && <Box sx={style.cardMt}>
              <Typography sx={style.sectionTitle}>Supplier payment</Typography>
              <Typography sx={style.payIntro}>
                Optional — record a supplier payment made for this purchase. Leave the amount blank for no initial payment.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
                        <Field label={chequeVisible ? 'Cheque Due Date' : 'Payment Date'} error={paymentDateErr}>
                  <TextField size="small" type="date" fullWidth
                            inputProps={{ min: np.date, max: chequeVisible ? np.dueDate : todayIso() }}
                            value={chequeVisible ? np.dueDate : np.payDate}
                    onChange={(e) => setNp((p) => ({ ...p, payDate: e.target.value }))}
                    onBlur={() => markTouched('paymentDate')}
                            disabled={chequeVisible}
                            error={!!paymentDateErr} />
                </Field>
                <Field label="Amount" error={paymentAmountErr}>
                  <TextField size="small" type="number" fullWidth
                    inputProps={{ min: chequeVisible ? 0 : 0.01, step: 0.01 }}
                    value={np.payAmount}
                    onChange={(e) => setNp((p) => ({ ...p, payAmount: e.target.value }))}
                    onBlur={() => markTouched('paymentAmount')}
                    error={!!paymentAmountErr} />
                </Field>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, mt: 1.5 }}>
                <Field label="Payment Method" error={paymentMethodErr}>
                  <TextField select size="small" fullWidth
                    value={np.payMethod}
                    onChange={(e) => setNp((p) => ({
                      ...p,
                      payMethod: e.target.value,
                      payDate: e.target.value === 'Cheque' ? p.dueDate : (p.payMethod === 'Cheque' ? todayIso() : p.payDate)
                    }))}
                    onBlur={() => markTouched('paymentMethod')}
                    error={!!paymentMethodErr}
                    SelectProps={{
                      MenuProps: { sx: { zIndex: 9999 }, PaperProps: { sx: { maxHeight: 320 } } },
                    }}>
                    <MenuItem value="">Select payment method</MenuItem>
                    {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </TextField>
                </Field>
                {chequeVisible && (
                  <Field label="Cheque Number" error={chequeErr}>
                    <TextField size="small" fullWidth
                      value={np.payCheque}
                      onChange={(e) => setNp((p) => ({ ...p, payCheque: e.target.value }))}
                      onBlur={() => markTouched('cheque')}
                      error={!!chequeErr} />
                  </Field>
                )}
              </Box>
            </Box>}
          </Box>

          <Box sx={style.card}>
            <Typography sx={style.sectionTitle}>Purchase items</Typography>

            <Box sx={style.tableWrap}>
              <Table size="small" sx={style.itemsTable}>
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Quantity</TableCell>
                    <TableCell align="right">Unit Cost</TableCell>
                    <TableCell align="right">Subtotal</TableCell>
                    <TableCell align="right" width={100}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {np.items.length === 0 ? (
                    <TableRow><TableCell colSpan={5} sx={style.emptyCell}>No items yet.</TableCell></TableRow>
                  ) : np.items.map((it, i) => {
                    const p = productById(it.product_id);
                    return (
                      <TableRow key={i}>
                        <TableCell>{p.product_name}<Box sx={style.hint}>{p.product_code}</Box></TableCell>
                        <TableCell align="right">{it.quantity}</TableCell>
                        <TableCell align="right">{peso(it.unit_cost)}</TableCell>
                        <TableCell align="right">{peso(lineSubtotal(it))}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => editItem(i)} title="Edit" aria-label={`Edit purchase item ${i + 1}`}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => setRemoveConfirmIndex(i)} title="Remove" aria-label={`Remove purchase item ${i + 1}`}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>

            <Field label="Discount (optional)" error={showValidation || touched.discount ? discountErr : ''} sx={{ mt: 2 }}>
              <TextField size="small" type="number" fullWidth
                inputProps={{ min: 0, step: 0.01 }}
                value={np.discount}
                onChange={(e) => setNp((p) => ({ ...p, discount: e.target.value }))}
                onBlur={() => markTouched('discount')}
                error={!!(showValidation || touched.discount) && !!discountErr}
                helperText={(showValidation || touched.discount) ? discountErr || '' : ''} />
            </Field>

            <Box sx={style.summaryBox}>
              <Box sx={style.summaryRow}><span>Subtotal</span><span>{peso(totals.subtotal)}</span></Box>
              <Box sx={style.summaryRow}><span>Discount</span><span>−{peso(totals.discount)}</span></Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={style.summaryTotal}><span>Total</span><span>{peso(totals.total)}</span></Box>
            </Box>

            <Box sx={style.footerActions}>
              <Button variant="outlined" onClick={() => navigate('/purchases/history')}>Cancel</Button>
              <Button variant="contained" onClick={() => setConfirmOpen(true)} disabled={saving} aria-busy={saving}>
                {saving && <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />}
                {saving ? 'Processing…' : 'Complete purchase'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
      <Modal
        open={confirmOpen}
        title="Confirm purchase"
        onClose={() => setConfirmOpen(false)}
        onConfirm={completePurchase}
        confirmLabel="Confirm purchase"
        confirmationLabel="Complete purchase"
        width="narrow"
      >
        <Typography sx={{ fontSize: 13, lineHeight: 1.6 }}>
          Record this purchase for {np.items.length} item(s), totaling {peso(totals.total)}?
          {' '}This will update inventory and create the supplier delivery and payment records.
        </Typography>
      </Modal>
      <Modal
        open={removeConfirmIndex !== null}
        title="Remove purchase item?"
        onClose={() => setRemoveConfirmIndex(null)}
        onConfirm={() => {
          if (removeConfirmIndex !== null) return removeItem(removeConfirmIndex);
          setRemoveConfirmIndex(null);
        }}
        confirmLabel="Remove item"
        width="confirm"
      >
        <Typography sx={{ fontSize: 13, lineHeight: 1.6 }}>
          {removeConfirmIndex !== null && np.items[removeConfirmIndex]
            ? `Remove ${productById(np.items[removeConfirmIndex].product_id)?.product_name || 'this product'} from the purchase?`
            : 'Remove this product from the purchase?'}
        </Typography>
      </Modal>
    </>
  );
}