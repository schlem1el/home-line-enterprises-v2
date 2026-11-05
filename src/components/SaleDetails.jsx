import React from 'react';
import { Box, Typography, Chip, Table, TableHead, TableBody, TableRow, TableCell } from '@mui/material';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import PaymentStatusBadges from './PaymentStatusBadges';
import StatusBadge from './StatusBadge';
import OperationalStatus from './OperationalStatus';
import { TOKENS, sectionTitleTop, cellSubStyle } from '../styles/HomeLineStyles';
import {
  PAYMENT_CONFIRMATION_PENDING_LABEL, saleBalance, customerDeliveryStatusForDisplay,
  scheduledDeliveryDateOf, isSaleOverdue, saleDueStatus, saleOverdueAmount
} from '../utils/businessRules';
import { peso, fmtDate, fmtTime, fmtSaleId, fmtQty, fmtDeliveryId, round2 } from '../utils/format';

const COLOR_MAP = {
  Active: 'warning', Completed: 'success', Cancelled: 'default',
  Unpaid: 'default', 'Partially Paid': 'warning', 'Fully Paid': 'success',
  'Not Delivered': 'default', 'Partially Delivered': 'warning', 'Fully Delivered': 'success',
  'Not Applicable': 'default', Paid: 'success', Delivered: 'success',
  Pending: 'warning', Checked: 'info'
};

