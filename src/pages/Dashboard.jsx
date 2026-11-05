import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import dashboardStyle from '../styles/DashboardStyle';
import ChartBox from '../components/ChartBox';
import PaymentStatusBadges from '../components/PaymentStatusBadges';
import Topbar from '../components/Topbar';
import { useData } from '../context/DataContext';
import { peso, round2, isoDate, fmtSaleId, fmtDate } from '../utils/format';
import { daysBetween, shortWeekday } from '../utils/reportHelpers';
import { saleDueStatus } from '../utils/businessRules';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { data, saleCustomerName } = useData();
  const { isAdmin } = useAuth();

  const stats = useMemo(() => {
    const today = isoDate(new Date());
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yesterday = isoDate(y);

    const activeSales = data.sales.filter((s) => s.sale_status !== 'Cancelled');
    const todayTotal = round2(activeSales
      .filter((s) => s.sale_date === today)
      .reduce((sum, s) => sum + s.total_amount, 0));
    const ydayTotal = round2(activeSales
      .filter((s) => s.sale_date === yesterday)
      .reduce((sum, s) => sum + s.total_amount, 0));

    const lowStock = data.inventory.filter((i) => i.stock_status !== 'In Stock').length;
    const pendingDel = data.customer_deliveries.filter((d) => d.delivery_status === 'Pending').length;
    const dueToday = data.customer_deliveries
      .filter((d) => d.delivery_status === 'Pending' && (d.scheduled_delivery_date || d.delivery_date) === today).length;

    let salesTrend = '—';
    if (ydayTotal > 0) {
      const pct = Math.round(((todayTotal - ydayTotal) / ydayTotal) * 100);
      salesTrend = `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs yesterday`;
    } else if (todayTotal > 0) {
      salesTrend = 'No sales yesterday';
    }

    return [
      { num: peso(todayTotal), lbl: "Today's sales", trend: salesTrend },
      { num: String(lowStock), lbl: 'Low stock items', trend: lowStock > 0 ? 'Needs reorder' : 'All good' },
      { num: String(pendingDel), lbl: 'Pending deliveries', trend: dueToday > 0 ? `${dueToday} due today` : 'None due today' },
      { num: String(data.customers.length), lbl: 'Total customers', trend: 'Registered accounts' }
    ];
  }, [data.sales, data.inventory, data.customer_deliveries, data.customers]);

  const weeklySales = useMemo(() => {
    const end = isoDate(new Date());
    const start = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return isoDate(d); })();
    const days = daysBetween(start, end);
    const map = new Map(days.map((d) => [d, 0]));
    data.sales
      .filter((s) => s.sale_status !== 'Cancelled' && s.sale_date >= start && s.sale_date <= end)
      .forEach((s) => map.set(s.sale_date, (map.get(s.sale_date) || 0) + s.total_amount));
    return days.map((d) => ({ label: shortWeekday(d), value: round2(map.get(d) || 0) }));
  }, [data.sales]);

  const inventoryLevels = useMemo(() => {
    const byCat = new Map();
    data.products.forEach((p) => {
      const inv = data.inventory.find((i) => i.product_id === p.product_id);
      const qty = inv?.quantity_on_hand || 0;
      byCat.set(p.category_id, (byCat.get(p.category_id) || 0) + qty);
    });
    return Array.from(byCat.entries())
      .map(([catId, qty]) => {
        const cat = data.categories.find((c) => c.category_id === catId);
        return {
          label: cat?.category_code || 'UNC',
          title: cat?.category_name || 'Uncategorized',
          value: round2(qty)
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [data.products, data.inventory, data.categories]);

  const lowStockItems = useMemo(() => {
    return data.inventory
      .filter((i) => i.stock_status !== 'In Stock')
      .map((i) => {
        const p = data.products.find((x) => x.product_id === i.product_id);
        return { ...i, product: p };
      })
      .filter((r) => r.product)
      .sort((a, b) => {
        const aOut = a.quantity_on_hand <= 0;
        const bOut = b.quantity_on_hand <= 0;
        if (aOut !== bOut) return aOut ? -1 : 1;
        const aRatio = a.reorder_level > 0 ? a.quantity_on_hand / a.reorder_level : Infinity;
        const bRatio = b.reorder_level > 0 ? b.quantity_on_hand / b.reorder_level : Infinity;
        return aRatio - bRatio || a.quantity_on_hand - b.quantity_on_hand;
      })
      .slice(0, 5);
  }, [data.inventory, data.products]);

  const recentSales = useMemo(() => {
    return [...data.sales]
      .filter((s) => s.sale_status !== 'Cancelled')
      .sort((a, b) => (b.sale_date + ' ' + b.sale_time).localeCompare(a.sale_date + ' ' + a.sale_time))
      .slice(0, 5);
  }, [data.sales]);

  // ACCESSIBILITY: Screen reader descriptions for charts
  const salesChartDescription = weeklySales.map(s => `${s.label}: ${peso(s.value)}`).join(', ');
  const inventoryChartDescription = inventoryLevels.map(s => `${s.title} (${s.label}): ${s.value} units`).join(', ');

  return (
    <>
      <Topbar title="Dashboard" />
      <Box component="main" sx={dashboardStyle.content}>

        {/* Stats Grid */}
        <Box sx={dashboardStyle.grid4}>
          {stats.map((s) => (
            <Box key={s.lbl} sx={dashboardStyle.statCard}>
              <Typography sx={dashboardStyle.statNum}>{s.num}</Typography>
              <Typography sx={dashboardStyle.statLbl}>{s.lbl}</Typography>
              <Typography sx={dashboardStyle.statTrend}>{s.trend}</Typography>
            </Box>
          ))}
        </Box>

        {/* Charts */}
        <Box sx={{
          ...dashboardStyle.grid2,
          gridTemplateColumns: isAdmin
            ? dashboardStyle.grid2.gridTemplateColumns
            : { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr)' }
        }}>
          {isAdmin && (
            <Box
              sx={{ minWidth: 0, width: '100%', overflow: 'visible' }}
              role="img"
              aria-label={`Weekly Sales Chart. ${salesChartDescription}`}
            >
              <ChartBox
                title="Weekly Sales Chart"
                money
                data={weeklySales}
                scrollable
                minBarWidth={60}
              />
            </Box>
          )}
          <Box
            sx={{ minWidth: 0, width: '100%', overflow: 'visible' }}
            role="img"
            aria-label={`Inventory Levels Chart. ${inventoryChartDescription}`}
          >
            <ChartBox
              title="Inventory Levels Chart"
              data={inventoryLevels}
              scrollable
              minBarWidth={60}
            />
          </Box>
        </Box>

        {/* Panels */}
        <Box sx={{
          ...dashboardStyle.panelsRow,
          gridTemplateColumns: isAdmin
            ? dashboardStyle.panelsRow.gridTemplateColumns
            : { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr)' }
        }}>
          {isAdmin && (
            <Box sx={dashboardStyle.panel}>
              <Typography sx={dashboardStyle.panelTitle}>Recent Sales</Typography>
              {Array.from({ length: 5 }, (_, index) => {
                const sale = recentSales[index];
                return sale ? (
                  <Box key={sale.sale_id} sx={dashboardStyle.panelRow}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={dashboardStyle.panelRowName}>
                        {fmtSaleId(sale.sale_id)} · {saleCustomerName(sale)}
                      </Typography>
                      <Typography sx={dashboardStyle.panelRowMeta}>{fmtDate(sale.sale_date)}</Typography>
                      <Box sx={{ mt: 0.5 }}>
                        <PaymentStatusBadges status={sale.payment_status} dueStatus={saleDueStatus(sale, data.payment_terms, data.customer_payments)} />
                      </Box>
                    </Box>
                    <Typography sx={dashboardStyle.panelRowValue}>{peso(sale.total_amount)}</Typography>
                  </Box>
                ) : (
                  <Box key={`empty-sale-${index}`} sx={dashboardStyle.panelEmptySlot}>
                    {index === 0 && recentSales.length === 0 ? 'No sales yet.' : 'No additional sales'}
                  </Box>
                );
              })}
            </Box>
          )}

          <Box sx={dashboardStyle.panel}>
            <Typography sx={dashboardStyle.panelTitle}>Low Stock Items</Typography>
            {Array.from({ length: 5 }, (_, index) => {
              const item = lowStockItems[index];
              return item ? (
                <Box key={item.product_id} sx={dashboardStyle.panelRow}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={dashboardStyle.panelRowName}>{item.product.product_name}</Typography>
                    <Typography sx={dashboardStyle.panelRowMeta}>
                      {item.product.product_code} · {item.product.unit}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{
                      ...dashboardStyle.panelRowValue,
                      color: item.quantity_on_hand === 0 ? '#A63A22' : '#B27F1F'
                    }}>
                      {item.quantity_on_hand}
                    </Typography>
                    <Typography sx={dashboardStyle.panelRowValueSub}>
                      reorder at {item.reorder_level}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Box key={`empty-stock-${index}`} sx={dashboardStyle.panelEmptySlot}>
                  {index === 0 && lowStockItems.length === 0
                    ? 'All products are sufficiently stocked.'
                    : 'No additional low-stock items'}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    </>
  );
}