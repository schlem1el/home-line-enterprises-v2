// src/components/Sidebar.jsx
import React, { useEffect, useState } from 'react';
import { Box, Button, Typography, Avatar, Collapse, Drawer, Tooltip, IconButton } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';

import DashboardIcon from '@mui/icons-material/Dashboard';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PeopleIcon from '@mui/icons-material/People';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PaymentsIcon from '@mui/icons-material/Payments';
import BarChartIcon from '@mui/icons-material/BarChart';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import LogoutIcon from '@mui/icons-material/Logout';

import logo from '../images/home-line-logo.png';
import { TOKENS } from '../styles/HomeLineStyles';
import { useSidebar } from '../context/SidebarContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions, STAFF_BLOCKED_ROUTES } from '../utils/permissions';
import Modal from './Modal'; // <-- Imported Modal for the confirmation

const NAV = [
  { type: 'link', label: 'Dashboard', to: '/dashboard', icon: DashboardIcon },
  {
    type: 'group', label: 'Purchases', icon: ShoppingCartIcon,
    children: [
      { label: 'New Purchase', to: '/purchases/new' },
      { label: 'Purchase History', to: '/purchases/history' },
    ],
  },
  {
    type: 'group', label: 'Sales', icon: PointOfSaleIcon,
    children: [
      { label: 'New Sale', to: '/sales/new' },
      { label: 'Sales History', to: '/sales/history' },
    ],
  },
  { type: 'link', label: 'Deliveries', to: '/deliveries', icon: LocalShippingIcon },
  { type: 'link', label: 'Products', to: '/products', icon: Inventory2Icon },
  { type: 'link', label: 'Customers', to: '/customers', icon: PeopleIcon },
  { type: 'link', label: 'Suppliers', to: '/suppliers', icon: StorefrontIcon },
  {
    type: 'group', label: 'Payments', icon: PaymentsIcon,
    children: [
      { label: 'Customer Payments', to: '/payments/customer' },
      { label: 'Supplier Payments', to: '/payments/supplier' },
    ],
  },
  {
    type: 'group', label: 'Reports', icon: BarChartIcon,
    children: [
      { label: 'Sales Reports', to: '/reports/sales' },
      { label: 'Inventory Reports', to: '/reports/inventory' },
      { label: 'Purchase Reports', to: '/reports/purchase' },
      { label: 'Payment Reports', to: '/reports/payment' },
    ],
  },
  { type: 'admin', label: 'Staff Management', to: '/admin', icon: AdminPanelSettingsIcon },
  { type: 'admin', label: 'Audit Trail', to: '/admin/audit', icon: HistoryEduIcon },
];

