import React, { useMemo, useState } from 'react';
import {
  Box, TextField, Button, Table, TableHead, TableBody,
  TableRow, TableCell, Typography, Chip, Card, CardContent, Divider,
  useMediaQuery, useTheme
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import Topbar from '../components/Topbar';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';
import DetailModal from '../components/DetailModal';
import SaleDetails from '../components/SaleDetails';
import PaymentStatusBadges from '../components/PaymentStatusBadges';
import OperationalStatus from '../components/OperationalStatus';
import Field from '../components/Field';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAudit } from '../utils/useAudit';
import style from '../styles/CustomersStyles';
import { TOKENS, filterChip, actionChip } from '../styles/HomeLineStyles';
import {
  PAGE_SIZE, customerDeliveryStatusForDisplay, saleDueStatus,
  scheduledDeliveryDateOf
} from '../utils/businessRules';
import { peso, fmtDate, fmtSaleId, round2 } from '../utils/format';
import { isValidPhilippineContactNumber, PH_CONTACT_NUMBER_ERROR } from '../utils/validation';
import { stopRowActivationPropagation } from '../utils/keyboard';

const COLOR_MAP = {
  Active: 'warning', Completed: 'success', Cancelled: 'default',
  Unpaid: 'default', 'Partially Paid': 'warning', 'Fully Paid': 'success',
  'Not Applicable': 'default', Pending: 'warning'
};

const CST_DEFAULT = { search: '', sortKey: 'name', sortDir: 'asc', page: 1 };

const CST_COLUMNS = [
  { key: 'name', label: 'Customer Name' },
  { key: 'contact', label: 'Contact Number' },
  { key: 'address', label: 'Address' },
  { key: 'purchases', label: 'Total Purchases', num: true }
];

