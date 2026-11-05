import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, TextField, MenuItem, Button, Divider, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell,
  ToggleButton, ToggleButtonGroup, Alert, IconButton
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
import style from '../styles/NewSaleStyles';
import { disabledFieldText } from '../styles/HomeLineStyles';
import { writeAudit } from '../utils/auditHelpers';
import { collection, doc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  PAYMENT_METHODS, WALK_IN_LABEL,
  NS_PAY_MODES, calcTotals, saleLine, stockStatusOf, paymentStatusOf, saleStatusOf, validateTermNumbers
} from '../utils/businessRules';
import { peso, isoDate, isoTime, fmtQty, round2, addDaysIso, addMonthsIso, fmtDate, fmtSaleId, isRealDate } from '../utils/format';
import { hasAtMostTwoDecimalPlaces } from '../utils/validation';
import { generateSaleReceipt } from '../utils/pdfReport';

const emptyState = () => ({
  type: 'walkin', items: [], editingIndex: -1,
  customerId: '', date: isoDate(new Date()), discount: '',
  payMode: 'full', down: '', cashReceived: '', method: 'Cash', due: '', instCount: 3, instFreq: 'monthly',
  instFirst: '', delDate: '', deliveryFee: ''
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
function deliveryFeeError(raw) {
  const s = String(raw ?? '').trim();
  if (s === '') return '';
  const n = Number(s);
  if (!Number.isFinite(n)) return 'Enter a valid amount';
  if (n < 0) return 'Delivery fee can’t be negative';
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return 'At most 2 decimal places';
  return '';
}
function dateFieldError(raw, label, { required = true, maxToday = false, minDate = '' } = {}) {
  const value = String(raw ?? '').trim();
  if (!value) return required ? `Choose a ${label.toLowerCase()}` : '';
  if (!isRealDate(value)) return `Enter a valid ${label.toLowerCase()}`;
  if (maxToday && value > isoDate(new Date())) return `${label} can’t be in the future`;
  if (minDate && value < minDate) return `${label} can’t be before the sale date`;
  return '';
}
function quantityFieldError(raw) {
  if (String(raw ?? '').trim() === '') return 'Enter a quantity';
  const value = Number(raw);
  return !Number.isInteger(value) || value < 1 ? 'Quantity must be 1 or more' : '';
}
function paymentModeLabel(mode, isTransfer, defaultLabel) {
  if (!isTransfer) return defaultLabel;
  if (mode === 'full') return 'Full payment submitted, awaiting confirmation';
  if (mode === 'partial') return 'Partial payment submitted, balance due on a date';
  if (mode === 'down') return 'Down payment submitted, balance due on a date';
  if (mode === 'installment') return 'Installments (initial payment submitted, optional)';
  return defaultLabel;
}

export default function NewSale() {
  const { data, refresh, productById, inventoryByProduct, customerById } = useData();
  const { user, isAdmin } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();
  const [s, setS] = useState(emptyState());
  const [saving, setSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [touched, setTouched] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeConfirmIndex, setRemoveConfirmIndex] = useState(null);

  const [editProductId, setEditProductId] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const markTouched = (field) => setTouched((current) => ({ ...current, [field]: true }));

  useEffect(() => { setS(emptyState()); }, []);
  useEffect(() => {
    setS((p) => ({
      ...p,
      payMode: 'full',
      down: '', cashReceived: '', due: '', instFirst: '',
      deliveryFee: p.type === 'walkin' ? '' : p.deliveryFee
    }));
  }, [s.type]);

  const isDelivery = s.type === 'delivery';
  const availablePaymentMethods = isAdmin
    ? PAYMENT_METHODS.filter((method) => method !== 'Cheque')
    : PAYMENT_METHODS.filter((method) => method !== 'Cheque' && ['Cash', 'GCash', 'Bank Transfer'].includes(method));
  const subtotal = useMemo(() => round2(s.items.reduce((sum, it) => sum + saleLine(it), 0)), [s.items]);

  const effectiveDeliveryFee = isDelivery ? (Number(s.deliveryFee) || 0) : 0;
  const totals = useMemo(
    () => calcTotals(subtotal, s.discount, effectiveDeliveryFee),
    [subtotal, s.discount, effectiveDeliveryFee]
  );
  const isCashFullPayment = s.payMode === 'full' && s.method === 'Cash';
  const enteredCash = Number(s.cashReceived);
  const cashReceivedAmount = String(s.cashReceived).trim() && Number.isFinite(enteredCash)
    ? round2(enteredCash)
    : totals.total;
  const arrangementValue = s.payMode;
  const changeAmount = isCashFullPayment
    ? round2(Math.max(0, cashReceivedAmount - totals.total))
    : 0;
  const enteredPaymentAmount = isCashFullPayment
    ? cashReceivedAmount
    : (s.payMode === 'partial' || s.payMode === 'down' || s.payMode === 'installment')
      ? round2(Number(s.down) || 0)
      : s.payMode === 'later' ? 0 : totals.total;
  const plannedPaymentAmount = round2(Math.min(totals.total, Math.max(0, enteredPaymentAmount)));
  const isTransferPayment = ['GCash', 'Bank Transfer'].includes(s.method);
  const pendingConfirmationAmount = isTransferPayment ? plannedPaymentAmount : 0;
  const paymentReceivedNow = isTransferPayment ? 0 : plannedPaymentAmount;
  const remainingBalance = round2(totals.total - paymentReceivedNow);

  const discountErr = discountError(s.discount, subtotal);
  const rawFeeErr = isDelivery ? deliveryFeeError(s.deliveryFee) : '';
  const feeErr = (showValidation || touched.deliveryFee) ? rawFeeErr : '';
  const visibleDiscountErr = showValidation || touched.discount ? discountErr : '';
  const customerErr = (showValidation || touched.customer) && isDelivery && !s.customerId ? 'Select a customer' : '';
  const saleDateErr = (showValidation || touched.saleDate) ? dateFieldError(s.date, 'Sale date', { maxToday: true }) : '';
  const productErr = touched.product && !editProductId ? 'Select a product' : '';
  const quantityErr = touched.quantity ? quantityFieldError(editQty) : '';
  const deliveryDateErr = (showValidation || touched.deliveryDate) && isDelivery
    ? dateFieldError(s.delDate, 'Delivery date', { minDate: s.date })
    : '';
  const paymentMethodErr = (showValidation || touched.paymentMethod) && s.payMode !== 'later'
    && !availablePaymentMethods.includes(s.method)
    ? 'Choose a payment method'
    : '';
  const requiresBalanceDueDate = s.payMode === 'partial' || s.payMode === 'down' || s.payMode === 'later';
  const dueDateErr = (showValidation || touched.dueDate) && requiresBalanceDueDate
    ? dateFieldError(s.due, s.payMode === 'later' ? 'Payment due date' : 'Balance due date', {
      minDate: s.date
    })
    : '';
  const installmentCountErr = (showValidation || touched.installmentCount) && s.payMode === 'installment'
    && (!Number.isInteger(Number(s.instCount)) || Number(s.instCount) < 2 || Number(s.instCount) > 12)
    ? 'Enter 2 to 12 installments'
    : '';
  const installmentDateErr = (showValidation || touched.installmentDate) && s.payMode === 'installment'
    ? dateFieldError(s.instFirst, 'First installment due date', { minDate: s.date })
    : '';
  const initialPaymentErr = (showValidation || touched.initialPayment)
    && (s.payMode === 'partial' || s.payMode === 'down' || s.payMode === 'installment')
    ? (() => {
      const raw = String(s.down ?? '').trim();
      if (s.payMode === 'installment' && !raw) return '';
      if (!hasAtMostTwoDecimalPlaces(s.down)) {
        return s.payMode === 'partial'
          ? 'Partial payment can have at most 2 decimal places'
          : s.payMode === 'down'
          ? 'Down payment can have at most 2 decimal places'
          : 'Initial payment can have at most 2 decimal places';
      }
      const amount = Number(s.down);
      if ((s.payMode === 'down' || s.payMode === 'partial') && !(amount > 0)) {
        return s.payMode === 'partial' ? 'Enter the partial payment received' : 'Enter the down payment received';
      }
      if (s.payMode === 'installment' && amount < 0) return 'Initial payment can’t be negative';
      if (amount >= totals.total) {
        return s.payMode === 'partial'
          ? 'Partial payment must be less than the total'
          : s.payMode === 'down'
          ? 'Down payment must be less than the total'
          : 'Initial payment must be less than the total';
      }
      return '';
    })()
    : '';
  const cashReceivedErr = (showValidation || touched.cashReceived) && isCashFullPayment
    ? (() => {
      if (!String(s.cashReceived).trim()) return '';
      if (!hasAtMostTwoDecimalPlaces(s.cashReceived)) return 'Amount received can have at most 2 decimal places';
      const amount = Number(s.cashReceived);
      if (amount < 0) return 'Amount received can’t be negative';
      if (amount === 0) return 'Amount received must be greater than zero';
      if (round2(amount) < totals.total) return 'Amount received must cover the sale total';
      return '';
    })()
    : '';

  const activeProducts = data.products.filter((p) => p.status === 'Active');
  const stockLabel = (pid) => {
    const p = productById(pid); const inv = inventoryByProduct(pid);
    if (!p || !inv) return 'Select a product';
    return `${fmtQty(inv.quantity_on_hand)} ${p.unit}${inv.quantity_on_hand === 1 ? '' : 's'} in stock`;
  };

  const onProductChange = (pid) => {
    setEditProductId(pid);
    const p = productById(pid);
    setEditPrice(p ? p.selling_price.toFixed(2) : '');
  };

  const submitItem = () => {
    const productId = Number(editProductId) || 0;
    const qty = Number(editQty);
    const price = Number(editPrice);
    const inv = inventoryByProduct(productId);
    if (!productId) return showToast('Select a product');
    if (!Number.isInteger(qty) || qty < 1) return showToast('Quantity must be 1 or more');
    if (inv && qty > inv.quantity_on_hand) return showToast(`${productById(productId).product_name}: only ${stockLabel(productId)}`);
    if (!(price >= 0)) return showToast('Unit price can’t be negative');
    const dup = s.items.findIndex((it, i) => it.product_id === productId && i !== s.editingIndex);
    if (dup >= 0) return showToast('That product is already in this sale');
    const item = { product_id: productId, quantity: qty, unit_price: round2(price) };
    setS((p) => {
      const items = [...p.items];
      if (p.editingIndex >= 0) items[p.editingIndex] = item; else items.push(item);
      return { ...p, items, editingIndex: -1 };
    });
    setEditProductId(''); setEditQty(''); setEditPrice('');
    setTouched((current) => ({
      ...current,
      product: false,
      quantity: false,
    }));
    showToast(s.editingIndex >= 0 ? 'Item updated' : 'Item added to sale');
  };

  const editItem = (i) => {
    const it = s.items[i];
    setS((p) => ({ ...p, editingIndex: i }));
    setEditProductId(String(it.product_id));
    setEditQty(String(it.quantity));
    setEditPrice(it.unit_price.toFixed(2));
  };

  const removeItem = (i) => setS((p) => ({ ...p, items: p.items.filter((_, idx) => idx !== i), editingIndex: -1 }));

  const availableModes = NS_PAY_MODES.filter(([value, , types]) =>
    types.includes(s.type)
      && (isAdmin || value === 'full')
      && (isDelivery || s.customerId || value === 'full')
  );

  const buildPlan = (total, saleDate) => {
    const fail = (error, focus) => ({ error, focus });
    const dateProblem = (due, focus, what) => (!due
      ? fail(`Choose ${what}.`, focus)
      : !isRealDate(due) ? fail('Enter a valid due date.', focus)
        : due < saleDate ? fail('The due date can’t be before the sale date.', focus) : null);
    if (s.payMode === 'full') {
      const immediateAmount = isCashFullPayment ? cashReceivedAmount : total;
      if (immediateAmount >= total) return { immediateAmount: total, method: s.method, terms: [] };
      if (!(immediateAmount > 0)) return fail('Cash received must be greater than zero.', 'ns-cash-received');
      return fail('Cash received must cover the sale total.', 'ns-cash-received');
    }
    if (s.payMode === 'down' || s.payMode === 'partial') {
      if (!hasAtMostTwoDecimalPlaces(s.down)) {
        return fail(
          s.payMode === 'partial'
            ? 'Partial payment can have at most 2 decimal places.'
            : 'Down payment can have at most 2 decimal places.',
          'ns-down'
        );
      }
      const down = round2(Number(s.down));
      if (!(down > 0)) {
        return fail(
          s.payMode === 'partial' ? 'Enter the partial payment received.' : 'Enter the down payment received.',
          'ns-down'
        );
      }
      if (down >= total) {
        return fail(
          s.payMode === 'partial' ? 'Partial payment must be less than the total.' : 'Down payment must be less than the total.',
          'ns-down'
        );
      }
      const bad = dateProblem(s.due, 'ns-due', 'the due date for the remaining balance');
      if (bad) return bad;
      return { immediateAmount: down, method: s.method, terms: [{ term_number: 1, due_date: s.due, amount_due: round2(total - down) }] };
    }
    if (s.payMode === 'installment') {
      if (String(s.down).trim() && !hasAtMostTwoDecimalPlaces(s.down)) {
        return fail('Initial payment can have at most 2 decimal places.', 'ns-down');
      }
      const initial = round2(Number(s.down) || 0);
      if (initial < 0) return fail('Initial payment can’t be negative.', 'ns-down');
      if (initial >= total) return fail('Initial payment must be less than the total.', 'ns-down');
      const count = Number(s.instCount);
      if (!Number.isInteger(count) || count < 2 || count > 12) return fail('Enter 2 to 12 installments.', 'ns-inst-count');
      const bad = dateProblem(s.instFirst, 'ns-inst-first', 'the first installment due date');
      if (bad) return bad;
      const remaining = round2(total - initial);
      const base = Math.floor((remaining / count) * 100) / 100;
      if (!(base > 0)) return fail('The remaining balance is too small for that many installments.', 'ns-inst-count');
      const terms = [];
      for (let i = 0; i < count; i++) {
        const due = s.instFreq === 'monthly' ? addMonthsIso(s.instFirst, i)
          : addDaysIso(s.instFirst, (s.instFreq === 'biweekly' ? 14 : 7) * i);
        terms.push({ term_number: i + 1, due_date: due, amount_due: i === count - 1 ? round2(remaining - base * (count - 1)) : base });
      }
      return { immediateAmount: initial, method: s.method, terms };
    }
    const bad = dateProblem(s.due, 'ns-due', 'the payment due date');
    if (bad) return bad;
    return { immediateAmount: 0, method: '', terms: [{ term_number: 1, due_date: s.due, amount_due: total }] };
  };

  const preview = useMemo(() => {
    if (!(totals.total > 0) || totals.overLimit) return null;
    return buildPlan(totals.total, s.date || isoDate(new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals, s.payMode, s.down, s.cashReceived, s.due, s.instCount, s.instFreq, s.instFirst, s.method, s.date]);

  const completeSale = async () => {
    if (saving) return;
    setShowValidation(true);
    if (!s.date) return showToast('Choose a sale date');
    if (!isRealDate(s.date)) return showToast('Enter a valid sale date');
    if (s.date > isoDate(new Date())) return showToast('Sale date can’t be in the future');
    const customerId = Number(s.customerId) || 0;
    if (!isAdmin && s.payMode !== 'full') return showToast('Staff can only record payment in full');
    if (!isAdmin && !availablePaymentMethods.includes(s.method)) {
      return showToast('Staff can only use Cash, GCash, or Bank Transfer');
    }
    if (cashReceivedErr) return showToast(cashReceivedErr);
    if (isDelivery && !customerId) return showToast('A delivery sale needs a registered customer');
    if (!s.items.length) return showToast('Add at least one item');
    if (discountErr) return showToast(discountErr);
    if (isDelivery && rawFeeErr) return showToast(rawFeeErr);
    if (totals.overLimit) return showToast('Discount can’t be more than the subtotal');
    if (!(totals.total > 0)) return showToast('Total must be greater than ₱0.00');
    const plan = buildPlan(totals.total, s.date);
    if (plan.error) return showToast(plan.error);
    if (!isAdmin && plan.immediateAmount < totals.total) {
      return showToast('Staff can only record payment in full');
    }
    if (!isDelivery && plan.immediateAmount < totals.total && !customerId) {
      return showToast('A walk-in sale with a deferred payment needs a registered customer');
    }
    const termError = validateTermNumbers(plan.terms);
    if (termError) return showToast(termError);
    const over = s.items.find((it) => {
      const inventory = inventoryByProduct(it.product_id);
      return !inventory || it.quantity > inventory.quantity_on_hand;
    });
    if (over) {
      const inventory = inventoryByProduct(over.product_id);
      if (!inventory) return showToast(`Can’t complete sale: no inventory record for ${productById(over.product_id)?.product_name || 'a selected product'}`);
      return showToast(`${productById(over.product_id).product_name}: only ${stockLabel(over.product_id)}`);
    }
    if (isDelivery) {
      if (!s.delDate) return showToast('Choose a delivery date');
      if (!isRealDate(s.delDate)) return showToast('Enter a valid delivery date');
      if (s.delDate < s.date) return showToast('Delivery date can’t be before the sale date');
    }

    setSaving(true);
    try {
      const pendingPayment = ['GCash', 'Bank Transfer'].includes(plan.method) && plan.immediateAmount > 0
        ? {
          status: 'Pending Confirmation',
          amount: round2(plan.immediateAmount),
          payment_method: plan.method
        }
        : null;
      const paidNow = pendingPayment ? 0 : round2(plan.immediateAmount);
      const cashReceipt = plan.method === 'Cash' && paidNow > 0
        ? {
          amountReceived: isCashFullPayment ? cashReceivedAmount : paidNow,
          change: isCashFullPayment ? changeAmount : 0
        }
        : null;
      const saleTime = isoTime(new Date());
      // Use an auto-generated document key so creating a record does not require
      // read access to arbitrary candidate document IDs.
      const createRecordRef = (collectionName, startId) => ({
        id: startId,
        ref: doc(collection(db, collectionName))
      });

      const productIds = [...new Set(s.items.map((item) => Number(item.product_id)))];
      const inventoryQuerySnapshots = await Promise.all(productIds.map((productId) => getDocs(query(
        collection(db, 'inventory'),
        where('product_id', '==', productId)
      ))));

      const { sale, saleId: nextId } = await runTransaction(db, async (transaction) => {
        const inventorySnapshots = await Promise.all(inventoryQuerySnapshots.flatMap((snapshot) =>
          snapshot.docs.map((inventory) => transaction.get(inventory.ref))
        ));

        const saleRecord = createRecordRef(
          'sales',
          data.sales.reduce((max, row) => Math.max(max, Number(row.sale_id) || 0), 0) + 1
        );
        const detailRecords = [];
        let detailId = data.sale_details.reduce((max, row) => Math.max(max, Number(row.sale_detail_id) || 0), 0) + 1;
        for (let index = 0; index < s.items.length; index += 1) {
          const record = createRecordRef('sale_details', detailId);
          detailRecords.push(record);
          detailId = record.id + 1;
        }

        let paymentRecord = null;
        if (paidNow > 0) {
          paymentRecord = createRecordRef(
            'customer_payments',
            data.customer_payments.reduce((max, row) => Math.max(max, Number(row.customer_payment_id) || 0), 0) + 1
          );
        }

        const termRecords = [];
        let termId = data.payment_terms.reduce((max, row) => Math.max(max, Number(row.payment_term_id) || 0), 0) + 1;
        for (let index = 0; index < plan.terms.length; index += 1) {
          const record = createRecordRef('payment_terms', termId);
          termRecords.push(record);
          termId = record.id + 1;
        }

        let deliveryRecord = null;
        if (isDelivery) {
          deliveryRecord = createRecordRef(
            'customer_deliveries',
            data.customer_deliveries.reduce((max, row) => Math.max(max, Number(row.customer_delivery_id) || 0), 0) + 1
          );
        }

        const inventoryUpdates = [];
        inventoryQuerySnapshots.forEach((querySnapshot, index) => {
          const productId = productIds[index];
          const itemQuantity = s.items
            .filter((item) => Number(item.product_id) === productId)
            .reduce((sum, item) => sum + Number(item.quantity), 0);
          if (querySnapshot.size !== 1) {
            const productName = productById(productId)?.product_name || `product ${productId}`;
            throw new Error(`Can’t complete sale: expected one inventory record for ${productName}`);
          }
          const inventoryDoc = querySnapshot.docs[0];
          const inventorySnapshot = inventorySnapshots.find((snapshot) =>
            snapshot.ref.path === inventoryDoc.ref.path
          );
          if (!inventorySnapshot?.exists()) {
            throw new Error(`Inventory record for ${productById(productId)?.product_name || productId} no longer exists`);
          }
          const inventory = inventorySnapshot.data();
          const currentQty = Number(inventory.quantity_on_hand);
          if (!Number.isFinite(currentQty) || currentQty < itemQuantity) {
            const productName = productById(productId)?.product_name || `Product ${productId}`;
            throw new Error(`${productName}: available stock changed. Refresh and review the sale items.`);
          }
          const newQty = round2(currentQty - itemQuantity);
          inventoryUpdates.push({
            ref: inventoryDoc.ref,
            quantity_on_hand: newQty,
            stock_status: stockStatusOf(newQty, Number(inventory.reorder_level) || 0),
            last_updated: s.date
          });
        });

        const sale = {
          sale_id: saleRecord.id,
          customer_id: customerId || null,
          sale_type: isDelivery ? 'Delivery Sale' : 'Walk-in Sale',
          user_id: user?.uid || null,
          sale_date: s.date,
          sale_time: saleTime,
          discount_amount: totals.discount,
          delivery_fee: totals.delivery_fee,
          total_amount: totals.total,
          amount_paid: paidNow,
          ...(pendingPayment ? { payment_confirmation: pendingPayment } : {}),
          ...(cashReceipt ? {
            amount_received: cashReceipt.amountReceived,
            change_amount: cashReceipt.change,
          } : {}),
          payment_status: paymentStatusOf(totals.total, paidNow),
          sale_status: 'Active'
        };
        sale.sale_status = saleStatusOf(
          sale,
          isDelivery ? [{ sale_id: saleRecord.id, delivery_status: 'Pending' }] : []
        );

        inventoryUpdates.forEach(({ ref, ...stock }) => transaction.update(ref, stock));
        transaction.set(saleRecord.ref, sale);
        s.items.forEach((item, index) => transaction.set(detailRecords[index].ref, {
          sale_detail_id: detailRecords[index].id,
          sale_id: saleRecord.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: saleLine(item)
        }));
        if (paymentRecord) {
          transaction.set(paymentRecord.ref, {
            customer_payment_id: paymentRecord.id,
            sale_id: saleRecord.id,
            payment_term_id: null,
            user_id: user?.uid || null,
            payment_date: s.date,
            amount: paidNow,
            payment_method: plan.method
          });
        }
        plan.terms.forEach((term, index) => transaction.set(termRecords[index].ref, {
          payment_term_id: termRecords[index].id,
          sale_id: saleRecord.id,
          term_number: term.term_number,
          due_date: term.due_date,
          amount_due: term.amount_due,
          status: 'Unpaid'
        }));
        if (deliveryRecord) {
          transaction.set(deliveryRecord.ref, {
            customer_delivery_id: deliveryRecord.id,
            sale_id: saleRecord.id,
            user_id: user?.uid || null,
            scheduled_delivery_date: s.delDate,
            actual_delivery_date: null,
            delivery_status: 'Pending'
          });
        }

        return { sale, saleId: saleRecord.id };
      });

      await writeAudit({
        user,
        actionType: 'CREATE',
        recordType: 'Sale',
        recordId: fmtSaleId(nextId),
        details: {
          summary: `Created sale ${fmtSaleId(nextId)} — total ${peso(totals.total)}, ${s.items.length} item(s)`,
          customer_id: customerId || null,
          sale_type: sale.sale_type,
          total_amount: totals.total,
          amount_paid: paidNow,
          payment_status: sale.payment_status,
          sale_status: sale.sale_status,
          ...(pendingPayment ? { payment_confirmation: pendingPayment } : {}),
        },
      });

      await refresh();
      let receiptFailed = false;
      try {
        await generateSaleReceipt({
          sale,
          customer: customerById(sale.customer_id),
          lines: s.items.map((item) => ({
            ...item,
            subtotal: saleLine(item),
          })),
          products: new Map(s.items.map((item) => [Number(item.product_id), productById(item.product_id)])),
          payments: paidNow > 0 ? [{ amount: paidNow, payment_method: plan.method }] : [],
          amountReceived: cashReceipt?.amountReceived ?? null,
          change: cashReceipt?.change ?? null,
          delivery: isDelivery ? { scheduled_delivery_date: s.delDate } : null,
        });
      } catch (receiptError) {
        console.error('Sale receipt failed:', receiptError);
        receiptFailed = true;
      }
      showToast(receiptFailed
        ? pendingPayment
          ? 'Sale recorded; payment is pending confirmation, but the receipt could not be generated'
          : 'Sale recorded, but the receipt could not be generated'
        : pendingPayment
          ? 'Sale recorded; payment is pending confirmation. Receipt downloaded ✓'
          : 'Sale recorded and receipt downloaded ✓');
      setTimeout(() => navigate('/sales/history'), 650);
    } catch (err) {
      console.error('SALE FAILED:', err?.code, err?.message, err);
      showToast(`Sale failed: ${err?.code || ''} ${err?.message || ''}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Topbar title="New Sale" />
      <Box sx={style.pageContent}>
        <Box sx={style.grid}>
          {/* LEFT COLUMN */}
          <Box>
            <Box sx={style.card}>
              <Typography sx={style.sectionTitle}>Sale information</Typography>
              <ToggleButtonGroup value={s.type} exclusive size="small" sx={style.toggleGroup}
                onChange={(_, v) => v && setS((p) => ({ ...p, type: v }))}>
                <ToggleButton value="walkin" sx={style.toggleBtn}>Walk-in Sale</ToggleButton>
                <ToggleButton value="delivery" sx={style.toggleBtn}>Delivery Sale</ToggleButton>
              </ToggleButtonGroup>

              <Field label="Customer" error={customerErr} sx={{ mb: 2 }}>
                <TextField select size="small" fullWidth
                  value={s.customerId}
                  onChange={(e) => setS((p) => ({
                    ...p,
                    customerId: e.target.value,
                    payMode: !isDelivery && !e.target.value && p.payMode !== 'full' ? 'full' : p.payMode
                  }))}
                  onBlur={() => markTouched('customer')}>
                  {!isDelivery && <MenuItem value="">{WALK_IN_LABEL} (no customer record)</MenuItem>}
                  {isDelivery && <MenuItem value="">Select customer…</MenuItem>}
                  {data.customers.map((c) => (
                    <MenuItem key={c.customer_id} value={c.customer_id}>{c.customer_name}</MenuItem>
                  ))}
                </TextField>
              </Field>

              <Box sx={style.infoBox}>
                {customerById(s.customerId) ? (
                  <>
                    <strong>{customerById(s.customerId).customer_name}</strong><br />
                    {customerById(s.customerId).contact_number}<br />
                    {customerById(s.customerId).address}
                  </>
                ) : isDelivery
                  ? 'A delivery sale needs a registered customer.'
                  : 'Anonymous walk-in. No customer record is created.'}
              </Box>

              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
                <Field label="Sale Date" error={saleDateErr}>
                  <TextField size="small" type="date" fullWidth
                    inputProps={{ max: isoDate(new Date()) }}
                    value={s.date}
                    onChange={(e) => setS((p) => ({ ...p, date: e.target.value }))}
                    onBlur={() => markTouched('saleDate')}
                    error={!!saleDateErr} />
                </Field>
                <Field label="Sale Time">
                  <TextField size="small" fullWidth value="Set when saved" disabled sx={disabledFieldText} />
                </Field>
              </Box>
            </Box>

            <Box sx={style.cardMt}>
              <Typography sx={style.sectionTitle}>
                {s.editingIndex >= 0 ? 'Edit item' : 'Add item'}
              </Typography>
              <Field label="Product" error={productErr} sx={{ mb: 1.5 }}>
                <TextField select size="small" fullWidth
                  value={editProductId} onChange={(e) => onProductChange(e.target.value)}
                  onBlur={() => markTouched('product')}
                  error={!!productErr}
                  SelectProps={{
                    MenuProps: { sx: { zIndex: 9999 }, PaperProps: { sx: { maxHeight: 320 } } },
                  }}>
                  <MenuItem value="">Select product…</MenuItem>
                  {activeProducts.map((p) => (
                    <MenuItem key={p.product_id} value={p.product_id}>{p.product_name} ({p.unit})</MenuItem>
                  ))}
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
                <Field label="Available Stock">
                  <TextField size="small" fullWidth disabled
                    value={editProductId ? stockLabel(editProductId) : 'Select a product'}
                    sx={disabledFieldText} />
                </Field>
                <Field label="Selling Price">
                  <TextField size="small" type="number" fullWidth disabled
                    value={editPrice} sx={disabledFieldText} />
                </Field>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button variant="outlined" onClick={submitItem}>
                  {s.editingIndex >= 0 ? 'Update item' : '+ Add item'}
                </Button>
                {s.editingIndex >= 0 && (
                  <Button onClick={() => {
                    setS((p) => ({ ...p, editingIndex: -1 }));
                    setEditProductId('');
                    setEditQty('');
                    setEditPrice('');
                    setTouched((current) => ({ ...current, product: false, quantity: false }));
                  }}>
                    Cancel edit
                  </Button>
                )}
              </Box>
            </Box>

            {isDelivery && (
              <Box sx={style.cardMt}>
                <Typography sx={style.sectionTitle}>Delivery information</Typography>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
                  <Field label="Scheduled Delivery Date" error={deliveryDateErr}>
                    <TextField size="small" type="date" fullWidth
                      inputProps={{ min: s.date || isoDate(new Date()) }}
                      value={s.delDate}
                      onChange={(e) => setS((p) => ({ ...p, delDate: e.target.value }))}
                      onBlur={() => markTouched('deliveryDate')}
                      error={!!deliveryDateErr} />
                  </Field>
                  <Field
                    label="Delivery Fee (optional)"
                    error={feeErr ? `Error: ${feeErr}` : undefined}
                  >
                    <TextField size="small" type="number" fullWidth
                      inputProps={{ min: 0, step: 0.01 }}
                      value={s.deliveryFee}
                      onChange={(e) => setS((p) => ({ ...p, deliveryFee: e.target.value }))}
                      onBlur={() => markTouched('deliveryFee')}
                      error={!!feeErr}
                      helperText={feeErr || 'Included in the total charged.'} />
                  </Field>
                </Box>
              </Box>
            )}
          </Box>

          {/* RIGHT COLUMN */}
          <Box sx={style.card}>
            <Typography sx={style.sectionTitle}>Sale items</Typography>
            <Box sx={style.tableWrap}>
              <Table size="small" sx={style.itemsTable}>
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Selling Price</TableCell>
                    <TableCell align="right">Subtotal</TableCell>
                    <TableCell align="right" width={100}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {s.items.length === 0 ? (
                    <TableRow><TableCell colSpan={5} sx={style.emptyCell}>No items yet.</TableCell></TableRow>
                  ) : s.items.map((it, i) => {
                    const p = productById(it.product_id);
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          {p.product_name}
                          <Box sx={style.hint}>{p.product_code}</Box>
                        </TableCell>
                        <TableCell align="right">{it.quantity}</TableCell>
                        <TableCell align="right">{peso(it.unit_price)}</TableCell>
                        <TableCell align="right">{peso(saleLine(it))}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => editItem(i)} title="Edit" aria-label={`Edit sale item ${i + 1}`}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => setRemoveConfirmIndex(i)} title="Remove" aria-label={`Remove sale item ${i + 1}`}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>

            <Field
              label="Discount (optional)"
              sx={{ mt: 2 }}
              error={visibleDiscountErr ? `Error: ${visibleDiscountErr}` : undefined}
            >
              <TextField size="small" type="number" fullWidth
                inputProps={{ min: 0, step: 0.01 }}
                value={s.discount}
                onChange={(e) => setS((p) => ({ ...p, discount: e.target.value }))}
                onBlur={() => markTouched('discount')}
                error={!!visibleDiscountErr}
                helperText={visibleDiscountErr || ''} />
            </Field>

            <Box sx={style.summaryBox}>
              <Box sx={style.summaryRow}><span>Subtotal</span><span>{peso(totals.subtotal)}</span></Box>
              <Box sx={style.summaryRow}><span>Discount</span><span>−{peso(totals.discount)}</span></Box>
              {isDelivery && (
                <Box sx={style.summaryRow}><span>Delivery Fee</span><span>{peso(totals.delivery_fee)}</span></Box>
              )}
              <Divider sx={{ my: 1 }} />
              <Box sx={style.summaryTotal}><span>Total</span><span>{peso(totals.total)}</span></Box>
            </Box>
          </Box>
        </Box>

        <Box sx={style.cardMt}>
          <Typography sx={style.sectionTitle}>Payment arrangement</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <Box>
              <Field label="Arrangement" sx={{ mb: 2 }}>
                <TextField select size="small" fullWidth
                  value={arrangementValue} onChange={(e) => setS((p) => ({
                    ...p,
                    payMode: e.target.value,
                    cashReceived: ''
                  }))}>
                  {availableModes.map(([v, l]) => (
                    <MenuItem key={v} value={v}>
                      {paymentModeLabel(v, isTransferPayment, l)}
                    </MenuItem>
                  ))}
                </TextField>
              </Field>
              {(s.payMode === 'partial' || s.payMode === 'down' || s.payMode === 'installment') && (
                <Field
                  label={isTransferPayment
                    ? s.payMode === 'installment'
                      ? 'Initial Payment Submitted (optional)'
                      : s.payMode === 'partial' ? 'Partial Payment Submitted' : 'Down Payment Submitted'
                    : s.payMode === 'installment'
                      ? 'Initial Payment Received (optional)'
                      : s.payMode === 'partial' ? 'Partial Payment Received' : 'Down Payment Received'}
                  error={initialPaymentErr}
                  sx={{ mb: 2 }}>
                  <TextField size="small" type="number" fullWidth
                    inputProps={{ min: 0, step: 0.01 }}
                    value={s.down}
                    onChange={(e) => setS((p) => ({ ...p, down: e.target.value }))}
                    onBlur={() => markTouched('initialPayment')}
                    error={!!initialPaymentErr} />
                </Field>
              )}
              {s.payMode !== 'later' && (
                <Field label="Payment Method" error={paymentMethodErr} sx={{ mb: 2 }}>
                  <TextField select size="small" fullWidth
                    value={s.method} onChange={(e) => setS((p) => ({
                      ...p,
                      method: e.target.value,
                      cashReceived: ''
                    }))}
                    onBlur={() => markTouched('paymentMethod')}
                    error={!!paymentMethodErr}>
                    {availablePaymentMethods.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </TextField>
                </Field>
              )}
              {isCashFullPayment && (
                <>
                  <Field
                    label="Cash Received"
                    error={cashReceivedErr}
                    helperText="Defaults to the exact sale total."
                    sx={{ mb: 2 }}>
                    <TextField size="small" type="number" fullWidth
                      inputProps={{ min: 0.01, step: 0.01 }}
                      value={s.cashReceived || (totals.total > 0 ? totals.total.toFixed(2) : '')}
                      onChange={(e) => setS((p) => ({ ...p, cashReceived: e.target.value }))}
                      onBlur={() => markTouched('cashReceived')}
                      error={!!cashReceivedErr} />
                  </Field>
                  <Box sx={{ ...style.summaryRow, fontWeight: 700, mb: 2 }}>
                    <span>Change</span><span>{peso(changeAmount)}</span>
                  </Box>
                </>
              )}
              {isTransferPayment && pendingConfirmationAmount > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {s.method} payment of {peso(pendingConfirmationAmount)} will remain pending confirmation.
                  The sale can be completed now, but this amount will not count as paid until receipt is confirmed.
                </Alert>
              )}
              {requiresBalanceDueDate && (
                <Field label={s.payMode === 'later' ? 'Payment Due Date' : 'Balance Due Date'} error={dueDateErr} sx={{ mb: 2 }}>
                  <TextField size="small" type="date" fullWidth
                    inputProps={{ min: s.date }}
                    value={s.due}
                    onChange={(e) => setS((p) => ({ ...p, due: e.target.value }))}
                    onBlur={() => markTouched('dueDate')}
                    error={!!dueDateErr} />
                </Field>
              )}
              {s.payMode === 'installment' && (
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, flexWrap: 'wrap' }}>
                  <Field label="No. of Installments" error={installmentCountErr} sx={{ flex: '1 1 140px' }}>
                    <TextField size="small" type="number" fullWidth
                      inputProps={{ min: 2, max: 12, step: 1 }}
                      value={s.instCount}
                      onChange={(e) => setS((p) => ({ ...p, instCount: e.target.value }))}
                      onBlur={() => markTouched('installmentCount')}
                      error={!!installmentCountErr} />
                  </Field>
                  <Field label="Frequency" sx={{ flex: '1 1 140px' }}>
                    <TextField select size="small" fullWidth
                      value={s.instFreq}
                      onChange={(e) => setS((p) => ({ ...p, instFreq: e.target.value }))}>
                      <MenuItem value="monthly">Monthly</MenuItem>
                      <MenuItem value="biweekly">Every 2 weeks</MenuItem>
                      <MenuItem value="weekly">Weekly</MenuItem>
                    </TextField>
                  </Field>
                  <Field label="First Installment Due" error={installmentDateErr} sx={{ flex: '1 1 100%' }}>
                    <TextField size="small" type="date" fullWidth
                      inputProps={{ min: s.date }}
                      value={s.instFirst}
                      onChange={(e) => setS((p) => ({ ...p, instFirst: e.target.value }))}
                      onBlur={() => markTouched('installmentDate')}
                      error={!!installmentDateErr} />
                  </Field>
                </Box>
              )}
            </Box>
            <Box>
              {!preview ? (
                <Alert severity="info">Add items to set up payment.</Alert>
              ) : preview.error ? (
                <Alert severity="warning">{preview.error}</Alert>
              ) : preview.terms.length > 0 ? (
                <>
                  <Typography sx={style.sectionTitle}>Payment schedule</Typography>
                  <Box sx={style.tableWrap}>
                    <Table size="small" sx={style.itemsTable}>
                      <TableHead><TableRow>
                        <TableCell>Term</TableCell><TableCell>Due Date</TableCell>
                        <TableCell align="right">Amount Due</TableCell><TableCell>Status</TableCell>
                      </TableRow></TableHead>
                      <TableBody>
                        {preview.terms.map((t, i) => (
                          <TableRow key={i}>
                            <TableCell>Term {t.term_number}</TableCell>
                            <TableCell>{fmtDate(t.due_date)}</TableCell>
                            <TableCell align="right">{peso(t.amount_due)}</TableCell>
                            <TableCell>Unpaid</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                </>
              ) : null}
              {totals.total > 0 && !totals.overLimit && (
                <Box sx={{ ...style.summaryBox, mt: 2 }}>
                  {paymentReceivedNow > 0 && (
                    <Box sx={style.summaryRow}><span>Payment received now</span><span>{peso(paymentReceivedNow)}</span></Box>
                  )}
                  {pendingConfirmationAmount > 0 && (
                    <Box sx={style.summaryRow}>
                      <span>Pending confirmation ({s.method})</span><span>{peso(pendingConfirmationAmount)}</span>
                    </Box>
                  )}
                  <Box sx={{ ...style.summaryRow, fontWeight: 700 }}>
                    <span>Remaining balance</span><span>{peso(remainingBalance)}</span>
                  </Box>
                  <Box sx={style.summaryRow}>
                    <span>Payment status</span><span>{paymentStatusOf(totals.total, paymentReceivedNow)}</span>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        <Box sx={style.footerActions}>
          <Button variant="outlined" onClick={() => navigate('/sales/history')}>Cancel</Button>
          <Button variant="contained" onClick={() => setConfirmOpen(true)} disabled={saving} aria-busy={saving}>
            {saving && <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />}
            {saving ? 'Processing…' : 'Complete sale'}
          </Button>
        </Box>
      </Box>
      <Modal
        open={confirmOpen}
        title="Confirm sale"
        onClose={() => setConfirmOpen(false)}
        onConfirm={completeSale}
        confirmLabel="Confirm sale"
        confirmationLabel="Complete sale"
        width="narrow"
      >
        <Typography sx={{ fontSize: 13, lineHeight: 1.6 }}>
          Record this {isDelivery ? 'delivery ' : ''}sale for {s.items.length} item(s), totaling {peso(totals.total)}?
          {isDelivery ? ' This will also create a pending delivery record.' : ''}
          {pendingConfirmationAmount > 0
            ? ` Inventory and the sale will be recorded now; the ${s.method} payment of ${peso(pendingConfirmationAmount)} will remain pending confirmation and will not be counted as paid.`
            : ' Inventory and payment records will be updated.'}
        </Typography>
      </Modal>
      <Modal
        open={removeConfirmIndex !== null}
        title="Remove sale item?"
        onClose={() => setRemoveConfirmIndex(null)}
        onConfirm={() => {
          if (removeConfirmIndex !== null) removeItem(removeConfirmIndex);
          setRemoveConfirmIndex(null);
        }}
        confirmLabel="Remove item"
        width="confirm"
      >
        <Typography sx={{ fontSize: 13, lineHeight: 1.6 }}>
          {removeConfirmIndex !== null && s.items[removeConfirmIndex]
            ? `Remove ${productById(s.items[removeConfirmIndex].product_id)?.product_name || 'this product'} from the sale?`
            : 'Remove this product from the sale?'}
        </Typography>
      </Modal>
    </>
  );
}