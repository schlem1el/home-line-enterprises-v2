// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import theme from './styles/theme';

import Sidebar from './components/Sidebar';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import StaffBlockedRoute from './components/StaffBlockedRoute';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import { SidebarProvider } from './context/SidebarContext';

import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ChangePassword from './pages/ChangePassword';
import Admin from './pages/Admin';
import AuditTrail from './pages/AuditTrail';

import Dashboard from './pages/Dashboard';
import NewSale from './pages/NewSale';
import SalesHistory from './pages/SalesHistory';
import NewPurchase from './pages/NewPurchase';
import PurchaseHistory from './pages/PurchaseHistory';
import ProductsPage from './pages/ProductsPage';
import Deliveries from './pages/Deliveries';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import CustomerPayments from './pages/CustomerPayments';
import SupplierPayments from './pages/SupplierPayments';
import SalesReports from './pages/SalesReports';
import InventoryReports from './pages/InventoryReports';
import PurchaseReports from './pages/PurchaseReports';
import PaymentReports from './pages/PaymentReports';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const main = document.querySelector('main');
    if (main) {
      main.scrollTop = 0;
      main.scrollLeft = 0;
    }
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <ToastProvider>
            <DataProvider>
              <SidebarProvider>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />

                  <Route path="/*" element={
                    <ProtectedRoute>
                      {/* FIX: Lock to viewport height, hide outer scrollbar */}
                      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: '#fff' }}>
                        <Sidebar />

                        {/* FIX: Main area handles its own scrolling */}
                        <Box
                          component="main"
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            height: '100%',
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            position: 'relative'
                          }}
                        >
                          <Routes>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/change-password" element={<ChangePassword />} />

                            <Route path="/sales/new" element={<NewSale />} />
                            <Route path="/sales/history" element={<SalesHistory />} />

                            <Route path="/purchases/new" element={<NewPurchase />} />
                            <Route path="/purchases/history" element={<PurchaseHistory />} />

                            <Route path="/products" element={<ProductsPage />} />
                            <Route path="/deliveries" element={<Deliveries />} />

                            <Route path="/customers" element={<StaffBlockedRoute path="/customers"><Customers /></StaffBlockedRoute>} />
                            <Route path="/suppliers" element={<StaffBlockedRoute path="/suppliers"><Suppliers /></StaffBlockedRoute>} />
                            <Route path="/payments/customer" element={<StaffBlockedRoute path="/payments/customer"><CustomerPayments /></StaffBlockedRoute>} />
                            <Route path="/payments/supplier" element={<StaffBlockedRoute path="/payments/supplier"><SupplierPayments /></StaffBlockedRoute>} />

                            <Route path="/reports/sales" element={<StaffBlockedRoute path="/reports/sales"><SalesReports /></StaffBlockedRoute>} />
                            <Route path="/reports/inventory" element={<StaffBlockedRoute path="/reports/inventory"><InventoryReports /></StaffBlockedRoute>} />
                            <Route path="/reports/purchase" element={<StaffBlockedRoute path="/reports/purchase"><PurchaseReports /></StaffBlockedRoute>} />
                            <Route path="/reports/payment" element={<StaffBlockedRoute path="/reports/payment"><PaymentReports /></StaffBlockedRoute>} />

                            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                            <Route path="/admin/audit" element={<AdminRoute><AuditTrail /></AdminRoute>} />

                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                          </Routes>
                        </Box>
                      </Box>
                    </ProtectedRoute>
                  } />
                </Routes>
              </SidebarProvider>
            </DataProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}