export default function SaleDetails({ sale }) {
  const { data, customerById, saleDetailsOf, productById } = useData();
  const { isAdmin } = useAuth();

  const customer = sale.customer_id ? customerById(sale.customer_id) : null;
  const lines = saleDetailsOf(sale.sale_id);
  const subtotal = round2(lines.reduce((sum, d) => sum + d.subtotal, 0));
  const payments = data.customer_payments
    .filter((p) => p.sale_id === sale.sale_id)
    .sort((a, b) => a.payment_date.localeCompare(b.payment_date) || a.customer_payment_id - b.customer_payment_id);
  const terms = data.payment_terms
    .filter((t) => t.sale_id === sale.sale_id)
    .sort((a, b) => (a.term_number || 0) - (b.term_number || 0) || a.due_date.localeCompare(b.due_date));
  const delivery = data.customer_deliveries.find((d) => d.sale_id === sale.sale_id);
  const deliveryStatus = customerDeliveryStatusForDisplay(sale, data.customer_deliveries);
  const overdue = isSaleOverdue(sale, data.payment_terms, data.customer_payments);

  const deliveryFee = round2(Number(sale.delivery_fee) || 0);

  return (
    <Box>
      <Typography sx={sectionTitleTop}>Sale information</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 2, mb: 2 }}>
        <Info label="Sale ID" value={fmtSaleId(sale.sale_id)} />
        <Info label="Sale Type" value={sale.sale_type} />
        <Info label="Customer" value={customer ? customer.customer_name : 'Walk-in Customer'}
          sub={customer ? <>{customer.contact_number}<br />{customer.address}</> : null} />
        <Info label="Sale Date" value={fmtDate(sale.sale_date)} />
        <Info label="Sale Time" value={fmtTime(sale.sale_time)} />
        {sale.payment_confirmation && (
          <Info
            label="Payment Confirmation"
            value={`${sale.payment_confirmation.payment_method} — ${sale.payment_confirmation.status === 'Pending Confirmation'
              ? PAYMENT_CONFIRMATION_PENDING_LABEL
              : sale.payment_confirmation.status} (${peso(sale.payment_confirmation.amount)})`}
          />
        )}
        {isAdmin && <Info label="Sale Status" value={<StatusBadge status={sale.sale_status} />} />}

        {!isAdmin && <Info label="Payment Status" value={<PaymentStatusBadges
          status={sale.payment_status}
          pendingConfirmation={sale.payment_confirmation?.status === 'Pending Confirmation'}
        />} />}
        {isAdmin && (
          <>
            <Info label="Payment Status" value={<PaymentStatusBadges
              status={sale.payment_status}
              dueStatus={saleDueStatus(sale, data.payment_terms, data.customer_payments)}
              pendingConfirmation={sale.payment_confirmation?.status === 'Pending Confirmation'}
            />} />
            {overdue && <Info label="Overdue Amount" value={peso(saleOverdueAmount(sale, data.payment_terms, data.customer_payments))} />}
          </>
        )}

        <Info label="Delivery Status" value={delivery
          ? <OperationalStatus status={delivery.delivery_status} scheduledDate={scheduledDeliveryDateOf(delivery, delivery.delivery_status)} />
          : <Chip label={deliveryStatus} color={COLOR_MAP[deliveryStatus] || 'default'} size="small" />} />
      </Box>

      <Typography sx={sectionTitleTop}>Sale items</Typography>
      <Box sx={saleDetailTableWrap}>
        <Table size="small" sx={{ minWidth: 460 }}>
          <TableHead><TableRow>
            <TableCell>Product</TableCell><TableCell align="right">Quantity</TableCell>
            <TableCell align="right">Selling Price</TableCell><TableCell align="right">Subtotal</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {lines.map((d) => {
              const p = productById(d.product_id);
              return (
                <TableRow key={d.sale_detail_id}>
                  <TableCell>{p?.product_name || '—'}<Box sx={cellSubStyle}>{p?.product_code}</Box></TableCell>
                  <TableCell align="right">{fmtQty(d.quantity)}</TableCell>
                  <TableCell align="right">{peso(d.unit_price)}</TableCell>
                  <TableCell align="right">{peso(d.subtotal)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      <Typography sx={sectionTitleTop}>Transaction summary</Typography>
      <Box>
        <Row label="Subtotal" value={peso(subtotal)} />
        <Row label="Discount" value={'−' + peso(sale.discount_amount)} />
        {deliveryFee > 0 && isAdmin && <Row label="Delivery Fee" value={peso(deliveryFee)} />}
        <Row label="Total" value={peso(sale.total_amount)} bold />
        {sale.amount_received != null && sale.change_amount != null && (
          <>
            <Row label="Amount Received" value={peso(sale.amount_received)} />
            <Row label="Change" value={peso(sale.change_amount)} />
          </>
        )}
        {isAdmin && (
          <>
            <Row label="Amount Paid" value={peso(sale.amount_paid)} />
            <Row label="Remaining Balance" value={peso(saleBalance(sale))} bold />
          </>
        )}
      </Box>

      {isAdmin && (
        <>
          <Typography sx={sectionTitleTop}>Payment history</Typography>
          <Box sx={saleDetailTableWrap}>
            <Table size="small" sx={{ minWidth: 460 }}>
              <TableHead><TableRow>
                <TableCell>Payment Date</TableCell><TableCell align="right">Amount</TableCell>
                <TableCell>Payment Method</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow><TableCell colSpan={3} sx={{ textAlign: 'center', color: TOKENS.gray5, py: '28px' }}>
                    No payments received yet.
                  </TableCell></TableRow>
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
              <Typography sx={sectionTitleTop}>Payment schedule</Typography>
              <Box sx={saleDetailTableWrap}>
                <Table size="small" sx={{ minWidth: 460 }}>
                  <TableHead><TableRow>
                    <TableCell>Term</TableCell><TableCell>Due Date</TableCell>
                    <TableCell align="right">Amount Due</TableCell><TableCell>Status</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {terms.map((t) => (
                      <TableRow key={t.payment_term_id}>
                        <TableCell>{t.term_number ? 'Term ' + t.term_number : 'Term —'}</TableCell>
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
        </>
      )}

      {delivery && (
        <>
          <Typography sx={sectionTitleTop}>Delivery</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 2 }}>
            <Info label="Delivery ID" value={fmtDeliveryId(delivery.customer_delivery_id)} />
            <Info label="Scheduled Delivery" value={fmtDate(delivery.scheduled_delivery_date || delivery.delivery_date)} />
            <Info label="Actual Delivery / Pickup" value={fmtDate(delivery.actual_delivery_date)} />
            <Info label="Delivery Status" value={<OperationalStatus
              status={delivery.delivery_status}
              scheduledDate={scheduledDeliveryDateOf(delivery, delivery.delivery_status)}
            />} />
          </Box>
        </>
      )}
    </Box>
  );
}

const saleDetailTableWrap = { border: `1px solid ${TOKENS.lineSoft}`, borderRadius: 1, overflow: 'auto', mb: 2 };

const Info = ({ label, value, sub }) => (
  <Box>
    <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark, letterSpacing: 0.4, mb: 0.25 }}>{label}</Typography>
    <Typography sx={{ fontSize: 13 }}>{value}</Typography>
    {sub && <Typography sx={cellSubStyle}>{sub}</Typography>}
  </Box>
);

const Row = ({ label, value, bold }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
    <Typography sx={{ fontSize: 13 }}>{label}</Typography>
    <Typography sx={{ fontSize: 13, fontWeight: bold ? 700 : 400, color: bold ? TOKENS.hlBlueDark : 'inherit' }}>{value}</Typography>
  </Box>
);