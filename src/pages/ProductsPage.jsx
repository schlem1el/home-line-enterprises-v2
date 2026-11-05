import React, { useMemo, useState } from 'react';
import {
  Box, TextField, MenuItem, Button, Table, TableHead, TableBody,
  TableRow, TableCell, Typography, Chip, Card, CardContent, Divider
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import Topbar from '../components/Topbar';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';
import DetailModal from '../components/DetailModal';
import Field from '../components/Field';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useAudit } from '../utils/useAudit';
import style from '../styles/ProductsStyles';
import { TOKENS, filterChip, actionChip } from '../styles/HomeLineStyles';
import { PAGE_SIZE, PRODUCT_STATUSES, stockStatusOf } from '../utils/businessRules';
import { peso, fmtQty, isoDate, round2 } from '../utils/format';
import { hasAtMostTwoDecimalPlaces } from '../utils/validation';
import { stopRowActivationPropagation } from '../utils/keyboard';

const PR_DEFAULT = { search: '', category: '', page: 1 };
const PRODUCT_NAME_MAX_LENGTH = 100;
const PRODUCT_DESCRIPTION_MAX_LENGTH = 500;
const PRODUCT_UNIT_MAX_LENGTH = 20;
const CATEGORY_CODE_PATTERN = /^[A-Z]{3}$/;

const categoryCodeOf = (category) => {
  const savedCode = category?.category_code?.trim().toUpperCase();
  if (CATEGORY_CODE_PATTERN.test(savedCode || '')) return savedCode;
  const letters = (category?.category_name || '').replace(/[^a-z]/gi, '').toUpperCase();
  return letters.slice(0, 3).padEnd(3, 'X');
};

