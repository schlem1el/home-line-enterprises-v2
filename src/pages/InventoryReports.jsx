import React, { useMemo, useState } from 'react';
import { Box, TextField, MenuItem, Button, Typography, Card, CardContent, Divider, Chip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import Topbar from '../components/Topbar';
import ChartBox from '../components/ChartBox';
import ReportTable from '../components/ReportTable';
import Pagination from '../components/Pagination';
import DetailModal from '../components/DetailModal';
import reportStyle from '../styles/ReportStyle';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { fmtQty, round2, peso } from '../utils/format';
import { TOKENS } from '../styles/HomeLineStyles';
import { truncate } from '../utils/reportHelpers';
import { generatePdfReport } from '../utils/pdfReport';

const PAGE_SIZE = 10;
const STOCK_STATUSES = ['In Stock', 'Low Stock', 'Out of Stock'];

export default function InventoryReports() {
  const { data, productById, categoryById, inventoryByProduct, refresh: refreshData } = useData();
  const { profile } = useAuth();
  const showToast = useToast();

  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [sortKey, setSortKey] = useState('product');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [detailProductId, setDetailProductId] = useState(null);

  const rows = useMemo(() => {
    const list = data.products
      .filter((p) => !categoryId || p.category_id === Number(categoryId))
      .map((p) => {
        const inv = data.inventory.find((i) => i.product_id === p.product_id) || {};
        const cat = data.categories.find((c) => c.category_id === p.category_id);
        return {
          _key: p.product_id,
          code: p.product_code,
          product: p.product_name,
          category: cat?.category_name || '—',
          stock: inv.quantity_on_hand ?? 0,
          reorder: inv.reorder_level ?? 0,
          status: inv.stock_status || '—'
        };
      })
      .filter((r) => !status || r.status === status);

    list.sort((a, b) => {
      let r = 0;
      switch (sortKey) {
        case 'product': r = a.product.localeCompare(b.product); break;
        case 'category': r = a.category.localeCompare(b.category); break;
        case 'stock': r = a.stock - b.stock; break;
        case 'reorder': r = a.reorder - b.reorder; break;
        case 'status': r = a.status.localeCompare(b.status); break;
      }
      return sortDir === 'asc' ? r : -r;
    });
    return list;
  }, [data.products, data.inventory, data.categories, categoryId, status, sortKey, sortDir]);

  const chartData = useMemo(() =>
    [...rows]
      .sort((a, b) => b.stock - a.stock)
      .map((r) => ({ label: truncate(r.code, 10), value: round2(r.stock) })),
    [rows]);

  const columns = [
    { key: 'product', label: 'Product' },
    { key: 'category', label: 'Category' },
    { key: 'stock', label: 'Current Stock', num: true, format: (v) => fmtQty(v), pdf: (v) => fmtQty(v) },
    { key: 'reorder', label: 'Reorder Level', num: true, format: (v) => fmtQty(v), pdf: (v) => fmtQty(v) },
    { key: 'status', label: 'Status' }
  ];

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const onSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const refresh = async () => {
    await refreshData();
    showToast('Data refreshed from Firestore');
  };
  const categoryLabel = !categoryId
    ? 'All categories'
    : (data.categories.find((c) => c.category_id === Number(categoryId))?.category_name || categoryId);
  const statusLabel = status || 'All statuses';

  const exportPdf = async () => {
    await generatePdfReport({
      title: 'Inventory Report',
      subtitle: `${rows.length} product${rows.length === 1 ? '' : 's'}`,
      filters: [
        ['Category', categoryLabel],
        ['Stock Status', statusLabel],
      ],
      columns: [
        { key: 'code', label: 'Code', weight: 0.9 },
        { key: 'product', label: 'Product', weight: 3.0 },
        { key: 'category', label: 'Category', weight: 1.6 },
        { key: 'stock', label: 'Current Stock', num: true, weight: 1.0, pdf: (v) => fmtQty(v) },
        { key: 'reorder', label: 'Reorder Level', num: true, weight: 1.0, pdf: (v) => fmtQty(v) },
        { key: 'status', label: 'Status', weight: 1.0 },
      ],
      rows,
      filename: 'inventory-report',
      landscape: true,
      preparedBy: profile?.full_name || profile?.email || '',
    });
    showToast('PDF exported');
  };

  const detailProduct = detailProductId ? productById(detailProductId) : null;

  return (
    <>
      <Topbar title="Inventory Reports" />
      <Box component="main" sx={reportStyle.content}>
        <Box sx={reportStyle.filterBar}>
          <Box sx={reportStyle.filterGroup}>
            <TextField select size="small" label="Category" value={categoryId}
              onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} sx={reportStyle.filterField}>
              <MenuItem value="">All categories</MenuItem>
              {data.categories.map((c) => <MenuItem key={c.category_id} value={c.category_id}>{c.category_name}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Stock Status" value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }} sx={reportStyle.filterField}>
              <MenuItem value="">All statuses</MenuItem>
              {STOCK_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Box>
          <Box sx={reportStyle.actionGroup}>
            <Button sx={reportStyle.btnSm} startIcon={<RefreshIcon />} onClick={refresh}>Refresh</Button>
            <Button variant="contained" sx={reportStyle.btnExport} startIcon={<PictureAsPdfIcon />} onClick={exportPdf}>Export PDF</Button>
          </Box>
        </Box>

        <Box
          sx={reportStyle.chartWrap}
          role="img"
          aria-label={`Stock Level Chart. ${chartData.map(d => `${d.label}: ${d.value} units`).join(', ')}`}
        >
          <ChartBox
            title="Stock Level Chart"
            data={chartData}
            compact
            scrollable
          />
        </Box>

        <Typography sx={reportStyle.sectionTitle}>Breakdown</Typography>

        <Box sx={{ display: { xs: 'none', sm: 'block' }, ...reportStyle.tableWrap }}>
          <ReportTable
            columns={columns}
            rows={pageRows}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            ariaLabel="Inventory Report Data"
            onRowOpen={(row) => setDetailProductId(row._key)}
          />
        </Box>

        <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 2 }}>
          {pageRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: TOKENS.gray5 }}>No records match these filters.</Box>
          ) : pageRows.map((p) => (
            <Card
              key={p.code}
              variant="outlined"
              onClick={() => setDetailProductId(p._key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetailProductId(p._key);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`View ${p.product} details`}
              sx={{ borderRadius: 2, cursor: 'pointer', '&:hover': { borderColor: TOKENS.hlBlue, backgroundColor: TOKENS.hlBlueTint }, '&:focus-visible': { outline: `2px solid ${TOKENS.hlBlue}`, outlineOffset: 2 } }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box>
                    <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: TOKENS.hlBlueDark }}>
                      {p.code}
                    </Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, mt: 0.5 }}>{p.product}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Chip label={p.status} color={p.status === 'Low Stock' ? 'warning' : p.status === 'Out of Stock' ? 'default' : 'success'} size="small" />
                  </Box>
                </Box>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.gray5, letterSpacing: 0.5 }}>Category</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{p.category}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: 11, color: TOKENS.gray5 }}>Stock</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: TOKENS.hlBlueDark }}>{fmtQty(p.stock)}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPrev={() => setPage((p) => p - 1)}
          onNext={() => setPage((p) => p + 1)}
          info={rows.length
            ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + pageRows.length} of ${rows.length} product${rows.length === 1 ? '' : 's'}`
            : '0 products'}
        />
      </Box>

      <DetailModal open={!!detailProduct} title={detailProduct ? 'Product — ' + detailProduct.product_name : ''} onClose={() => setDetailProductId(null)}>
        {detailProduct && (
          <Box>
            <Typography sx={{ fontSize: 13, mb: 2 }}>Full product details can be viewed in the Products page.</Typography>
            {/* Add a quick view or just link to products page */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 2 }}>
              <Box><Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark }}>Code</Typography><Typography sx={{ fontSize: 13 }}>{detailProduct.product_code}</Typography></Box>
              <Box><Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark }}>Category</Typography><Typography sx={{ fontSize: 13 }}>{categoryById(detailProduct.category_id)?.category_name || '—'}</Typography></Box>
              <Box><Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark }}>Selling Price</Typography><Typography sx={{ fontSize: 13 }}>{peso(detailProduct.selling_price)}</Typography></Box>
              <Box><Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark }}>Current Stock</Typography><Typography sx={{ fontSize: 13 }}>{fmtQty(inventoryByProduct(detailProduct.product_id)?.quantity_on_hand)}</Typography></Box>
            </Box>
          </Box>
        )}
      </DetailModal>
    </>
  );
}