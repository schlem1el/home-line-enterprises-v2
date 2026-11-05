import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, TextField, MenuItem, Button, Table, TableHead, TableBody,
  TableRow, TableCell, Typography, Chip, Card, CardContent, Divider
} from '@mui/material';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import Topbar from '../components/Topbar';
import Pagination from '../components/Pagination';
import DateField from '../components/DateField';
import DetailModal from '../components/DetailModal';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { TOKENS, filterChip } from '../styles/HomeLineStyles';
import { generatePdfReport } from '../utils/pdfReport';

const PAGE_SIZE = 25;

const ACTION_TYPES = [
  'CREATE', 'UPDATE', 'DELETE', 'CANCEL', 'RECEIVE',
  'DELIVER', 'PICK-UP', 'CHECK', 'PAYMENT', 'LOGIN', 'LOGOUT', 'CHANGE_PASSWORD',
];
const RECORD_TYPES = ['Sale', 'Purchase', 'Product', 'Customer', 'Supplier', 'Payment', 'Delivery', 'User', 'Session'];

const ACTION_COLORS = {
  CREATE: 'success', UPDATE: 'info', DELETE: 'error',
  CANCEL: 'warning', RECEIVE: 'success', CHECK: 'info',
  DELIVER: 'success', 'PICK-UP': 'success',
  PAYMENT: 'primary', LOGIN: 'default', LOGOUT: 'default',
  CHANGE_PASSWORD: 'default',
};

const AT_DEFAULT = {
  search: '', action: '', record: '', status: '', from: '', to: '',
  sortKey: 'timestamp', sortDir: 'desc', page: 1
};

function formatAuditDateTime(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  return {
    date: date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }),
    time: date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
  };
}

const FIELD_LABELS = {
  summary: 'Summary',
  sale_id: 'Sale ID', purchase_id: 'Purchase ID',
  customer_id: 'Customer ID', supplier_id: 'Supplier ID',
  product_id: 'Product ID', supplier_product_id: 'Supplier Product ID',
  category_id: 'Category ID', inventory_id: 'Inventory ID',
  delivery_id: 'Delivery ID', payment_id: 'Payment ID',
  sale_type: 'Sale Type',
  total_amount: 'Total Amount', amount_paid: 'Amount Paid',
  payment_status: 'Payment Status', sale_status: 'Sale Status',
  purchase_status: 'Purchase Status',
  new_status: 'New Status', new_sale_status: 'New Sale Status',
  new_purchase_status: 'New Purchase Status',
  new_payment_status: 'New Payment Status',
  new_sale_payment_status: 'New Sale Payment Status',
  new_purchase_payment_status: 'New Purchase Payment Status',
  payment_date: 'Payment Date',
  method: 'Payment Method', cheque_number: 'Cheque Number',
  initial_payment: 'Initial Payment',
  customer_name: 'Customer', supplier_name: 'Supplier',
  product_name: 'Product', product_code: 'Product Code',
  contact_person: 'Contact Person', contact_number: 'Contact Number',
  address: 'Address', email: 'Email',
  full_name: 'Full Name', role: 'Role', status: 'Status',
  category_name: 'Category Name',
  supplier_product_code: 'Supplier Code', supplier_price: 'Supplier Price',
  quantity: 'Quantity', unit_price: 'Unit Price', unit_cost: 'Unit Cost',
  subtotal: 'Subtotal', discount: 'Discount', total: 'Total',
  reason: 'Reason',
};

const CURRENCY_FIELDS = new Set([
  'total_amount', 'amount_paid', 'initial_payment',
  'unit_price', 'unit_cost', 'subtotal', 'discount', 'total', 'supplier_price',
]);

const DATE_FIELDS = new Set([
  'payment_date', 'due_date', 'delivery_date', 'scheduled_delivery_date',
  'actual_delivery_date', 'sale_date', 'purchase_date',
]);