export default function ProductsPage() {
  const { data, add, update, remove, refresh, productById, categoryById, inventoryByProduct } = useData();
  const { isAdmin } = useAuth();
  const showToast = useToast();
  const log = useAudit();

  const [pr, setPr] = useState({ ...PR_DEFAULT });
  const [modalMode, setModalMode] = useState(null);
  const [productDraft, setProductDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [categoryToRemove, setCategoryToRemove] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const filterCategories = useMemo(() => {
    const listedIds = new Set(data.categories.map((category) => Number(category.category_id)));
    const unlistedById = new Map();
    data.products.forEach((product) => {
      const id = Number(product.category_id);
      if (!Number.isFinite(id) || listedIds.has(id)) return;
      const name = product.category_name?.trim() || `Unlisted category ${id}`;
      if (!unlistedById.has(id) || unlistedById.get(id).category_name.startsWith('Unlisted category ')) {
        unlistedById.set(id, { category_id: id, category_name: name, unlisted: true });
      }
    });
    return [
      ...data.categories,
      ...[...unlistedById.values()].sort((a, b) => a.category_name.localeCompare(b.category_name))
    ];
  }, [data.categories, data.products]);

  const filtered = useMemo(() => {
    const q = pr.search.trim().toLowerCase();
    return data.products
      .filter((p) => (!pr.category || Number(p.category_id) === Number(pr.category)) &&
        (!q || (p.product_name + ' ' + p.product_code).toLowerCase().includes(q)))
      .sort((a, b) => a.product_code.localeCompare(b.product_code));
  }, [data.products, pr.search, pr.category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, pr.page), totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const nextProductCode = (categoryId, excludedProductId = null) => {
    const category = categoryById(categoryId);
    if (!category) return '';
    const prefix = `${categoryCodeOf(category)}-`;
    const n = data.products.reduce((max, product) => {
      if (product.product_id === excludedProductId || !product.product_code?.toUpperCase().startsWith(prefix)) return max;
      const match = new RegExp(`^${prefix}(\\d+)$`, 'i').exec(product.product_code);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;
    return prefix + String(n).padStart(4, '0');
  };

  const openAddProduct = () => {
    setEditingId(null);
    setProductDraft({
      product_code: '',
      product_name: '',
      category_id: '',
      category_name: '',
      description: '',
      unit: '',
      selling_price: '',
      reorder_level: '0',
      status: 'Active'
    });
    setModalMode('product');
  };

  const openEditProduct = (id) => {
    const p = productById(id);
    if (!p) return;
    const inventory = inventoryByProduct(p.product_id);
    setEditingId(p.product_id);
    setProductDraft({
      product_code: p.product_code,
      product_name: p.product_name,
      category_id: p.category_id,
      category_name: p.category_name || categoryById(p.category_id)?.category_name || '',
      description: p.description || '',
      unit: p.unit,
      selling_price: p.selling_price.toFixed(2),
      reorder_level: String(inventory?.reorder_level ?? 0),
      status: p.status
    });
    setModalMode('product');
  };

  const closeProductModal = () => {
    setModalMode(null);
    setProductDraft(null);
    setEditingId(null);
  };

  const openCategories = () => {
    setCategoryName('');
    setCategoryCode('');
    setModalMode('categories');
  };

  const saveCategory = async () => {
    const name = categoryName.trim().replace(/\s+/g, ' ');
    if (!name) { showToast('Enter a category name'); return; }
    const code = categoryCode.trim().toUpperCase();
    if (!CATEGORY_CODE_PATTERN.test(code)) { showToast('Category code must be exactly 3 letters'); return; }
    if (data.categories.some((c) => c.category_name.toLowerCase() === name.toLowerCase())) {
      showToast('That category already exists'); return;
    }
    if (data.categories.some((category) => categoryCodeOf(category) === code)) {
      showToast('That category code is already in use'); return;
    }
    const lastUsedId = [...data.categories, ...data.products].reduce(
      (max, record) => Math.max(max, Number(record.category_id) || 0),
      0
    );
    const id = lastUsedId + 1;
    try {
      await add('categories', { category_id: id, category_name: name, category_code: code }, 'category_id');
      await refresh();
      await log('CREATE', 'Product', `CAT-${String(id).padStart(4, '0')}`, {
        summary: `Added category "${name}"`,
        category_id: id,
        category_name: name,
        category_code: code,
      });
      setCategoryName('');
      setCategoryCode('');
      showToast('Category added ✓');
    } catch (error) {
      console.error('Failed to add category:', error);
      showToast('Could not add category. Please try again.');
    }
  };

  const deleteCategory = async () => {
    if (!categoryToRemove) return;
    try {
      const categorizedProducts = data.products.filter(
        (product) => Number(product.category_id) === Number(categoryToRemove.category_id)
      );
      await Promise.all(categorizedProducts.map((product) => update('products', product._docId, {
        category_name: product.category_name || categoryToRemove.category_name
      })));
      await remove('categories', categoryToRemove._docId);
      await refresh();
      await log('DELETE', 'Product', `CAT-${String(categoryToRemove.category_id).padStart(4, '0')}`, {
        summary: `Removed category "${categoryToRemove.category_name}"`,
        category_id: categoryToRemove.category_id,
        category_name: categoryToRemove.category_name,
      });
      if (Number(pr.category) === categoryToRemove.category_id) {
        setPr((current) => ({ ...current, category: '', page: 1 }));
      }
      showToast('Category removed. Products will keep their category label.');
      setCategoryToRemove(null);
    } catch (error) {
      console.error('Failed to remove category:', error);
      showToast('Could not remove category. Please try again.');
    }
  };

  const saveProduct = async () => {
    const d = productDraft;
    const code = d.product_code.trim();
    const name = d.product_name.trim().replace(/\s+/g, ' ');
    const unit = d.unit.trim();
    const price = Number(d.selling_price);
    const reorderLevel = Number(d.reorder_level);

    const fail = (msg) => showToast(msg);
    if (!code) return fail('Enter a product code');
    if (data.products.some((p) => p.product_id !== editingId && p.product_code.toLowerCase() === code.toLowerCase()))
      return fail('That product code is already used');
    if (!name) return fail('Enter a product name');
    if (name.length > PRODUCT_NAME_MAX_LENGTH) return fail(`Product name must be ${PRODUCT_NAME_MAX_LENGTH} characters or fewer`);
    const selectedCategory = categoryById(d.category_id);
    const existingProduct = editingId ? productById(editingId) : null;
    const retainedCategoryName = existingProduct && Number(existingProduct.category_id) === Number(d.category_id)
      ? existingProduct.category_name || categoryById(existingProduct.category_id)?.category_name
      : '';
    if (!selectedCategory && !retainedCategoryName) return fail(data.categories.length ? 'Select a category' : 'Add a category first');
    const selectedCategoryName = selectedCategory?.category_name || retainedCategoryName;
    if (!unit) return fail('Enter a unit');
    if (unit.length > PRODUCT_UNIT_MAX_LENGTH) return fail(`Unit must be ${PRODUCT_UNIT_MAX_LENGTH} characters or fewer`);
    if (d.description.trim().length > PRODUCT_DESCRIPTION_MAX_LENGTH) {
      return fail(`Description must be ${PRODUCT_DESCRIPTION_MAX_LENGTH} characters or fewer`);
    }
    if (d.selling_price === '' || !Number.isFinite(price)) return fail('Enter a selling price');
    if (price < 0) return fail('Selling price can’t be negative');
    if (!hasAtMostTwoDecimalPlaces(price)) return fail('Selling price can have at most 2 decimal places');
    if (d.reorder_level === '' || !Number.isFinite(reorderLevel)) return fail('Enter a reorder level');
    if (reorderLevel < 0) return fail('Reorder level can’t be negative');
    if (!hasAtMostTwoDecimalPlaces(reorderLevel)) return fail('Reorder level can have at most 2 decimal places');
    if (!PRODUCT_STATUSES.includes(d.status)) return fail('Select a status');

    if (editingId) {
      const p = productById(editingId);
      const inventory = inventoryByProduct(editingId);
      await update('products', p._docId, {
        product_code: code,
        product_name: name,
        category_id: Number(d.category_id),
        category_name: selectedCategoryName,
        description: d.description.trim(),
        unit,
        selling_price: round2(price),
        status: d.status
      });
      if (inventory) {
        await update('inventory', inventory._docId, {
          reorder_level: reorderLevel,
          stock_status: stockStatusOf(inventory.quantity_on_hand, reorderLevel),
          last_updated: isoDate(new Date())
        });
      } else {
        const invId = data.inventory.reduce((m, i) => Math.max(m, i.inventory_id), 0) + 1;
        await add('inventory', {
          inventory_id: invId,
          product_id: editingId,
          quantity_on_hand: 0,
          reorder_level: reorderLevel,
          stock_status: stockStatusOf(0, reorderLevel),
          last_updated: isoDate(new Date())
        }, 'inventory_id');
      }
      await refresh();
      await log('UPDATE', 'Product', code, {
        summary: `Updated product ${code} — ${name}`,
        product_id: editingId,
        product_code: code,
        product_name: name,
        reorder_level: reorderLevel,
        status: d.status,
      });
      showToast('Product updated ✓');
    } else {
      const id = data.products.reduce((m, p) => Math.max(m, p.product_id), 0) + 1;
      await add('products', {
        product_id: id,
        product_code: code,
        product_name: name,
        category_id: Number(d.category_id),
        category_name: selectedCategoryName,
        description: d.description.trim(),
        unit,
        selling_price: round2(price),
        status: d.status
      }, 'product_id');
      const invId = data.inventory.reduce((m, i) => Math.max(m, i.inventory_id), 0) + 1;
      await add('inventory', {
        inventory_id: invId,
        product_id: id,
        quantity_on_hand: 0,
        reorder_level: reorderLevel,
        stock_status: stockStatusOf(0, reorderLevel),
        last_updated: isoDate(new Date())
      }, 'inventory_id');
      await refresh();
      await log('CREATE', 'Product', code, {
        summary: `Added product ${code} — ${name}`,
        product_id: id,
        product_code: code,
        product_name: name,
        selling_price: round2(price),
        unit,
        reorder_level: reorderLevel,
      });
      setPr({ search: '', category: '', page: 9999 });
      showToast('Product added ✓');
    }
    closeProductModal();
  };

  const detailProduct = detailId ? productById(detailId) : null;
  const clearFilters = () => setPr({ ...PR_DEFAULT });
  const hasFilters = !!(pr.search || pr.category);

  return (
    <>
      <Topbar title="Products" />

      <Box sx={style.content}>
        <Box sx={style.searchFilterBar}>
          <TextField size="small" placeholder="Search product name or code"
            value={pr.search}
            onChange={(e) => setPr((p) => ({ ...p, search: e.target.value, page: 1 }))}
            fullWidth />
          <TextField select size="small" label="Category" value={pr.category}
            onChange={(e) => setPr((p) => ({ ...p, category: e.target.value, page: 1 }))}
            sx={{ minWidth: { xs: '100%', md: 200 } }}>
            <MenuItem value="">All categories</MenuItem>
            {filterCategories.map((category) => (
              <MenuItem key={category.category_id} value={category.category_id}>
                {category.category_name}{category.unlisted ? ' (Unlisted)' : ''}
              </MenuItem>
            ))}
          </TextField>
          <Button sx={{ ...filterChip, height: 40, whiteSpace: 'nowrap' }} startIcon={<FilterAltOffIcon />} onClick={clearFilters}>
            Clear Filters
          </Button>
          {isAdmin && (
            <>
              <Button variant="outlined" sx={{ height: 40, whiteSpace: 'nowrap' }} onClick={openCategories}>Categories</Button>
              <Button variant="contained" sx={{ height: 40, whiteSpace: 'nowrap' }} onClick={openAddProduct}>+ Add Product</Button>
            </>
          )}
        </Box>

        {/* DESKTOP TABLE */}
        <Box sx={{ display: { xs: 'none', sm: 'block' }, ...style.tableWrap }}>
          <Table sx={style.table}>
            <TableHead>
              <TableRow>
                <TableCell>Product Code</TableCell>
                <TableCell>Product Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Selling Price</TableCell>
                <TableCell align="right">Stock</TableCell>
                <TableCell>Unit</TableCell>
                {isAdmin && <TableCell sx={{ width: 100 }}>Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} sx={style.emptyCell}>
                    {data.products.length
                      ? (hasFilters ? <>No products match these filters.{' '}<Button sx={{ ...filterChip, ml: 1 }} startIcon={<FilterAltOffIcon />} onClick={clearFilters}>Clear Filters</Button></> : 'No products match.')
                      : isAdmin ? 'No products yet. Select + Add Product to create one.' : 'No products yet.'}
                  </TableCell>
                </TableRow>
              ) : pageRows.map((p) => {
                const inv = inventoryByProduct(p.product_id);
                return (
                  <TableRow key={p.product_id} hover tabIndex={0}
                    onDoubleClick={() => setDetailId(p.product_id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setDetailId(p.product_id); } }}
                    sx={{ cursor: 'pointer' }}>
                    <TableCell>{p.product_code}</TableCell>
                    <TableCell>{p.product_name}{p.status !== 'Active' && <Chip label="Inactive" size="small" sx={style.inactivePill} />}</TableCell>
                    <TableCell>{categoryById(p.category_id)?.category_name || p.category_name || '—'}</TableCell>
                    <TableCell align="right">{peso(p.selling_price)}</TableCell>
                    <TableCell align="right">{inv ? fmtQty(inv.quantity_on_hand) : '—'}</TableCell>
                    <TableCell>{p.unit}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button size="small" sx={actionChip} startIcon={<EditOutlinedIcon />}
                          onClick={(e) => { e.stopPropagation(); openEditProduct(p.product_id); }}
                          onKeyDown={stopRowActivationPropagation}
                          aria-label={`Edit product ${p.product_name}`}>
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>

        {/* MOBILE CARDS */}
        <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 2 }}>
          {pageRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: TOKENS.gray5 }}>No products match these filters.</Box>
          ) : pageRows.map((p) => {
            const inv = inventoryByProduct(p.product_id);
            return (
              <Card
                key={p.product_id}
                variant="outlined"
                onClick={() => setDetailId(p.product_id)}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDetailId(p.product_id);
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
                        {p.product_code}
                      </Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, mt: 0.5 }}>{p.product_name}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 15, color: TOKENS.hlBlueDark }}>{peso(p.selling_price)}</Typography>
                      {p.status !== 'Active' && <Chip label="Inactive" size="small" sx={{ mt: 0.5 }} />}
                    </Box>
                  </Box>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.gray5, letterSpacing: 0.5 }}>Category / Stock</Typography>
                      <Typography sx={{ fontSize: 12, mt: 0.25 }}>
                        {categoryById(p.category_id)?.category_name || p.category_name || '—'} · {inv ? fmtQty(inv.quantity_on_hand) : '—'} {p.unit}
                      </Typography>
                    </Box>
                    {isAdmin && (
                      <Button size="small" sx={actionChip} startIcon={<EditOutlinedIcon />}
                        onClick={(e) => { e.stopPropagation(); openEditProduct(p.product_id); }}
                        onKeyDown={stopRowActivationPropagation}
                        aria-label={`Edit product ${p.product_name}`}>
                        Edit
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>

        <Typography sx={style.tableHint}>Double-click a row (or tap a card) to view the product.</Typography>

        <Pagination page={safePage} totalPages={totalPages} onPrev={() => setPr((p) => ({ ...p, page: safePage - 1 }))} onNext={() => setPr((p) => ({ ...p, page: safePage + 1 }))}
          info={filtered.length ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + pageRows.length} of ${filtered.length} product${filtered.length === 1 ? '' : 's'}` : '0 products'} />
      </Box>

      {/* MODALS */}
      {isAdmin && modalMode === 'product' && productDraft && (
        <Modal open title={editingId ? 'Edit Product' : 'Add Product'} onClose={closeProductModal} onConfirm={saveProduct} confirmLabel={editingId ? 'Save changes' : 'Save product'} confirmationTitle={editingId ? 'Confirm product update' : 'Confirm new product'} confirmationMessage={editingId ? 'Save these product changes? This may affect future sales and inventory records.' : 'Add this product to the catalog? It will be available for inventory and sales operations.'} confirmationLabel={editingId ? 'Save changes' : 'Add product'} width="form">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, pt: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
              <Field label="Product Name" sx={{ flex: 2 }}>
                <TextField
                  autoFocus={!editingId}
                  size="small"
                  fullWidth
                  placeholder="e.g. Cement 40kg"
                  inputProps={{ maxLength: PRODUCT_NAME_MAX_LENGTH }}
                  value={productDraft.product_name}
                  onChange={(e) => setProductDraft((d) => ({ ...d, product_name: e.target.value }))}
                />
              </Field>
            </Box>
            <Field label="Category">
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
                <TextField select size="small" fullWidth value={productDraft.category_id}
                  onChange={(e) => {
                    const categoryId = e.target.value;
                    setProductDraft((draft) => ({
                      ...draft,
                      category_id: categoryId,
                      product_code: Number(categoryId) === Number(draft.category_id)
                        ? draft.product_code
                        : nextProductCode(categoryId, editingId)
                    }));
                  }}>
                  <MenuItem value="">{data.categories.length ? 'Select category…' : 'No categories yet — add one'}</MenuItem>
                  {productDraft.category_id && !categoryById(productDraft.category_id) && (
                    <MenuItem value={productDraft.category_id}>{productDraft.category_name || 'Removed category'}</MenuItem>
                  )}
                  {data.categories.map((c) => <MenuItem key={c.category_id} value={c.category_id}>{c.category_name}</MenuItem>)}
                </TextField>
              </Box>
            </Field>
            <Field label="Product Code">
              <Typography
                sx={{
                  minHeight: 40,
                  display: 'flex',
                  alignItems: 'center',
                  px: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  color: 'text.primary',
                  bgcolor: 'action.hover'
                }}
              >
                {productDraft.product_code || 'Select a category to generate'}
              </Typography>
            </Field>
            <Field label="Description (optional)">
              <TextField
                size="small"
                fullWidth
                multiline
                rows={2}
                placeholder="Optional product details"
                inputProps={{ maxLength: PRODUCT_DESCRIPTION_MAX_LENGTH }}
                value={productDraft.description}
                onChange={(e) => setProductDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </Field>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
              <Field label="Unit">
                <TextField
                  size="small"
                  fullWidth
                  placeholder="e.g. pcs, bag, box"
                  inputProps={{ maxLength: PRODUCT_UNIT_MAX_LENGTH }}
                  value={productDraft.unit}
                  onChange={(e) => setProductDraft((d) => ({ ...d, unit: e.target.value }))}
                />
              </Field>
              <Field label="Reorder Level">
                <TextField
                  size="small"
                  type="number"
                  fullWidth
                  placeholder="0"
                  inputProps={{ min: 0, step: 0.01, inputMode: 'decimal' }}
                  value={productDraft.reorder_level}
                  onChange={(e) => setProductDraft((d) => ({ ...d, reorder_level: e.target.value }))}
                />
              </Field>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
              <Field label="Selling Price">
                <TextField
                  size="small"
                  type="number"
                  fullWidth
                  placeholder="0.00"
                  inputProps={{ min: 0, step: 0.01, inputMode: 'decimal' }}
                  value={productDraft.selling_price}
                  onChange={(e) => setProductDraft((d) => ({ ...d, selling_price: e.target.value }))}
                />
              </Field>
              <Field label="Status">
                <TextField select size="small" fullWidth value={productDraft.status} onChange={(e) => setProductDraft((d) => ({ ...d, status: e.target.value }))}>
                  {PRODUCT_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
              </Field>
            </Box>
          </Box>
        </Modal>
      )}

      {isAdmin && modalMode === 'categories' && (
        <Modal open title="Manage Categories" onClose={() => setModalMode(null)} onConfirm={saveCategory}
          confirmLabel="Add Category" confirmationTitle="Confirm new category"
          confirmationMessage="Add this category to the product catalog?" confirmationLabel="Add category" width="form">
          <Box sx={{ pt: 1 }}>
            <Typography sx={style.categorySectionTitle}>Add Category</Typography>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, mb: 2 }}>
              <Field label="Category Code" sx={{ flex: { sm: '0 0 140px' } }}>
                <TextField autoFocus fullWidth size="small" value={categoryCode}
                  inputProps={{ maxLength: 3, pattern: '[A-Za-z]{3}', 'aria-label': 'Three-letter category code' }}
                  placeholder="e.g. CEM"
                  onChange={(e) => setCategoryCode(e.target.value.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveCategory(); } }} />
              </Field>
              <Field label="Category Name" sx={{ flex: 1 }}>
                <TextField fullWidth size="small" value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveCategory(); } }} />
              </Field>
            </Box>
            <Typography sx={style.categorySectionTitle}>Remove Category</Typography>
            <Box sx={style.categoryList}>
              {data.categories.length ? data.categories.map((category) => (
                <Box key={category.category_id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, py: 0.75, borderBottom: `1px solid ${TOKENS.gray2}` }}>
                  <Typography sx={{ fontSize: 13, overflowWrap: 'anywhere' }}>
                    <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 700, mr: 1 }}>
                      {categoryCodeOf(category)}
                    </Box>
                    {category.category_name}
                  </Typography>
                  <Button size="small" color="error" startIcon={<DeleteOutlineIcon />}
                    onClick={() => setCategoryToRemove(category)}
                    aria-label={`Remove category ${category.category_name}`}>
                    Remove
                  </Button>
                </Box>
              )) : <Typography sx={{ fontSize: 13, color: TOKENS.gray5 }}>No categories to remove.</Typography>}
            </Box>
          </Box>
        </Modal>
      )}

      {isAdmin && categoryToRemove && (
        <Modal open title="Remove Category" onClose={() => setCategoryToRemove(null)} onConfirm={deleteCategory}
          confirmLabel="Remove category" width="narrow">
          <Typography sx={{ fontSize: 13, py: 1 }}>
            Remove "{categoryToRemove.category_name}"? It will no longer be available for new products, and existing products will keep showing this category.
          </Typography>
        </Modal>
      )}

      <DetailModal open={!!detailProduct} title={detailProduct ? 'Product — ' + detailProduct.product_name : ''} onClose={() => setDetailId(null)}>
        {detailProduct && <ProductDetails product={detailProduct} />}
      </DetailModal>
    </>
  );
}

function ProductDetails({ product }) {
  const { categoryById, inventoryByProduct } = useData();
  const inv = inventoryByProduct(product.product_id);
  const cat = categoryById(product.category_id);
  const stockBadge = (s) => (
    <Chip label={s} size="small" color={s === 'Low Stock' ? 'warning' : s === 'Out of Stock' ? 'default' : 'success'} />
  );

  return (
    <Box>
      <Typography sx={style.sectionTitle}>Product information</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 2, mb: 2 }}>
        <Info label="Product Code" value={product.product_code} />
        <Info label="Product Name" value={product.product_name} />
        <Info label="Category" value={cat?.category_name || product.category_name || '—'} />
        <Info label="Unit" value={product.unit} />
        <Info label="Selling Price" value={peso(product.selling_price)} />
        <Info label="Status" value={<Chip label={product.status} size="small" color={product.status === 'Active' ? 'success' : 'default'} />} />
      </Box>
      <Typography sx={style.sectionTitle}>Description</Typography>
      <Box sx={style.descBox}>
        {product.description ? <Typography sx={{ fontSize: 13 }}>{product.description}</Typography> : <Typography sx={{ ...style.descEmpty, fontSize: 13 }}>No description.</Typography>}
      </Box>
      <Typography sx={style.sectionTitle}>Inventory</Typography>
      {inv ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 2 }}>
          <Info label="Quantity on Hand" value={`${fmtQty(inv.quantity_on_hand)} ${product.unit}`} />
          <Info label="Reorder Level" value={`${fmtQty(inv.reorder_level)} ${product.unit}`} />
          <Info label="Stock Status" value={stockBadge(inv.stock_status)} />
          <Info label="Last Updated" value={inv.last_updated} />
        </Box>
      ) : (
        <Typography sx={{ fontSize: 13, color: TOKENS.gray5 }}>No inventory record for this product.</Typography>
      )}
    </Box>
  );
}

const Info = ({ label, value }) => (
  <Box><Typography sx={style.infoLabel}>{label}</Typography><Typography sx={style.infoValue}>{value}</Typography></Box>
);