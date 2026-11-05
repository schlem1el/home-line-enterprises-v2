import React from 'react';
import { Box, Typography, TextField, MenuItem, Button } from '@mui/material';
import Topbar from '../components/Topbar';
import style from '../styles/ReportsStyles';
import { useToast } from '../context/ToastContext';
import { TOKENS } from '../styles/HomeLineStyles';

const REPORTS = {
  sales: {
    title: 'Sales Reports',
    chartLabel: 'SALES TREND CHART',
    columns: ['Date', 'Total Sales', 'No. of Transactions'],
    filterA: { label: 'Date range', options: ['All time', 'Today', 'This week', 'This month'] },
    filterB: { label: 'Product', options: ['All products'] }
  },
  inventory: {
    title: 'Inventory Reports',
    chartLabel: 'STOCK LEVEL CHART',
    columns: ['Product', 'Current Stock', 'Reorder Level', 'Status'],
    filterA: { label: 'Category', options: ['All categories'] },
    filterB: { label: 'Stock Status', options: ['All statuses', 'In Stock', 'Low Stock', 'Out of Stock'] }
  },
  purchase: {
    title: 'Purchase Reports',
    chartLabel: 'PURCHASES TREND CHART',
    columns: ['Date', 'Supplier', 'Total Purchases', 'No. of Orders'],
    filterA: { label: 'Date range', options: ['All time', 'Today', 'This week', 'This month'] },
    filterB: { label: 'Supplier', options: ['All suppliers'] }
  },
  payment: {
    title: 'Payment Reports',
    chartLabel: 'CUSTOMER VS SUPPLIER PAYMENTS CHART',
    columns: ['Date', 'Type', 'Reference No.', 'Amount', 'Status'],
    filterA: { label: 'Date range', options: ['All time', 'Today', 'This week', 'This month'] },
    filterB: { label: 'Payment Type', options: ['All types', 'Customer', 'Supplier'] }
  }
};

export default function Reports({ reportType = 'sales' }) {
  const cfg = REPORTS[reportType] || REPORTS.sales;
  const showToast = useToast();

  return (
    <>
      <Topbar title={cfg.title} />
      <Box sx={style.content}>
        <Box sx={style.filterBar}>
          <TextField select size="small" label={cfg.filterA.label} defaultValue={cfg.filterA.options[0]} sx={style.minWidth}>
            {cfg.filterA.options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
          </TextField>
          <TextField select size="small" label={cfg.filterB.label} defaultValue={cfg.filterB.options[0]} sx={style.minWidth}>
            {cfg.filterB.options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
          </TextField>
          <Button size="small" variant="outlined" onClick={() => showToast('Report generated')}>Generate</Button>
          <Button size="small" variant="contained" onClick={() => showToast('Export started (wireframe)')}>Export</Button>
        </Box>

        <Box sx={style.chartBox}>
          <Box sx={style.barsWrap}>
            {[30, 55, 40, 70, 50, 65, 35].map((h, i) => (
              <Box key={i} sx={{ ...style.bar, height: `${h}%` }} />
            ))}
          </Box>
          <Box>{cfg.chartLabel}</Box>
        </Box>

        <Typography sx={style.sectionTitle}>Breakdown</Typography>
        <Box sx={style.tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {cfg.columns.map((c) => (
                  <th key={c} style={style.th}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map((row) => (
                <tr key={row}>
                  {cfg.columns.map((c, idx) => (
                    <td key={idx} style={style.td}>
                      <Box sx={style.lineBlock(`${40 + Math.random() * 40}%`)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Box>
    </>
  );
}