export default function Customers() {
  const { data, add, update, refresh, customerById } = useData();
  const showToast = useToast();
  const log = useAudit();

  const [cst, setCst] = useState({ ...CST_DEFAULT });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ customer_name: '', contact_number: '', address: '' });
  const [detailId, setDetailId] = useState(null);
  const [saleDetailId, setSaleDetailId] = useState(null);

  const totalPurchases = (customerId) =>
    round2(data.sales
      .filter((s) => s.customer_id === customerId && s.sale_status !== 'Cancelled')
      .reduce((sum, s) => sum + s.total_amount, 0));

  const filtered = useMemo(() => {
    const q = cst.search.trim().toLowerCase();
    if (!q) return [...data.customers];
    return data.customers.filter((c) =>
      (c.customer_name + ' ' + c.contact_number + ' ' + c.address).toLowerCase().includes(q));
  }, [data.customers, cst.search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let r = 0;
      switch (cst.sortKey) {
        case 'name': r = a.customer_name.localeCompare(b.customer_name); break;
        case 'contact': r = a.contact_number.localeCompare(b.contact_number); break;
        case 'address': r = a.address.localeCompare(b.address); break;
        case 'purchases': r = totalPurchases(a.customer_id) - totalPurchases(b.customer_id); break;
      }
      if (r === 0) r = a.customer_id - b.customer_id;
      return cst.sortDir === 'asc' ? r : -r;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, cst.sortKey, cst.sortDir, data.sales]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, cst.page), totalPages);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const onSort = (key) => setCst((p) => ({
    ...p, sortKey: key,
    sortDir: p.sortKey === key && p.sortDir === 'asc' ? 'desc' : 'asc',
    page: 1
  }));

  const clearSearch = () => setCst((p) => ({ ...p, search: '', page: 1 }));

  const openAdd = () => {
    setEditingId(null);
    setDraft({ customer_name: '', contact_number: '', address: '' });
    setModalOpen(true);
  };

  const openEdit = (id) => {
    const c = customerById(id);
    if (!c) return;
    setEditingId(c.customer_id);
    setDraft({ customer_name: c.customer_name, contact_number: c.contact_number, address: c.address });
    setModalOpen(true);
  };

  const save = async () => {
    const name = draft.customer_name.trim().replace(/\s+/g, ' ');
    const contact = draft.contact_number.trim();
    const address = draft.address.trim();
    if (!name) return showToast('Enter a customer name');
    if (!contact) return showToast('Enter a contact number');
    if (!isValidPhilippineContactNumber(contact)) {
      return showToast(PH_CONTACT_NUMBER_ERROR);
    }
    if (!address) return showToast('Enter an address');

    if (editingId) {
      const c = customerById(editingId);
      await update('customers', c._docId, { customer_name: name, contact_number: contact, address });
      await refresh();
      await log('UPDATE', 'Customer', `CST-${String(editingId).padStart(4, '0')}`, {
        summary: `Updated customer "${name}"`,
        customer_id: editingId,
        customer_name: name,
        contact_number: contact,
        address,
      });
      showToast('Customer updated ✓');
    } else {
      const id = data.customers.reduce((m, c) => Math.max(m, c.customer_id), 0) + 1;
      await add('customers', { customer_id: id, customer_name: name, contact_number: contact, address }, 'customer_id');
      await refresh();
      await log('CREATE', 'Customer', `CST-${String(id).padStart(4, '0')}`, {
        summary: `Added customer "${name}"`,
        customer_id: id,
        customer_name: name,
        contact_number: contact,
        address,
      });
      showToast('Customer added ✓');
    }
    setModalOpen(false);
  };

  const detailCustomer = detailId ? customerById(detailId) : null;

  return (
    <>
      <Topbar title="Customers" />

      <Box sx={style.content}>
        {/* FIXED TOP LOOK - CSS Grid eliminates the massive vertical gap */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'minmax(200px, 1fr) auto auto' },
          gap: 2,
          mb: 3,
          alignItems: 'center'
        }}>
          <TextField size="small" placeholder="Search name, contact number or address"
            value={cst.search}
            onChange={(e) => setCst((p) => ({ ...p, search: e.target.value, page: 1 }))}
            fullWidth />
          <Button sx={{ ...filterChip, height: 40 }} startIcon={<SearchOffIcon />} onClick={clearSearch}>
            Clear Search
          </Button>
          <Button variant="contained" sx={{ height: 40 }} onClick={openAdd}>+ Add Customer</Button>
        </Box>

        {/* DESKTOP TABLE */}
        <Box sx={{ display: { xs: 'none', sm: 'block' }, ...style.tableWrap }}>
          <Table sx={style.historyTable}>
            <TableHead>
              <TableRow>
                {CST_COLUMNS.map((c) => {
                  const active = cst.sortKey === c.key;
                  const arrow = active ? (cst.sortDir === 'asc' ? '▲' : '▼') : '↕';
                  return (
                    <TableCell key={c.key} align={c.num ? 'right' : 'left'}
                      aria-sort={active ? (cst.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      onClick={() => onSort(c.key)}
                      sx={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      {c.label}
                      <Box component="span" sx={{ fontSize: 9, ml: '6px' }}>{arrow}</Box>
                    </TableCell>
                  );
                })}
                <TableCell sx={style.actionsCol}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={style.emptyCell}>
                    {data.customers.length ? 'No customers match this search.' : 'No customers yet. Select + Add Customer.'}
                  </TableCell>
                </TableRow>
              ) : pageRows.map((c) => (
                <TableRow key={c.customer_id} hover tabIndex={0}
                  onDoubleClick={() => setDetailId(c.customer_id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setDetailId(c.customer_id); } }}
                  sx={{ cursor: 'pointer' }}>
                  <TableCell>{c.customer_name}</TableCell>
                  <TableCell>{c.contact_number}</TableCell>
                  <TableCell>{c.address}</TableCell>
                  <TableCell align="right">{peso(totalPurchases(c.customer_id))}</TableCell>
                  <TableCell sx={style.actionsCell}>
                    <Button size="small" sx={actionChip} startIcon={<EditOutlinedIcon />}
                      onClick={(e) => { e.stopPropagation(); openEdit(c.customer_id); }}
                      onKeyDown={stopRowActivationPropagation}
                      aria-label={`Edit customer ${c.customer_name}`}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        {/* MOBILE CARDS */}
        <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 2 }}>
          {pageRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: TOKENS.gray5 }}>No customers match this search.</Box>
          ) : pageRows.map((c) => (
            <Card
              key={c.customer_id}
              variant="outlined"
              onClick={() => setDetailId(c.customer_id)}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetailId(c.customer_id);
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
                    <Typography sx={{ fontWeight: 700, fontSize: 14, color: TOKENS.hlBlueDark }}>{c.customer_name}</Typography>
                    <Typography sx={{ fontSize: 12, color: TOKENS.gray5, mt: 0.5 }}>{c.contact_number}</Typography>
                  </Box>
                </Box>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.gray5, letterSpacing: 0.5 }}>Address</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{c.address}</Typography>
                  </Box>
                  <Button size="small" sx={actionChip} startIcon={<EditOutlinedIcon />}
                    onClick={(e) => { e.stopPropagation(); openEdit(c.customer_id); }}
                    onKeyDown={stopRowActivationPropagation}
                    aria-label={`Edit customer ${c.customer_name}`}>
                    Edit
                  </Button>
                </Box>
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px dashed ${TOKENS.lineSoft}`, display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: 11, color: TOKENS.gray5 }}>Total Purchases</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: TOKENS.hlBlueDark }}>{peso(totalPurchases(c.customer_id))}</Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Typography sx={style.tableHint}>Double-click a row (or tap a card) to view the customer.</Typography>

        <Pagination page={safePage} totalPages={totalPages} onPrev={() => setCst((p) => ({ ...p, page: safePage - 1 }))} onNext={() => setCst((p) => ({ ...p, page: safePage + 1 }))}
          info={sorted.length ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + pageRows.length} of ${sorted.length} customer${sorted.length === 1 ? '' : 's'}` : '0 customers'} />
      </Box>

      <Modal open={modalOpen} title={editingId ? 'Edit Customer' : 'Add Customer'} onClose={() => setModalOpen(false)} onConfirm={save} confirmLabel={editingId ? 'Save changes' : 'Save customer'} confirmationTitle={editingId ? 'Confirm customer update' : 'Confirm new customer'} confirmationMessage={editingId ? 'Save these customer record changes?' : 'Add this customer to the customer records?'} confirmationLabel={editingId ? 'Save changes' : 'Add customer'} width="form">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, pt: 1 }}>
          <Field label="Customer Name">
            <TextField autoFocus fullWidth size="small" placeholder="e.g., Juan Dela Cruz or ABC Builders" value={draft.customer_name} onChange={(e) => setDraft((d) => ({ ...d, customer_name: e.target.value }))} />
          </Field>
          <Field label="Contact Number">
            <TextField
              fullWidth
              size="small"
              type="tel"
              placeholder="09XX XXX XXXX"
              inputProps={{ maxLength: 18, inputMode: 'tel' }}
              value={draft.contact_number}
              onChange={(e) => setDraft((d) => ({ ...d, contact_number: e.target.value }))}
              error={!!draft.contact_number && !isValidPhilippineContactNumber(draft.contact_number)}
              helperText={
                draft.contact_number && !isValidPhilippineContactNumber(draft.contact_number)
                  ? PH_CONTACT_NUMBER_ERROR
                  : undefined
              }
            />
          </Field>
          <Field label="Address">
            <TextField fullWidth size="small" multiline rows={3} placeholder="Street, Barangay, City" value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} />
          </Field>
        </Box>
      </Modal>

      <DetailModal open={!!detailCustomer} title={detailCustomer ? 'Customer — ' + detailCustomer.customer_name : ''} onClose={() => setDetailId(null)}>
        {detailCustomer && (
          <CustomerDetails
            customer={detailCustomer}
            totalPurchases={totalPurchases(detailCustomer.customer_id)}
            onOpenSale={setSaleDetailId}
          />
        )}
      </DetailModal>
      <DetailModal
        open={saleDetailId !== null}
        title={saleDetailId === null ? '' : `Sale ${fmtSaleId(saleDetailId)}`}
        onClose={() => setSaleDetailId(null)}
      >
        {saleDetailId !== null && <SaleDetails sale={data.sales.find((sale) => sale.sale_id === saleDetailId)} />}
      </DetailModal>
    </>
  );
}

