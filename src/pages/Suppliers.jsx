import React, { useMemo, useState } from 'react';
import {
  Box, TextField, Button, Table, TableHead, TableBody,
  TableRow, TableCell, Typography, Card, CardContent, Divider, MenuItem
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import Topbar from '../components/Topbar';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';
import DetailModal from '../components/DetailModal';
import Field from '../components/Field';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAudit } from '../utils/useAudit';
import style from '../styles/SuppliersStyles';
import { TOKENS, filterChip, actionChip } from '../styles/HomeLineStyles';
import { PAGE_SIZE } from '../utils/businessRules';
import { peso, round2 } from '../utils/format';
import {
  hasAtMostTwoDecimalPlaces, isValidPhilippineContactNumber, PH_CONTACT_NUMBER_ERROR
} from '../utils/validation';
import { stopRowActivationPropagation } from '../utils/keyboard';

const SPL_DEFAULT = { search: '', sortKey: 'name', sortDir: 'asc', page: 1 };

const SPL_COLUMNS = [
  { key: 'name', label: 'Company Name' },
  { key: 'person', label: 'Contact Person' },
  { key: 'contact', label: 'Contact Number' },
  { key: 'address', label: 'Address' }
];

export default function Suppliers() {
  const {
    data, add, update, refresh,
    supplierById, productById, supplierProduct
  } = useData();
  const showToast = useToast();
  const log = useAudit();

  const [spl, setSpl] = useState({ ...SPL_DEFAULT });
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState({ supplier_name: '', contact_person: '', contact_number: '', address: '' });
  const [detailId, setDetailId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [sppOpen, setSppOpen] = useState(false);
  const [sppDraft, setSppDraft] = useState(null);
  const [sppEditingId, setSppEditingId] = useState(null);

  const supplierLinksOf = (supplierId) =>
    data.supplier_products
      .filter((sp) => sp.supplier_id === supplierId)
      .sort((a, b) => {
        const pa = productById(a.product_id), pb = productById(b.product_id);
        return (pa ? pa.product_name : '').localeCompare(pb ? pb.product_name : '')
          || a.supplier_product_id - b.supplier_product_id;
      });

  const filtered = useMemo(() => {
    const q = spl.search.trim().toLowerCase();
    if (!q) return [...data.suppliers];
    return data.suppliers.filter((s) =>
      (s.supplier_name + ' ' + s.contact_person + ' ' + s.contact_number + ' ' + s.address).toLowerCase().includes(q));
  }, [data.suppliers, spl.search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let r = 0;
      switch (spl.sortKey) {
        case 'name': r = a.supplier_name.localeCompare(b.supplier_name); break;
        case 'person': r = a.contact_person.localeCompare(b.contact_person); break;
        case 'contact': r = a.contact_number.localeCompare(b.contact_number); break;
        case 'address': r = a.address.localeCompare(b.address); break;
      }
      if (r === 0) r = a.supplier_id - b.supplier_id;
      return spl.sortDir === 'asc' ? r : -r;
    });
    return arr;
  }, [filtered, spl.sortKey, spl.sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, spl.page), totalPages);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const onSort = (key) => setSpl((p) => ({
    ...p, sortKey: key,
    sortDir: p.sortKey === key && p.sortDir === 'asc' ? 'desc' : 'asc',
    page: 1
  }));
  const clearSearch = () => setSpl((p) => ({ ...p, search: '', page: 1 }));

  const openAdd = () => {
    setAddDraft({ supplier_name: '', contact_person: '', contact_number: '', address: '' });
    setAddOpen(true);
  };

  const validateSupplierFields = (d) => {
    const name = d.supplier_name.trim().replace(/\s+/g, ' ');
    const person = d.contact_person.trim().replace(/\s+/g, ' ');
    const contact = d.contact_number.trim();
    const address = d.address.trim();
    if (!name) { showToast('Enter a supplier name'); return null; }
    if (!person) { showToast('Enter a contact person'); return null; }
    if (!contact) { showToast('Enter a contact number'); return null; }
    if (!isValidPhilippineContactNumber(contact)) {
      showToast(PH_CONTACT_NUMBER_ERROR);
      return null;
    }
    if (!address) { showToast('Enter an address'); return null; }
    return { supplier_name: name, contact_person: person, contact_number: contact, address };
  };

  const saveAdd = async () => {
    const f = validateSupplierFields(addDraft);
    if (!f) return;
    const id = data.suppliers.reduce((m, s) => Math.max(m, s.supplier_id), 0) + 1;
    await add('suppliers', { supplier_id: id, ...f }, 'supplier_id');
    await refresh();
    await log('CREATE', 'Supplier', `SUP-${String(id).padStart(4, '0')}`, {
      summary: `Added supplier "${f.supplier_name}"`,
      supplier_id: id,
      supplier_name: f.supplier_name,
      contact_person: f.contact_person,
      contact_number: f.contact_number,
    });
    showToast('Supplier added ✓');
    setAddOpen(false);
  };

  const openEdit = (id) => {
    const s = supplierById(id);
    if (!s) return;
    setEditId(s.supplier_id);
    setEditDraft({
      supplier_name: s.supplier_name,
      contact_person: s.contact_person,
      contact_number: s.contact_number,
      address: s.address
    });
    setEditOpen(true);
  };

  const [editDraftBackup, setEditDraftBackup] = useState(null);

  const saveEdit = async () => {
    const f = validateSupplierFields(editDraft);
    if (!f) return;
    const s = supplierById(editId);
    await update('suppliers', s._docId, f);
    await refresh();
    await log('UPDATE', 'Supplier', `SUP-${String(editId).padStart(4, '0')}`, {
      summary: `Updated supplier "${f.supplier_name}"`,
      supplier_id: editId,
      supplier_name: f.supplier_name,
      contact_person: f.contact_person,
      contact_number: f.contact_number,
    });
    showToast('Supplier updated ✓');
    setEditOpen(false);
    setEditDraft(null);
    setEditId(null);
  };

  const openAddSpp = (supplierId) => {
    setEditDraftBackup(editDraft);
    setSppEditingId(null);
    setSppDraft({
      supplier_id: supplierId,
      product_id: '',
      supplier_product_code: '',
      supplier_price: ''
    });
    setSppOpen(true);
  };

  const openEditSpp = (sppId) => {
    const sp = data.supplier_products.find((x) => x.supplier_product_id === sppId);
    if (!sp) return;
    setEditDraftBackup(editDraft);
    setSppEditingId(sp.supplier_product_id);
    setSppDraft({
      supplier_id: sp.supplier_id,
      product_id: sp.product_id,
      supplier_product_code: sp.supplier_product_code,
      supplier_price: sp.supplier_price.toFixed(2)
    });
    setSppOpen(true);
  };

  const closeSppToEdit = () => {
    setSppOpen(false);
    setSppDraft(null);
    setSppEditingId(null);
    if (editDraftBackup) {
      setEditDraft(editDraftBackup);
      setEditDraftBackup(null);
    }
    setEditOpen(true);
  };

  const saveSpp = async () => {
    const code = sppDraft.supplier_product_code.trim().replace(/\s+/g, ' ');
    const priceRaw = String(sppDraft.supplier_price).trim();
    const price = Number(priceRaw);

    if (!sppEditingId) {
      const pid = Number(sppDraft.product_id);
      if (!productById(pid)) { showToast('Select a product'); return; }
      if (supplierProduct(sppDraft.supplier_id, pid)) { showToast('This supplier already lists that product'); return; }
    }
    if (!code) { showToast('Enter the supplier product code'); return; }
    if (!priceRaw || !isFinite(price) || price <= 0) { showToast('Enter a supplier price greater than zero'); return; }
    if (!hasAtMostTwoDecimalPlaces(price)) { showToast('Supplier price can have at most 2 decimal places'); return; }

    if (sppEditingId) {
      const sp = data.supplier_products.find((x) => x.supplier_product_id === sppEditingId);
      await update('supplier_products', sp._docId, {
        supplier_product_code: code,
        supplier_price: round2(price)
      });
      await refresh();
      await log('UPDATE', 'Supplier', `SPP-${String(sppEditingId).padStart(4, '0')}`, {
        summary: `Updated supplier product link for ${supplierById(sppDraft.supplier_id)?.supplier_name || ''}`,
        supplier_product_id: sppEditingId,
        supplier_id: sppDraft.supplier_id,
        product_id: sppDraft.product_id,
        supplier_product_code: code,
        supplier_price: round2(price),
      });
      showToast('Supplier product updated ✓');
    } else {
      const id = data.supplier_products.reduce((m, x) => Math.max(m, x.supplier_product_id), 0) + 1;
      await add('supplier_products', {
        supplier_product_id: id,
        supplier_id: sppDraft.supplier_id,
        product_id: Number(sppDraft.product_id),
        supplier_product_code: code,
        supplier_price: round2(price)
      }, 'supplier_product_id');
      await refresh();
      await log('CREATE', 'Supplier', `SPP-${String(id).padStart(4, '0')}`, {
        summary: `Linked product to supplier "${supplierById(sppDraft.supplier_id)?.supplier_name || ''}"`,
        supplier_product_id: id,
        supplier_id: sppDraft.supplier_id,
        product_id: sppDraft.product_id,
        supplier_product_code: code,
        supplier_price: round2(price),
      });
      showToast('Supplier product added ✓');
    }
    closeSppToEdit();
  };

  const detailSupplier = detailId ? supplierById(detailId) : null;

  return (
    <>
      <Topbar title="Suppliers" />

      <Box sx={style.content}>
        {/* FIXED TOP LOOK: Using Grid */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'minmax(200px, 1fr) auto auto' },
          gap: 2,
          mb: 3,
          alignItems: 'center'
        }}>
          <TextField size="small" placeholder="Search name, contact person or address"
            value={spl.search}
            onChange={(e) => setSpl((p) => ({ ...p, search: e.target.value, page: 1 }))}
            fullWidth />
          <Button sx={{ ...filterChip, height: 40 }} startIcon={<SearchOffIcon />} onClick={clearSearch}>
            Clear Search
          </Button>
          <Button variant="contained" sx={{ height: 40 }} onClick={openAdd}>+ Add Supplier</Button>
        </Box>

        {/* DESKTOP TABLE */}
        <Box sx={{ display: { xs: 'none', sm: 'block' }, ...style.tableWrap }}>
          <Table sx={style.historyTable}>
            <TableHead>
              <TableRow>
                {SPL_COLUMNS.map((c) => {
                  const active = spl.sortKey === c.key;
                  const arrow = active ? (spl.sortDir === 'asc' ? '▲' : '▼') : '↕';
                  return (
                    <TableCell key={c.key} align={c.num ? 'right' : 'left'}
                      aria-sort={active ? (spl.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
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
                    {data.suppliers.length ? 'No suppliers match this search.' : 'No suppliers yet. Select + Add Supplier.'}
                  </TableCell>
                </TableRow>
              ) : pageRows.map((s) => (
                <TableRow key={s.supplier_id} hover tabIndex={0}
                  onDoubleClick={() => setDetailId(s.supplier_id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setDetailId(s.supplier_id); } }}
                  sx={{ cursor: 'pointer' }}>
                  <TableCell>{s.supplier_name}</TableCell>
                  <TableCell>{s.contact_person}</TableCell>
                  <TableCell>{s.contact_number}</TableCell>
                  <TableCell>{s.address}</TableCell>
                  <TableCell sx={style.actionsCell}>
                    <Button size="small" sx={actionChip} startIcon={<EditOutlinedIcon />}
                      onClick={(e) => { e.stopPropagation(); openEdit(s.supplier_id); }}
                      onKeyDown={stopRowActivationPropagation}
                      aria-label={`Edit supplier ${s.supplier_name}`}>
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
            <Box sx={{ textAlign: 'center', py: 4, color: TOKENS.gray5 }}>No suppliers match this search.</Box>
          ) : pageRows.map((s) => (
            <Card
              key={s.supplier_id}
              variant="outlined"
              onClick={() => setDetailId(s.supplier_id)}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetailId(s.supplier_id);
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
                    <Typography sx={{ fontWeight: 700, fontSize: 14, color: TOKENS.hlBlueDark }}>{s.supplier_name}</Typography>
                    <Typography sx={{ fontSize: 12, color: TOKENS.gray5, mt: 0.5 }}>{s.contact_person}</Typography>
                  </Box>
                </Box>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.gray5, letterSpacing: 0.5 }}>Contact / Address</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{s.contact_number}</Typography>
                    <Typography sx={{ fontSize: 11, color: TOKENS.gray5 }}>{s.address}</Typography>
                  </Box>
                  <Button size="small" sx={actionChip} startIcon={<EditOutlinedIcon />}
                    onClick={(e) => { e.stopPropagation(); openEdit(s.supplier_id); }}
                    onKeyDown={stopRowActivationPropagation}
                    aria-label={`Edit supplier ${s.supplier_name}`}>
                    Edit
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Typography sx={style.tableHint}>Double-click a row (or tap a card) to view the supplier.</Typography>

        <Pagination page={safePage} totalPages={totalPages} onPrev={() => setSpl((p) => ({ ...p, page: safePage - 1 }))} onNext={() => setSpl((p) => ({ ...p, page: safePage + 1 }))}
          info={sorted.length ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + pageRows.length} of ${sorted.length} supplier${sorted.length === 1 ? '' : 's'}` : '0 suppliers'} />
      </Box>

      <Modal open={addOpen} title="Add Supplier" onClose={() => setAddOpen(false)} onConfirm={saveAdd} confirmLabel="Save supplier" confirmationTitle="Confirm new supplier" confirmationMessage="Add this supplier to the supplier records?" confirmationLabel="Add supplier" width="default">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, pt: 1 }}>
          <Field label="Supplier Name">
            <TextField autoFocus fullWidth size="small" placeholder="e.g., ABC Trading" value={addDraft.supplier_name} onChange={(e) => setAddDraft((d) => ({ ...d, supplier_name: e.target.value }))} />
          </Field>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
            <Field label="Contact Person">
              <TextField fullWidth size="small" placeholder="e.g., Maria Santos" value={addDraft.contact_person} onChange={(e) => setAddDraft((d) => ({ ...d, contact_person: e.target.value }))} />
            </Field>
            <Field label="Contact Number">
              <TextField
                fullWidth
                size="small"
                type="tel"
                placeholder="09XX XXX XXXX"
                inputProps={{ maxLength: 18, inputMode: 'tel' }}
                value={addDraft.contact_number}
                onChange={(e) => setAddDraft((d) => ({ ...d, contact_number: e.target.value }))}
                error={!!addDraft.contact_number && !isValidPhilippineContactNumber(addDraft.contact_number)}
                helperText={
                  addDraft.contact_number && !isValidPhilippineContactNumber(addDraft.contact_number)
                    ? PH_CONTACT_NUMBER_ERROR
                    : undefined
                }
              />
            </Field>
          </Box>
          <Field label="Address">
            <TextField fullWidth size="small" multiline rows={2} placeholder="Street, Barangay, City" value={addDraft.address} onChange={(e) => setAddDraft((d) => ({ ...d, address: e.target.value }))} />
          </Field>
        </Box>
      </Modal>

      <DetailModal open={!!detailSupplier} title={detailSupplier ? 'Supplier — ' + detailSupplier.supplier_name : ''} onClose={() => setDetailId(null)}>
        {detailSupplier && <SupplierDetailsView supplier={detailSupplier} links={supplierLinksOf(detailSupplier.supplier_id)} productById={productById} />}
      </DetailModal>

      {editOpen && editDraft && (
        <Modal open title={'Edit Supplier — ' + editDraft.supplier_name} onClose={() => { setEditOpen(false); setEditDraft(null); setEditId(null); }} onConfirm={saveEdit} confirmLabel="Save Changes" confirmationTitle="Confirm supplier update" confirmationMessage="Save these supplier record changes?" confirmationLabel="Save changes" width="wide">
          <Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, mb: 1 }}>
              <Field label="Supplier Name">
                <TextField fullWidth size="small" placeholder="e.g., ABC Trading" value={editDraft.supplier_name} onChange={(e) => setEditDraft((d) => ({ ...d, supplier_name: e.target.value }))} />
              </Field>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
                <Field label="Contact Person">
                  <TextField fullWidth size="small" placeholder="e.g., Maria Santos" value={editDraft.contact_person} onChange={(e) => setEditDraft((d) => ({ ...d, contact_person: e.target.value }))} />
                </Field>
                <Field label="Contact Number">
                  <TextField
                    fullWidth
                    size="small"
                    type="tel"
                    placeholder="09XX XXX XXXX"
                    inputProps={{ maxLength: 18, inputMode: 'tel' }}
                    value={editDraft.contact_number}
                    onChange={(e) => setEditDraft((d) => ({ ...d, contact_number: e.target.value }))}
                    error={!!editDraft.contact_number && !isValidPhilippineContactNumber(editDraft.contact_number)}
                    helperText={
                      editDraft.contact_number && !isValidPhilippineContactNumber(editDraft.contact_number)
                        ? PH_CONTACT_NUMBER_ERROR
                        : undefined
                    }
                  />
                </Field>
              </Box>
              <Field label="Address">
                <TextField fullWidth size="small" multiline rows={2} placeholder="Street, Barangay, City" value={editDraft.address} onChange={(e) => setEditDraft((d) => ({ ...d, address: e.target.value }))} />
              </Field>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 1.5, mt: 2, mb: 1.5, borderLeft: `3px solid ${TOKENS.hlGold}`, pl: 1 }}>
              <Typography sx={{ fontFamily: TOKENS.fontDisplay, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: TOKENS.hlBlueDark }}>
                Supplier products
              </Typography>
              <Button size="small" variant="outlined" onClick={() => openAddSpp(editId)}>
                + Add Product
              </Button>
            </Box>

            <Box sx={{ border: `1px solid ${TOKENS.lineSoft}`, borderRadius: 1, overflow: 'auto' }}>
              <Table size="small" sx={style.supplierLinksTable}>
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell>Supplier Code</TableCell>
                    <TableCell align="right">Supplier Price</TableCell>
                    <TableCell sx={{ width: 70 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {supplierLinksOf(editId).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ textAlign: 'center', color: TOKENS.gray5, py: '20px' }}>
                        No products listed for this supplier yet.
                      </TableCell>
                    </TableRow>
                  ) : supplierLinksOf(editId).map((sp) => (
                    <TableRow key={sp.supplier_product_id}>
                      <TableCell>{productById(sp.product_id)?.product_name || '—'}</TableCell>
                      <TableCell>{sp.supplier_product_code}</TableCell>
                      <TableCell align="right">{peso(sp.supplier_price)}</TableCell>
                      <TableCell>
                        <Button size="small" sx={actionChip} startIcon={<EditOutlinedIcon />}
                          onClick={() => openEditSpp(sp.supplier_product_id)}
                          onKeyDown={stopRowActivationPropagation}
                          aria-label="Edit supplier product">
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        </Modal>
      )}

      {sppOpen && sppDraft && (
        <Modal open title={(sppEditingId ? 'Edit Product — ' : 'Add Product — ') + (supplierById(sppDraft.supplier_id)?.supplier_name || '')} onClose={closeSppToEdit} onConfirm={saveSpp} confirmLabel={sppEditingId ? 'Save changes' : 'Save product'} confirmationTitle={sppEditingId ? 'Confirm supplier product update' : 'Confirm supplier product'} confirmationMessage={sppEditingId ? 'Save these supplier product changes?' : 'Add this product to the supplier’s catalog?'} confirmationLabel={sppEditingId ? 'Save changes' : 'Add product'} width="default">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, pt: 1 }}>
            <Field label="Product">
              {sppEditingId ? (
                <TextField fullWidth size="small" value={(() => { const p = productById(sppDraft.product_id); return p ? `${p.product_name} (${p.unit})` : ''; })()} InputProps={{ readOnly: true }} />
              ) : (
                <TextField select fullWidth size="small" value={sppDraft.product_id} onChange={(e) => setSppDraft((d) => ({ ...d, product_id: e.target.value }))}>
                  <MenuItem value="">Select product…</MenuItem>
                  {data.products.filter((p) => p.status === 'Active' && !supplierProduct(sppDraft.supplier_id, p.product_id)).sort((a, b) => a.product_name.localeCompare(b.product_name)).map((p) => (
                    <MenuItem key={p.product_id} value={p.product_id}>{p.product_name} ({p.unit})</MenuItem>
                  ))}
                </TextField>
              )}
            </Field>
            <Field label="Supplier Product Code">
              <TextField fullWidth size="small" value={sppDraft.supplier_product_code} onChange={(e) => setSppDraft((d) => ({ ...d, supplier_product_code: e.target.value }))} />
            </Field>
            <Field label="Supplier Price">
              <TextField fullWidth size="small" type="number" inputProps={{ min: 0, step: 0.01 }} value={sppDraft.supplier_price} onChange={(e) => setSppDraft((d) => ({ ...d, supplier_price: e.target.value }))} />
            </Field>
          </Box>
        </Modal>
      )}
    </>
  );
}

function SupplierDetailsView({ supplier, links, productById }) {
  return (
    <Box>
      <Typography sx={style.sectionTitle}>Supplier information</Typography>
      <Box sx={style.supplierInfoReadOnly}>
        <Box sx={style.wide}>
          <Typography sx={style.infoLabel}>Supplier Name</Typography>
          <Typography sx={{ ...style.infoValue, ...style.supplierName }}>{supplier.supplier_name}</Typography>
        </Box>
        <Box>
          <Typography sx={style.infoLabel}>Contact Person</Typography>
          <Typography sx={style.infoValue}>{supplier.contact_person}</Typography>
        </Box>
        <Box>
          <Typography sx={style.infoLabel}>Contact Number</Typography>
          <Typography sx={style.infoValue}>{supplier.contact_number}</Typography>
        </Box>
        <Box sx={style.wide}>
          <Typography sx={style.infoLabel}>Address</Typography>
          <Typography sx={style.infoValue}>{supplier.address}</Typography>
        </Box>
      </Box>

      <Typography sx={style.sectionTitle}>Supplier products</Typography>
      <Box sx={{ border: `1px solid ${TOKENS.lineSoft}`, borderRadius: 1, overflow: 'auto' }}>
        <Table size="small" sx={style.supplierLinksTable}>
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell>Supplier Code</TableCell>
              <TableCell align="right">Supplier Price</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {links.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} sx={{ textAlign: 'center', color: TOKENS.gray5, py: '28px' }}>
                  No products listed for this supplier.
                </TableCell>
              </TableRow>
            ) : links.map((sp) => (
              <TableRow key={sp.supplier_product_id}>
                <TableCell>{productById(sp.product_id)?.product_name || '—'}</TableCell>
                <TableCell>{sp.supplier_product_code}</TableCell>
                <TableCell align="right">{peso(sp.supplier_price)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}