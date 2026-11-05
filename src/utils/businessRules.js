import { todayIso } from './format';

export const CURRENT_USER_ID = 1;
export const PAGE_SIZE = 10;

export const SALE_TYPES = ['Walk-in Sale', 'Delivery Sale'];
export const PAYMENT_STATUSES = ['Unpaid', 'Partially Paid', 'Fully Paid'];
export const PAYMENT_CONFIRMATION_PENDING_LABEL = 'Unconfirmed';
export const DELIVERY_STATUSES = ['Pending', 'Checked', 'Delivered', 'Picked Up', 'Cancelled'];
export const DUE_SOON_DAYS = 3;
export const OPERATIONAL_STATUSES = [...DELIVERY_STATUSES.slice(0, 2), 'Overdue', 'Due Today', 'Due Soon', ...DELIVERY_STATUSES.slice(2)];
export const DELIVERY_NOT_APPLICABLE = 'Not Applicable';
export const SALE_STATUSES = ['Active', 'Completed', 'Cancelled'];
export const PAYMENT_TERM_STATUSES = ['Unpaid', 'Partially Paid', 'Paid'];
export const PAYMENT_METHODS = ['Cash', 'GCash', 'Bank Transfer', 'Cheque'];
export const PURCHASE_STATUSES = ['Active', 'Completed', 'Cancelled'];
export const RECEIVING_STATUSES = ['Pending', 'Checked', 'Received', 'Cancelled'];
export const RECEIVING_DISPLAY_STATUSES = [...RECEIVING_STATUSES.slice(0, 2), 'Overdue', 'Due Today', 'Due Soon', ...RECEIVING_STATUSES.slice(2)];
export const PRODUCT_STATUSES = ['Active', 'Inactive'];
export const WALK_IN_LABEL = 'Walk-in Customer';

export const normalizeChequeNumber = (value) => String(value ?? '').trim().toLowerCase();

export function chequeDuplicateError(supplierPayments, { purchaseId, dueDate, chequeNumber }) {
  const normalizedNumber = normalizeChequeNumber(chequeNumber);
  if (!normalizedNumber) return '';

  const chequePayments = supplierPayments.filter((payment) =>
    payment.payment_method === 'Cheque' && normalizeChequeNumber(payment.cheque_number)
  );
  if (chequePayments.some((payment) =>
    normalizeChequeNumber(payment.cheque_number) === normalizedNumber
  )) {
    return 'That cheque number has already been recorded';
  }
  if (chequePayments.some((payment) =>
    payment.purchase_id === purchaseId && payment.payment_date === dueDate
  )) {
    return 'A cheque has already been recorded for this purchase and due date';
  }
  return '';
}

export const stockStatusOf = (onHand, reorderLevel) =>
  onHand <= 0 ? 'Out of Stock' : (onHand <= reorderLevel ? 'Low Stock' : 'In Stock');

export const paymentStatusOf = (total, paid) =>
  paid <= 0 ? 'Unpaid' : (paid < total ? 'Partially Paid' : 'Fully Paid');

export const saleLine = (item) => Math.round((item.quantity * item.unit_price + Number.EPSILON) * 100) / 100;
export const lineSubtotal = (item) => Math.round((item.quantity * item.unit_cost + Number.EPSILON) * 100) / 100;
export const saleBalance = (s) => Math.round((s.total_amount - s.amount_paid + Number.EPSILON) * 100) / 100;

export function calcTotals(subtotal, discountRaw, deliveryFeeRaw = 0) {
  const discount = Math.max(0, Number(discountRaw) || 0);
  const deliveryFee = Math.max(0, Number(deliveryFeeRaw) || 0);
  const baseAfterDiscount = Math.max(0, subtotal - discount);
  return {
    subtotal: Math.round((subtotal + Number.EPSILON) * 100) / 100,
    discount: Math.round((discount + Number.EPSILON) * 100) / 100,
    delivery_fee: Math.round((deliveryFee + Number.EPSILON) * 100) / 100,
    total: Math.round((baseAfterDiscount + deliveryFee + Number.EPSILON) * 100) / 100,
    overLimit: discount > subtotal
  };
}

export const NS_PAY_MODES = [
  ['full', 'Paid in full now', ['walkin', 'delivery']],
  ['partial', 'Partial payment now, balance due on a date', ['walkin', 'delivery']],
  ['down', 'Down payment now, balance due on a date', ['walkin', 'delivery']],
  ['installment', 'Installments (initial payment optional)', ['walkin', 'delivery']],
  ['later', 'No payment now, due on a date', ['delivery']]
];

