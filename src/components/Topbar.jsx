import React from 'react';
import { Box, Typography, Avatar, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { TOKENS } from '../styles/HomeLineStyles';
import { useSidebar } from '../context/SidebarContext';
import { useAuth } from '../context/AuthContext';

export default function Topbar({ title }) {
  const { open: openSidebar } = useSidebar();
  const { profile } = useAuth();

  const isAdmin = profile?.role === 'admin';
  const initials = (profile?.full_name || 'U')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const RoleIcon = isAdmin ? AdminPanelSettingsIcon : SupportAgentIcon;

  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1, sm: 1.5 },
        padding: { xs: '12px 16px', md: '18px 30px' },
        background: {
          xs: `linear-gradient(180deg, ${TOKENS.hlBlue} 0%, ${TOKENS.hlBlueDark} 100%)`,
          md: '#fff'
        },
        borderBottom: {
          xs: `4px solid ${TOKENS.hlCream}`,
          md: `1px solid ${TOKENS.lineSoft}`
        },
        borderTop: { xs: 'none', md: `3px solid ${TOKENS.hlGold}` },
        position: 'sticky',
        top: 0,
        zIndex: 20
      }}
    >
      <IconButton
        onClick={openSidebar}
        aria-label="Open navigation menu"
        sx={{
          display: { xs: 'inline-flex', md: 'none' },
          width: 38, height: 38,
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.35)',
          borderRadius: `${TOKENS.radius}px`,
          flexShrink: 0,
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderColor: 'rgba(255,255,255,0.6)'
          }
        }}
      >
        <MenuIcon fontSize="small" />
      </IconButton>

      <Typography
        component="h1"
        sx={{
          flex: 1,
          minWidth: 0,
          textAlign: { xs: 'center', md: 'left' },
          fontFamily: TOKENS.fontDisplay,
          fontWeight: 700,
          fontSize: { xs: 16, sm: 18, md: 24 },
          letterSpacing: '0.2px',
          color: { xs: '#fff', md: TOKENS.hlBlueDark },
          textTransform: 'uppercase',
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          margin: 0
        }}
      >
        {title}
      </Typography>

      <Box sx={{ display: 'flex', gap: { xs: 1, sm: 1.5 }, alignItems: 'center', flexShrink: 0 }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          pl: { xs: 0, md: 1 },
          pr: { xs: 0, md: 1 },
        }}>
          <RoleIcon
            sx={{
              display: { xs: 'none', sm: 'block' },
              fontSize: 20,
              color: { xs: '#fff', md: isAdmin ? TOKENS.hlGold : TOKENS.hlBlue },
            }}
          />
          <Avatar sx={{
            width: { xs: 32, sm: 34 },
            height: { xs: 32, sm: 34 },
            bgcolor: { xs: TOKENS.hlGold, md: isAdmin ? TOKENS.hlGold : TOKENS.hlBlue },
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            border: { xs: '2px solid rgba(255,255,255,0.85)', md: 'none' },
            boxSizing: 'border-box'
          }}>
            {initials}
          </Avatar>
        </Box>
      </Box>
    </Box>
  );
}