import React from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, useMediaQuery, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { TOKENS } from '../styles/HomeLineStyles';

export default function DetailModal({ open, title, actions, children, onClose }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isResponsive = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false}
      PaperProps={{
        sx: {
          width: isMobile
            ? 'calc(100vw - 24px)'
            : isResponsive
              ? 'min(640px, calc(100vw - 48px))'
              : 640,
          minWidth: 0,
          maxWidth: isMobile ? 'calc(100vw - 24px)' : 'calc(100vw - 48px)',
          maxHeight: 'calc(100dvh - 24px)',
          border: `1.5px solid ${TOKENS.hlBlue}`, borderRadius: `${TOKENS.radius}px`,
          boxShadow: '0 6px 24px rgba(13,50,38,.25)',
          m: isMobile ? '12px' : isResponsive ? '24px' : '32px',
          boxSizing: 'border-box'
        }
      }}>
      <DialogTitle sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 1,
        fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: { xs: 14, sm: 16 },
        textTransform: 'uppercase', color: TOKENS.hlBlueDark,
        borderTop: `3px solid ${TOKENS.hlGold}`, borderBottom: `1px solid ${TOKENS.lineSoft}`,
        p: { xs: '12px 14px', sm: '14px 18px' },
        overflowWrap: 'anywhere',
        '& > *': { minWidth: 0 }
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          minWidth: 0,
          flex: 1
        }}>
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{title}</span>
          {actions}
        </div>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{
        p: { xs: '14px', sm: '16px 18px' },
        maxHeight: { xs: 'calc(100dvh - 150px)', sm: 'calc(100dvh - 190px)' },
        overflowY: 'auto',
        overflowX: 'auto',
        '& > *': { minWidth: 0, maxWidth: '100%' }
      }}>
        {children}
      </DialogContent>
    </Dialog>
  );
}