function SidebarContent({ onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { isAdmin } = usePermissions();
  const [openGroups, setOpenGroups] = React.useState({});
  const [logoutOpen, setLogoutOpen] = useState(false); // <-- Logout state

  const isActive = (to) => location.pathname === to;
  const isGroupActive = (g) => g.children.some((c) => isActive(c.to));
  const isGroupOpen = (g) => openGroups[g.label] ?? isGroupActive(g);

  const toggleGroup = (label) =>
    setOpenGroups((p) => ({ ...p, [label]: !p[label] }));

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      NAV.forEach((item) => {
        if (item.type !== 'group') return;
        const groupActive = item.children.some((c) => location.pathname === c.to);
        if (!groupActive) next[item.label] = false;
      });
      return next;
    });
  }, [location.pathname]);

  const go = (to) => {
    navigate(to);
    if (onNavigate) onNavigate();
  };

  const confirmLogout = async () => {
    setLogoutOpen(false);
    await signOut();
    navigate('/login', { replace: true });
  };

  const initials = (profile?.full_name || 'U')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const RoleIcon = isAdmin ? AdminPanelSettingsIcon : SupportAgentIcon;

  const visibleChildren = (item) =>
    item.children.filter((c) => {
      if (isAdmin) return true;
      if (c.to === '/purchases/new') return false;
      return !STAFF_BLOCKED_ROUTES.includes(c.to);
    });

  const visibleNav = NAV.filter((item) => {
    if (item.type === 'admin') return isAdmin;
    if (item.children) return visibleChildren(item).length > 0;
    if (!isAdmin && STAFF_BLOCKED_ROUTES.includes(item.to)) return false;
    return true;
  });

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minHeight: 0, bgcolor: '#fff',
    }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: '11px',
        padding: '18px 18px 14px',
        background: `linear-gradient(180deg, ${TOKENS.hlBlue} 0%, ${TOKENS.hlBlueDark} 100%)`,
        borderBottom: `5px solid ${TOKENS.hlCream}`,
        flexShrink: 0,
      }}>
        <Box sx={{
          width: 68, height: 46, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Box component="img" src={logo} alt="Home Line Enterprises Logo"
            sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        </Box>
        <Typography sx={{
          fontFamily: TOKENS.fontDisplay, fontWeight: 800, fontSize: 19, lineHeight: 1,
          letterSpacing: '0.2px', color: '#fff', textTransform: 'uppercase',
        }}>
          Home Line
          <Box component="span" sx={{
            display: 'block', fontWeight: 600, fontSize: 10, color: TOKENS.hlCream,
            letterSpacing: '2px', mt: '3px', fontFamily: TOKENS.fontBody,
            textTransform: 'uppercase', opacity: 0.85,
          }}>
            Enterprises
          </Box>
        </Typography>
      </Box>

      <Box sx={{ px: '12px', flex: 1, minHeight: 0, overflowY: 'auto', pb: 2 }}>
        {visibleNav.map((item) => {
          const Icon = item.icon;

          if (item.type === 'admin' || item.type === 'link') {
            const active = isActive(item.to);
            return (
              <Button key={item.to} fullWidth onClick={() => go(item.to)} sx={navBtnStyle(active)}>
                <Icon sx={navIconStyle(active)} />
                {item.label}
              </Button>
            );
          }

          const children = visibleChildren(item);
          const open = isGroupOpen(item);
          const groupActive = children.some((c) => isActive(c.to));
          return (
            <Box key={item.label}>
              <Button
                fullWidth
                onClick={() => toggleGroup(item.label)}
                sx={navBtnStyle(groupActive)}
                aria-expanded={open}
              >
                <Icon sx={navIconStyle(groupActive)} />
                {item.label}
                <ExpandMoreIcon sx={{
                  marginLeft: 'auto', fontSize: 16,
                  color: groupActive ? TOKENS.hlGold : TOKENS.hlGoldDark,
                  transition: 'transform .15s',
                  transform: open ? 'rotate(180deg)' : 'none',
                }} />
              </Button>
              <Collapse in={open} timeout={150}>
                <Box>
                  {children.map((c) => {
                    const active = isActive(c.to);
                    return (
                      <Button key={c.to} fullWidth onClick={() => go(c.to)} sx={{
                        display: 'flex', alignItems: 'center',
                        width: 'calc(100% - 14px)', marginLeft: '14px',
                        textAlign: 'left', background: 'transparent',
                        border: 'none',
                        borderLeft: `1.5px solid ${active ? TOKENS.hlGold : TOKENS.gray3}`,
                        borderRadius: 0,
                        padding: '7px 10px 7px 16px',
                        fontSize: 12, fontWeight: active ? 700 : 400,
                        fontFamily: TOKENS.fontBody,
                        color: active ? TOKENS.hlBlue : TOKENS.gray5,
                        textTransform: 'none', justifyContent: 'flex-start',
                        '&:hover': { color: TOKENS.hlBlue, backgroundColor: 'transparent' },
                      }}>
                        {c.label}
                      </Button>
                    );
                  })}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>

      <Box sx={{
        flexShrink: 0,
        margin: '0 20px 16px',
        paddingTop: '14px',
        borderTop: `1px solid ${TOKENS.lineSoft}`,
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <Box sx={{ position: 'relative' }}>
          <Avatar sx={{
            width: 28, height: 28,
            bgcolor: isAdmin ? TOKENS.hlGold : TOKENS.hlBlue,
            color: '#fff', fontSize: 10, fontWeight: 700
          }}>
            {initials}
          </Avatar>
          <Tooltip title={isAdmin ? 'Admin' : 'Staff'}>
            <Box sx={{
              position: 'absolute', right: -4, bottom: -4,
              width: 14, height: 14, borderRadius: '50%',
              bgcolor: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
            }}>
              <RoleIcon sx={{ fontSize: 11, color: isAdmin ? TOKENS.hlGoldDark : TOKENS.hlBlue }} />
            </Box>
          </Tooltip>
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: 11, lineHeight: 1.3, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {profile?.full_name || 'Signed in'}
          </Typography>
          <Box component="span" sx={{ display: 'block', color: TOKENS.gray5, fontWeight: 400, fontSize: 10.5, textTransform: 'capitalize' }}>
            {profile?.role || ''}
          </Box>
        </Box>
        <Tooltip title="Sign out">
          <Button
            onClick={() => setLogoutOpen(true)}
            aria-label="Sign out of account"
            startIcon={<LogoutIcon sx={{ fontSize: 18 }} />}
            sx={{
              display: { xs: 'inline-flex', md: 'none' },
              flexShrink: 0,
              minWidth: 0,
              minHeight: 44,
              px: 1.25,
              border: 'none',
              borderRadius: `${TOKENS.radius}px`,
              color: TOKENS.hlBlueDark,
              fontFamily: TOKENS.fontBody,
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'none',
              '& .MuiButton-startIcon': { mr: 0.5 },
              '&:hover': { bgcolor: TOKENS.hlBlueTint }
            }}
          >
            Sign Out
          </Button>
          <IconButton
            size="small"
            onClick={() => setLogoutOpen(true)}
            aria-label="Sign out of account"
            sx={{
              display: { xs: 'none', md: 'inline-flex' },
              width: 36,
              height: 36,
              flexShrink: 0,
              border: 'none',
              borderRadius: `${TOKENS.radius}px`,
              color: TOKENS.hlBlueDark,
              '&:hover': { bgcolor: TOKENS.hlBlueTint }
            }}
          >
            <LogoutIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* LOGOUT CONFIRMATION MODAL */}
      <Modal
        open={logoutOpen}
        title="Sign Out?"
        onClose={() => setLogoutOpen(false)}
        onConfirm={confirmLogout}
        confirmLabel="Sign Out"
        width="confirm"
      >
        <Typography sx={{ fontSize: 13, lineHeight: 1.5 }}>
          Are you sure you want to log out of your account?
        </Typography>
      </Modal>
    </Box>
  );
}

export default function Sidebar() {
  const { mobileOpen, close } = useSidebar();

  return (
    <>
      <Box
        component="nav"
        aria-label="Main Navigation"
        sx={{
          display: { xs: 'none', md: 'flex' },
          width: 'clamp(200px, 16vw, 260px)',
          flexShrink: 0,
          borderRight: `1px solid ${TOKENS.line}`,
          bgcolor: '#fff',
          height: '100%',
        }}>
        <SidebarContent />
      </Box>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={close}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: { xs: '85vw', sm: 280 },
            maxWidth: '85vw',
            boxSizing: 'border-box',
            borderRight: `1px solid ${TOKENS.line}`, background: '#fff',
            display: 'flex', flexDirection: 'column',
          },
        }}
      >
        <SidebarContent onNavigate={close} />
      </Drawer>
    </>
  );
}

const navBtnStyle = (active) => ({
  display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-start',
  width: '100%', textAlign: 'left',
  background: active ? TOKENS.hlBlue : 'transparent',
  border: 'none', borderRadius: `${TOKENS.radius}px`,
  padding: '9px 10px', fontSize: 13, fontWeight: 500,
  fontFamily: TOKENS.fontBody,
  color: active ? '#fff' : TOKENS.ink,
  textTransform: 'none', mb: '2px',
  '&:hover': { backgroundColor: active ? TOKENS.hlBlue : TOKENS.hlBlueTint },
  '&:focus-visible': { outline: `2px solid ${TOKENS.hlBlueDark}`, outlineOffset: '2px' }
});

const navIconStyle = (active) => ({
  fontSize: 18, flexShrink: 0,
  color: active ? TOKENS.hlGold : 'currentColor',
  transition: 'color .12s',
});