export function parsePayAmount(raw, maxAmount, maxWhat) {
  const s = String(raw).trim();
  if (s === '') return { error: 'Enter the payment amount' };
  const n = Number(s);
  if (!Number.isFinite(n)) return { error: 'Enter a valid amount' };
  if (n < 0) return { error: 'Amount can’t be negative' };
  if (n === 0) return { error: 'Amount must be greater than ₱0.00' };
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return { error: 'Amount can have at most 2 decimal places' };
  const r = Math.round((n + Number.EPSILON) * 100) / 100;
  if (r > maxAmount) return { error: `Amount can’t be more than ₱${maxAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${maxWhat})` };
  return { amount: r };
}

export const isValidTermNumber = (n) => Number.isInteger(n) && n >= 1;
export function validateTermNumbers(terms) {
  const nums = terms.map((t) => t.term_number);
  if (nums.some((n) => n === undefined || n === null || n === '')) return 'Every payment term needs a term number.';
  if (!nums.every(isValidTermNumber)) return 'Term numbers must be whole numbers starting at 1.';
  if (new Set(nums).size !== nums.length) return 'Two payment terms on this sale have the same term number.';
  const sorted = nums.slice().sort((a, b) => a - b);
  if (!sorted.every((n, i) => n === i + 1)) return 'Term numbers must run 1, 2, 3 … without gaps.';
  return null;
}

export const saleDeliveryStatus = (sale, customerDeliveries) => {
  if (sale.sale_type === 'Walk-in Sale') return DELIVERY_NOT_APPLICABLE;
  const d = customerDeliveries.find((x) => x.sale_id === sale.sale_id);
  return d ? d.delivery_status : 'Pending';
};

export const operationalStatusForDisplay = (status, scheduledDate) => {
  if (status !== 'Pending' && status !== 'Checked') return status || 'Pending';
  if (typeof scheduledDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    return status || 'Pending';
  }
  const today = todayIso();
  if (scheduledDate < today) return 'Overdue';
  if (scheduledDate === today) return 'Due Today';
  const soonLimit = new Date(`${today}T00:00:00`);
  soonLimit.setDate(soonLimit.getDate() + DUE_SOON_DAYS);
  if (scheduledDate <= soonLimit.toISOString().slice(0, 10)) return 'Due Soon';
  return status || 'Pending';
};

export const scheduledDeliveryDateOf = (delivery, status) =>
  delivery?.scheduled_delivery_date
  || ((status === 'Pending' || status === 'Checked') ? delivery?.delivery_date : null);

export const customerDeliveryStatusForDisplay = (sale, customerDeliveries) => {
  if (sale.sale_type === 'Walk-in Sale') return DELIVERY_NOT_APPLICABLE;
  const delivery = customerDeliveries.find((item) => item.sale_id === sale.sale_id);
  if (!delivery) return 'Pending';
  return operationalStatusForDisplay(
    delivery.delivery_status,
    scheduledDeliveryDateOf(delivery, delivery.delivery_status)
  );
};

export const receivingStatusForDisplay = (delivery) => {
  const status = delivery?.receiving_status || 'Pending';
  return operationalStatusForDisplay(status, scheduledDeliveryDateOf(delivery, status));
};

export function saleStatusOf(sale, customerDeliveries) {
  if (sale.sale_status === 'Cancelled') return 'Cancelled';
  const ds = saleDeliveryStatus(sale, customerDeliveries);
  const delivered = ds === 'Delivered' || ds === 'Picked Up' || ds === DELIVERY_NOT_APPLICABLE;
  return sale.payment_status === 'Fully Paid' && delivered ? 'Completed' : 'Active';
}

export function saleCancelBlockReason(sale, customerPayments, customerDeliveries) {
  if (sale.sale_status === 'Cancelled') return 'This sale is already cancelled';
  if (sale.sale_status === 'Completed') return 'Completed sales can’t be cancelled';
  const paid = sale.amount_paid > 0 || customerPayments.some((p) => p.sale_id === sale.sale_id && p.amount > 0);
  if (paid) return 'A payment has already been recorded for this sale';
  if (customerDeliveries.some((d) => d.sale_id === sale.sale_id
    && ['Delivered', 'Picked Up'].includes(d.delivery_status))) {
    return 'This sale has already been fulfilled';
  }
  return '';
}