function prettyValue(key, value) {
  if (value === null || value === undefined || value === '') return '—';
  if ((key === 'status' || key === 'new_status') && typeof value === 'string') {
    if (value.toLowerCase() === 'active') return 'Active';
    if (value.toLowerCase() === 'inactive') return 'Inactive';
  }
  if (CURRENCY_FIELDS.has(key) && typeof value === 'number') {
    return 'PHP ' + value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (DATE_FIELDS.has(key) && typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatRecordId(recordType, recordId) {
  const raw = String(recordId ?? '').trim();
  if (!raw) return '—';

  const m = /^([A-Za-z]+)-(\d+)$/.exec(raw);
  if (m) {
    return `${m[1].toUpperCase()}-${String(Number(m[2])).padStart(4, '0')}`;
  }

  if (/^\d+$/.test(raw)) {
    const pad = raw.padStart(4, '0');
    switch (recordType) {
      case 'Sale': return `SAL-${pad}`;
      case 'Purchase': return `PUR-${pad}`;
      case 'Payment': return `CPY-${pad}`;
      case 'Delivery': return `DEL-${pad}`;
      case 'Product': return `PRD-${pad}`;
      case 'Customer': return `CST-${pad}`;
      case 'Supplier': return `SUP-${pad}`;
      default: return raw;
    }
  }

  return raw;
}

function rowSummary(r) {
  return r.details?.summary
    || `${r.action_type || ''} ${r.record_type || ''} ${formatRecordId(r.record_type, r.record_id)}`.trim();
}

export default function AuditTrail() {
  const showToast = useToast();
  const { profile } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [at, setAt] = useState({ ...AT_DEFAULT });
  const [detail, setDetail] = useState(null);
  const [usersById, setUsersById] = useState({});

  const loadUsers = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const map = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        map[d.id] = {
          full_name: data.full_name || data.email || d.id,
          email: data.email || '',
        };
      });
      setUsersById(map);
    } catch (err) {
      console.warn('Could not load users for audit display:', err?.message);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'audit_trail'),
        orderBy('action_timestamp', 'desc'),
        limit(1000),
      );
      const snap = await getDocs(q);
      setRows(snap.docs.map((d) => ({ _id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Load audit failed:', err);
      showToast('Could not load audit trail. Check Firestore rules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadUsers();
  }, []);

  const userLabel = (uid) => {
    if (!uid) return '—';
    const u = usersById[uid];
    if (u?.full_name) return u.full_name;
    if (u?.email) return u.email;
    return uid;
  };

  const filtered = useMemo(() => {
    const q = at.search.trim().toLowerCase();
    return rows.filter((r) => {
      if (at.action && r.action_type !== at.action) return false;
      if (at.record && r.record_type !== at.record) return false;
      if (at.status && String(r.details?.new_status || r.details?.status || '').toLowerCase() !== at.status.toLowerCase()) return false;
      const iso = (r.action_timestamp || '').slice(0, 10);
      if (at.from && iso < at.from) return false;
      if (at.to && iso > at.to) return false;
      if (!q) return true;
      const hay = [
        r.user_id, userLabel(r.user_id), r.action_type, r.record_type,
        formatRecordId(r.record_type, r.record_id), String(r.audit_id),
        r.details?.status, r.details?.new_status,
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, at, usersById]);

  const sorted = useMemo(() => {
    const result = [...filtered];
    result.sort((a, b) => {
      let comparison = 0;
      if (at.sortKey === 'id') {
        comparison = (Number(a.audit_id) || 0) - (Number(b.audit_id) || 0);
      } else {
        comparison = (Date.parse(a.action_timestamp) || 0) - (Date.parse(b.action_timestamp) || 0);
      }

      if (!comparison) {
        comparison = (Number(a.audit_id) || 0) - (Number(b.audit_id) || 0);
      }
      return at.sortDir === 'asc' ? comparison : -comparison;
    });
    return result;
  }, [filtered, at.sortKey, at.sortDir]);

  const onSort = (key) => setAt((previous) => ({
    ...previous,
    sortKey: key,
    sortDir: previous.sortKey === key && previous.sortDir === 'asc' ? 'desc' : 'asc',
    page: 1
  }));

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, at.page), totalPages);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const clearFilters = () => setAt({ ...AT_DEFAULT });

  const exportPdfNow = async () => {
    if (!filtered.length) {
      showToast('No audit records to export');
      return;
    }

    const pdfRows = sorted.map((r) => ({
      audit_id: r.audit_id ? String(r.audit_id).padStart(4, '0') : '—',
      when: r.action_timestamp
        ? new Date(r.action_timestamp).toLocaleString('en-PH', {
          year: 'numeric', month: 'short', day: '2-digit',
          hour: 'numeric', minute: '2-digit',
        })
        : '—',
      who: userLabel(r.user_id),
      action: r.action_type || '—',
      record_type: r.record_type || '—',
      record_id: formatRecordId(r.record_type, r.record_id),
      summary: rowSummary(r),
    }));

    const rangeLabel = (() => {
      if (at.from && at.to) return `${at.from} to ${at.to}`;
      if (at.from) return `From ${at.from}`;
      if (at.to) return `Up to ${at.to}`;
      return 'All time';
    })();
    const actionLabel = at.action || 'All actions';
    const recordLabel = at.record || 'All records';

    await generatePdfReport({
      title: 'Audit Trail',
      subtitle: `${filtered.length} record${filtered.length === 1 ? '' : 's'}`,
      filters: [
        ['Date range', rangeLabel],
        ['Action', actionLabel],
        ['Record type', recordLabel],
        ...(at.search ? [['Search', at.search]] : []),
      ],
      columns: [
        { key: 'audit_id', label: 'Audit ID', align: 'left', weight: 0.6 },
        { key: 'when', label: 'Timestamp', align: 'left', weight: 1.5 },
        { key: 'who', label: 'User', align: 'left', weight: 1.3 },
        { key: 'action', label: 'Action', align: 'left', weight: 0.8 },
        { key: 'record_type', label: 'Record', align: 'left', weight: 0.8 },
        { key: 'record_id', label: 'Record ID', align: 'left', weight: 0.9 },
        { key: 'summary', label: 'Details', align: 'left', weight: 4.0 },
      ],
      rows: pdfRows,
      totals: [['Total records', String(filtered.length)]],
      filename: 'audit-trail',
      landscape: true,
      preparedBy: profile?.full_name || profile?.email || '',
    });
    showToast('Audit trail exported to PDF');
  };

  const refresh = async () => {
    await load();
    await loadUsers();
    showToast('Audit trail refreshed');
  };

  return (
    <>
      <Topbar title="Audit Trail" />
      <Box component="main" sx={{ p: { xs: '16px 14px 30px', sm: 'clamp(18px, 2.5vw, 30px) clamp(18px, 3vw, 40px) 40px' } }}>

        <Box sx={{ mb: 3 }}>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'minmax(220px, 2fr) repeat(3, minmax(130px, 1fr)) repeat(2, minmax(145px, 1fr))'
            },
            gap: { xs: 1.25, sm: 1.5, md: 2 },
            alignItems: 'stretch',
            '& > *': { minWidth: 0 }
          }}>
            <TextField
              size="small"
              placeholder="Search user, record ID, or audit ID"
              value={at.search}
              onChange={(e) => setAt((p) => ({ ...p, search: e.target.value, page: 1 }))}
              sx={{ gridColumn: { xs: 'auto', sm: '1 / -1', lg: 'auto' }, width: '100%' }}
              fullWidth
            />
            <TextField select size="small" label="Action Type" value={at.action}
              onChange={(e) => setAt((p) => ({ ...p, action: e.target.value, page: 1 }))}
              fullWidth>
              <MenuItem value="">All actions</MenuItem>
              {ACTION_TYPES.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Record Type" value={at.record}
              onChange={(e) => setAt((p) => ({ ...p, record: e.target.value, page: 1 }))}
              fullWidth>
              <MenuItem value="">All records</MenuItem>
              {RECORD_TYPES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="User Status" value={at.status}
              onChange={(e) => setAt((p) => ({ ...p, status: e.target.value, page: 1 }))}
              fullWidth>
              <MenuItem value="">All statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
            <DateField label="From" value={at.from}
              onChange={(e) => setAt((p) => ({ ...p, from: e.target.value, page: 1 }))}
              fullWidth sx={{ width: '100%' }} />
            <DateField label="To" value={at.to}
              onChange={(e) => setAt((p) => ({ ...p, to: e.target.value, page: 1 }))}
              fullWidth sx={{ width: '100%' }} />
          </Box>
          <Box sx={{
            display: { xs: 'grid', sm: 'grid', lg: 'flex' },
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(3, minmax(0, 1fr))'
            },
            justifyContent: { lg: 'flex-end' },
            flexWrap: 'wrap',
            gap: { xs: 1, sm: 1.5 },
            mt: { xs: 1.5, sm: 2 },
            '& > .MuiButton-root': {
              width: { xs: '100%', sm: '100%', lg: 'auto' },
              minWidth: 0,
              m: 0
            }
          }}>
            <Button sx={{ ...filterChip, height: 40, whiteSpace: 'nowrap' }} startIcon={<FilterAltOffIcon />} onClick={clearFilters}>
              Clear Filters
            </Button>
            <Button sx={{ ...filterChip, height: 40, whiteSpace: 'nowrap' }} startIcon={<RefreshIcon />} onClick={refresh}>
              Refresh
            </Button>
            <Button variant="contained" startIcon={<PictureAsPdfIcon />} onClick={exportPdfNow} sx={{ height: 40, whiteSpace: 'nowrap' }}>
              Export PDF
            </Button>
          </Box>
        </Box>

        <Box sx={{ display: { xs: 'none', sm: 'block' }, border: `1px solid ${TOKENS.lineSoft}`, borderRadius: `${TOKENS.radius}px`, overflow: 'auto', maxWidth: '100%' }}>
          <Table sx={{
            width: '100%',
            minWidth: 1060,
            tableLayout: 'fixed',
            '& th, & td': {
              px: 1.5,
              py: 1.25,
              fontFamily: TOKENS.fontBody,
              fontSize: 12,
              verticalAlign: 'middle',
            },
            '& .MuiTableCell-head': {
              fontFamily: TOKENS.fontBody,
              fontSize: 10.5,
              fontWeight: 700,
              color: TOKENS.hlBlueDark,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              whiteSpace: 'nowrap'
            },
            '& th:nth-of-type(1), & td:nth-of-type(1)': { width: 90 },
            '& th:nth-of-type(2), & td:nth-of-type(2)': { width: 150 },
            '& th:nth-of-type(3), & td:nth-of-type(3)': { width: 190 },
            '& th:nth-of-type(4), & td:nth-of-type(4)': { width: 130 },
            '& th:nth-of-type(5), & td:nth-of-type(5)': { width: 130 },
            '& th:nth-of-type(6), & td:nth-of-type(6)': { width: 130 },
            '& th:nth-of-type(7), & td:nth-of-type(7)': { width: 240 },
            '& .MuiChip-root': {
              maxWidth: '100%',
              whiteSpace: 'nowrap',
              fontFamily: TOKENS.fontBody
            },
          }}>
            <TableHead>
              <TableRow>
                <TableCell>Audit ID</TableCell>
                <TableCell
                  aria-sort={at.sortDir === 'asc' ? 'ascending' : 'descending'}
                  onClick={() => onSort('timestamp')}
                  sx={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Timestamp
                  <Box component="span" sx={{
                    fontSize: 9,
                    ml: '6px',
                    color: TOKENS.hlGoldDark
                  }}>
                    {at.sortDir === 'asc' ? '▲' : '▼'}
                  </Box>
                </TableCell>
                <TableCell>User</TableCell>
                <TableCell>Action Type</TableCell>
                <TableCell>Record Type</TableCell>
                <TableCell>Record ID</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: TOKENS.gray5 }}>Loading…</TableCell></TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: TOKENS.gray5 }}>No audit records match these filters.</TableCell></TableRow>
              ) : pageRows.map((r) => (
                <TableRow key={r._id} hover tabIndex={0}
                  onDoubleClick={() => setDetail(r)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setDetail(r); } }}
                  sx={{ cursor: 'pointer' }}>
                  <TableCell sx={{ fontFamily: TOKENS.fontBody, fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    #{String(r.audit_id ?? '—').padStart(4, '0')}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {(() => {
                      const dateTime = formatAuditDateTime(r.action_timestamp);
                      return dateTime ? (
                        <>
                          {dateTime.date}
                          <br />
                          <Box component="span" sx={{ fontSize: 10, color: TOKENS.gray5 }}>
                            {dateTime.time}
                          </Box>
                        </>
                      ) : '—';
                    })()}
                  </TableCell>
                  <TableCell sx={{ overflowWrap: 'anywhere' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <Box sx={{ fontWeight: 600 }}>{userLabel(r.user_id)}</Box>
                      {usersById[r.user_id]?.email && (
                        <Box sx={{ fontSize: 10.5, color: TOKENS.gray5, overflowWrap: 'anywhere' }}>
                          {usersById[r.user_id].email}
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={r.action_type || '—'} color={ACTION_COLORS[r.action_type] || 'default'} size="small" />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.record_type || '—'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {formatRecordId(r.record_type, r.record_id)}
                  </TableCell>
                  <TableCell sx={{ overflowWrap: 'anywhere' }}>
                    {rowSummary(r)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 2 }}>
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4, color: TOKENS.gray5 }}>Loading…</Box>
          ) : pageRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: TOKENS.gray5 }}>No audit records match these filters.</Box>
          ) : pageRows.map((r) => (
            <Card
              key={r._id}
              variant="outlined"
              onClick={() => setDetail(r)}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetail(r);
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
                    <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: TOKENS.hlBlueDark }}>
                      #{String(r.audit_id ?? '—').padStart(4, '0')}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: TOKENS.gray5, mt: 0.5 }}>
                      {r.action_timestamp
                        ? new Date(r.action_timestamp).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
                        : '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Chip label={r.action_type || '—'} color={ACTION_COLORS[r.action_type] || 'default'} size="small" />
                  </Box>
                </Box>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.gray5, letterSpacing: 0.5 }}>User / Record</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{userLabel(r.user_id)}</Typography>
                    <Typography sx={{ fontSize: 11, color: TOKENS.gray5, mt: 0.5 }}>
                      {r.record_type} · {formatRecordId(r.record_type, r.record_id)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', maxWidth: '50%' }}>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.gray5, letterSpacing: 0.5 }}>Details</Typography>
                    <Typography sx={{ fontSize: 11, color: TOKENS.ink, mt: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {rowSummary(r)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPrev={() => setAt((p) => ({ ...p, page: safePage - 1 }))}
          onNext={() => setAt((p) => ({ ...p, page: safePage + 1 }))}
          info={filtered.length
            ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + pageRows.length} of ${filtered.length} record${filtered.length === 1 ? '' : 's'}`
            : '0 records'}
        />
      </Box>

      <DetailModal
        open={!!detail}
        title={detail ? `Audit Entry #${String(detail.audit_id ?? '').padStart(4, '0')}` : ''}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <Box>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 2,
              mb: 2,
            }}>
              <Info label="Audit ID" value={`#${String(detail.audit_id ?? '').padStart(4, '0')}`} />
              <Info
                label="When"
                value={detail.action_timestamp
                  ? new Date(detail.action_timestamp).toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'medium' })
                  : '—'}
              />
              <Info label="Who" value={userLabel(detail.user_id)} />
              <Info label="Email" value={usersById[detail.user_id]?.email || '—'} />
              <Info
                label="Action"
                value={<Chip label={detail.action_type || '—'} color={ACTION_COLORS[detail.action_type] || 'default'} size="small" />}
              />
              <Info label="Record Type" value={detail.record_type || '—'} />
              <Info label="Record ID" value={formatRecordId(detail.record_type, detail.record_id)} />
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {detail.details?.summary && (
              <Box sx={{
                background: TOKENS.hlBlueTint,
                border: `1px solid ${TOKENS.lineSoft}`,
                borderLeft: `3px solid ${TOKENS.hlBlue}`,
                borderRadius: 1,
                p: 1.75,
                mb: 2,
                fontSize: 13.5,
                lineHeight: 1.5,
                color: TOKENS.hlBlueDark,
                fontWeight: 500,
              }}>
                {detail.details.summary}
              </Box>
            )}

            {detail.details && Object.keys(detail.details).filter((k) => k !== 'summary').length > 0 && (
              <>
                <Typography sx={{
                  fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
                  color: TOKENS.hlBlueDark, letterSpacing: 0.4, mb: 1,
                }}>
                  What changed
                </Typography>
                <Box sx={{ border: `1px solid ${TOKENS.lineSoft}`, borderRadius: 1, overflow: 'hidden' }}>
                  <Table size="small">
                    <TableBody>
                      {Object.entries(detail.details)
                        .filter(([k]) => k !== 'summary')
                        .map(([k, v]) => (
                          <TableRow key={k}>
                            <TableCell sx={{
                              width: 220,
                              background: TOKENS.gray1,
                              fontWeight: 700,
                              fontSize: 11,
                              textTransform: 'uppercase',
                              letterSpacing: 0.4,
                              color: TOKENS.hlBlueDark,
                              borderBottom: `1px solid ${TOKENS.lineSoft}`,
                              verticalAlign: 'top',
                            }}>
                              {FIELD_LABELS[k] || k}
                            </TableCell>
                            <TableCell sx={{
                              fontSize: 13,
                              borderBottom: `1px solid ${TOKENS.lineSoft}`,
                              wordBreak: 'break-word',
                              fontVariantNumeric: 'tabular-nums',
                            }}>
                              {prettyValue(k, v)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </Box>
              </>
            )}
          </Box>
        )}
      </DetailModal>
    </>
  );
}

const Info = ({ label, value }) => (
  <Box>
    <Typography sx={{
      fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
      color: TOKENS.hlBlueDark, letterSpacing: 0.4, mb: 0.25,
    }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: 13 }}>{value}</Typography>
  </Box>
);