function CustomerDetails({ customer, totalPurchases, onOpenSale }) {
  const { data } = useData();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const sales = data.sales
    .filter((s) => s.customer_id === customer.customer_id)
    .sort((a, b) => b.sale_date.localeCompare(a.sale_date) || b.sale_id - a.sale_id);

  return (
    <Box>
      <Typography sx={style.sectionTitle}>Customer information</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 2, mb: 2 }}>
        <Info label="Customer Name" value={customer.customer_name} />
        <Info label="Contact Number" value={customer.contact_number} />
        <Info label="Address" value={customer.address} />
        <Info label="Total Purchases" value={peso(totalPurchases)} />
      </Box>

      <Typography sx={style.sectionTitle}>Sales</Typography>
      {sales.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: TOKENS.gray5 }}>No sales yet.</Typography>
      ) : (
        isPhone ? (
          <Box sx={{
            display: 'grid',
            gap: 1,
            maxHeight: 'min(360px, calc(100dvh - 360px))',
            overflowY: 'auto',
            pr: 0.5
          }}>
            {sales.map((s) => {
              const delivery = data.customer_deliveries.find((item) => item.sale_id === s.sale_id);
              const deliveryStatus = customerDeliveryStatusForDisplay(s, data.customer_deliveries);
              return (
                <Card
                  key={s.sale_id}
                  variant="outlined"
                  tabIndex={0}
                  onClick={() => onOpenSale(s.sale_id)}
                  onDoubleClick={() => onOpenSale(s.sale_id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onOpenSale(s.sale_id);
                    }
                  }}
                  aria-label={`View sale ${fmtSaleId(s.sale_id)}`}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { borderColor: TOKENS.hlBlue },
                    '&:focus-visible': { outline: `2px solid ${TOKENS.hlBlue}`, outlineOffset: 1 }
                  }}
                >
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{fmtSaleId(s.sale_id)}</Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{peso(s.total_amount)}</Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      <Info label="Date" value={fmtDate(s.sale_date)} />
                      <Info label="Payment" value={<PaymentStatusBadges status={s.payment_status} dueStatus={saleDueStatus(s, data.payment_terms, data.customer_payments)} />} />
                      <Info label="Delivery" value={delivery
                        ? <OperationalStatus status={delivery.delivery_status} scheduledDate={scheduledDeliveryDateOf(delivery, delivery.delivery_status)} />
                        : <Chip label={deliveryStatus} color={COLOR_MAP[deliveryStatus] || 'default'} size="small" />} />
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        ) : (
          <Box sx={{
            border: `1px solid ${TOKENS.lineSoft}`,
            borderRadius: 1,
            maxHeight: 'min(420px, calc(100dvh - 360px))',
            overflow: 'auto'
          }}>
            <Table size="small" sx={{ minWidth: 460 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Sale ID</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Payment</TableCell>
                  <TableCell>Delivery</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sales.map((s) => {
                  const delivery = data.customer_deliveries.find((item) => item.sale_id === s.sale_id);
                  const deliveryStatus = customerDeliveryStatusForDisplay(s, data.customer_deliveries);
                  return (
                    <TableRow
                      key={s.sale_id}
                      hover
                      tabIndex={0}
                      onDoubleClick={() => onOpenSale(s.sale_id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          onOpenSale(s.sale_id);
                        }
                      }}
                      aria-label={`View sale ${fmtSaleId(s.sale_id)}`}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{fmtSaleId(s.sale_id)}</TableCell>
                      <TableCell>{fmtDate(s.sale_date)}</TableCell>
                      <TableCell align="right">{peso(s.total_amount)}</TableCell>
                      <TableCell><PaymentStatusBadges status={s.payment_status} dueStatus={saleDueStatus(s, data.payment_terms, data.customer_payments)} /></TableCell>
                      <TableCell>
                        {delivery
                          ? <OperationalStatus status={delivery.delivery_status} scheduledDate={scheduledDeliveryDateOf(delivery, delivery.delivery_status)} />
                          : <Chip label={deliveryStatus} color={COLOR_MAP[deliveryStatus] || 'default'} size="small" />}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )
      )}
      <Typography sx={{ fontSize: 11, color: TOKENS.gray5, mt: 1 }}>
        Double-click a sale row, or focus it and press Enter, to view it in full.
      </Typography>
    </Box>
  );
}

const Info = ({ label, value }) => (
  <Box><Typography sx={style.infoLabel}>{label}</Typography><Typography sx={style.infoValue}>{value}</Typography></Box>
);