export function saleOverdueAmount(sale, paymentTerms, customerPayments = []) {
  if (sale.sale_status === 'Cancelled' || sale.payment_status === 'Fully Paid') return 0;
  const terms = paymentTerms
    .filter((t) => t.sale_id === sale.sale_id)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || (a.term_number || 0) - (b.term_number || 0));
  if (!terms.length) return 0;
  const today = todayIso();
  const remaining = terms.map((term) => {
    const paid = customerPayments
      .filter((payment) => payment.sale_id === sale.sale_id && payment.payment_term_id === term.payment_term_id)
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    return Math.max(0, Math.round((Number(term.amount_due) - paid + Number.EPSILON) * 100) / 100);
  });
  const unassignedPayments = customerPayments
    .filter((payment) => payment.sale_id === sale.sale_id
      && !payment.payment_term_id
      && payment.payment_date > sale.sale_date)
    .sort((a, b) => a.payment_date.localeCompare(b.payment_date)
      || (a.customer_payment_id || 0) - (b.customer_payment_id || 0));

  for (const payment of unassignedPayments) {
    let amountLeft = Number(payment.amount) || 0;
    for (let index = 0; index < remaining.length && amountLeft > 0; index++) {
      const applied = Math.min(remaining[index], amountLeft);
      remaining[index] = Math.round((remaining[index] - applied + Number.EPSILON) * 100) / 100;
      amountLeft = Math.round((amountLeft - applied + Number.EPSILON) * 100) / 100;
    }
  }

  const overdue = remaining.reduce((sum, amount, index) =>
    sum + (terms[index].due_date < today ? amount : 0), 0);
  return Math.min(saleBalance(sale), Math.max(0, Math.round((overdue + Number.EPSILON) * 100) / 100));
}

export const isSaleOverdue = (sale, paymentTerms, customerPayments) =>
  saleOverdueAmount(sale, paymentTerms, customerPayments) > 0;

export function saleDueStatus(sale, paymentTerms, customerPayments = []) {
  if (saleOverdueAmount(sale, paymentTerms, customerPayments) > 0) return 'Overdue';
  if (sale.sale_status === 'Cancelled' || sale.payment_status === 'Fully Paid') return '';
  const terms = paymentTerms
    .filter((term) => term.sale_id === sale.sale_id)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || (a.term_number || 0) - (b.term_number || 0));
  const today = todayIso();
  const soonLimit = new Date(`${today}T00:00:00`);
  soonLimit.setDate(soonLimit.getDate() + DUE_SOON_DAYS);
  const limit = soonLimit.toISOString().slice(0, 10);
  const hasUnpaidTerm = terms.some((term) => {
    const paid = customerPayments
      .filter((payment) => payment.sale_id === sale.sale_id && payment.payment_term_id === term.payment_term_id)
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    return Number(term.amount_due) > paid && term.due_date >= today && term.due_date <= limit;
  });
  if (!hasUnpaidTerm) return '';
  return terms.some((term) => term.due_date === today) ? 'Due Today' : 'Due Soon';
}

export const isPurchaseOverdue = (purchase, supplierPayments = []) => {
  if (purchase.purchase_status === 'Cancelled' || purchase.payment_status === 'Fully Paid') return false;
  if (!purchase.due_date || purchase.due_date >= todayIso()) return false;
  const paid = supplierPayments
    .filter((payment) => payment.purchase_id === purchase.purchase_id)
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  return paid < Number(purchase.total_amount || 0);
};

export function purchaseDueStatus(purchase, supplierPayments = []) {
  if (isPurchaseOverdue(purchase, supplierPayments)) return 'Overdue';
  if (purchase.purchase_status === 'Cancelled' || purchase.payment_status === 'Fully Paid') return '';
  const dueDate = purchase.due_date;
  if (!dueDate) return '';
  const today = todayIso();
  const soonLimit = new Date(`${today}T00:00:00`);
  soonLimit.setDate(soonLimit.getDate() + DUE_SOON_DAYS);
  const paid = supplierPayments
    .filter((payment) => payment.purchase_id === purchase.purchase_id)
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  if (paid >= Number(purchase.total_amount || 0) || dueDate < today || dueDate > soonLimit.toISOString().slice(0, 10)) return '';
  return dueDate === today ? 'Due Today' : 'Due Soon';
}

export const receivingStatusOfPurchase = (purchaseId, supplierDeliveries) => {
  const d = supplierDeliveries.find((x) => x.purchase_id === purchaseId);
  return d ? d.receiving_status : 'Pending';
};

export function purchaseStatusOf(pur, supplierDeliveries) {
  if (pur.purchase_status === 'Cancelled') return 'Cancelled';
  return pur.payment_status === 'Fully Paid'
    && receivingStatusOfPurchase(pur.purchase_id, supplierDeliveries) === 'Received'
    ? 'Completed' : 'Active';
}

export function purchaseCancelBlockReason(pur, supplierDeliveries, supplierPayments) {
  if (pur.purchase_status === 'Cancelled') return 'This purchase is already cancelled';
  const status = receivingStatusOfPurchase(pur.purchase_id, supplierDeliveries);
  if (status === 'Received') return 'This purchase has already been received';
  if (status === 'Cancelled') return 'This purchase is already cancelled';
  if (supplierPayments.some((x) => x.purchase_id === pur.purchase_id && x.amount > 0))
    return 'A payment has already been recorded for this purchase';
  return '';
}