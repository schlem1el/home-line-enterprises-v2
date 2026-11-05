import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Box, Typography, CircularProgress, useMediaQuery, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { TOKENS } from '../styles/HomeLineStyles';

const WIDTHS = {
  confirm: 380,
  narrow: 420,
  form: 520,
  wide: 680,
  items: 720
};

const SizedDialog = styled(Dialog, {
  shouldForwardProp: (prop) => prop !== 'dialogwidth' && prop !== 'ismobile' && prop !== 'isresponsive'
})(({ dialogwidth, ismobile, isresponsive }) => ({
  '& .MuiDialog-paper': {
    width: isresponsive
      ? `min(${dialogwidth}px, calc(100vw - ${ismobile ? 24 : 48}px)) !important`
      : `${dialogwidth}px !important`,
    minWidth: '0 !important',
    maxWidth: isresponsive
      ? `calc(100vw - ${ismobile ? 24 : 48}px) !important`
      : 'calc(100vw - 64px) !important',
    maxHeight: 'calc(100dvh - 24px)',
    margin: ismobile ? '12px' : isresponsive ? '24px' : '32px',
    boxSizing: 'border-box',
    borderRadius: `${TOKENS.radius}px`,
    border: `1.5px solid ${TOKENS.hlBlue}`,
    boxShadow: '0 6px 24px rgba(13,50,38,.25)',
  }
}));

export default function Modal({
  open, title, children, onClose, onConfirm,
  confirmLabel = 'Save', width = 'confirm', hideConfirm = false,
  footer, confirmationMessage, confirmationTitle = 'Confirm changes',
  confirmationLabel = 'Confirm', footerButtonSx
}) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isResponsive = useMediaQuery(theme.breakpoints.down('md'));
  const px = WIDTHS[width] || WIDTHS.confirm;
  const handleConfirm = async () => {
    if (processing) return;
    if (confirmationMessage) {
      setConfirmationOpen(true);
      return;
    }
    setProcessing(true);
    try {
      await onConfirm?.();
    } finally {
      setProcessing(false);
    }
  };
  const handleClose = (...args) => {
    if (processing) return;
    setConfirmationOpen(false);
    onClose?.(...args);
  };

  return (
    <>
      <SizedDialog
        open={open}
        onClose={handleClose}
        aria-busy={processing}
        maxWidth={false}
        fullWidth={false}
        dialogwidth={px}
        ismobile={isMobile ? 1 : 0}
        isresponsive={isResponsive ? 1 : 0}
      >
      <DialogTitle sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1,
        fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: { xs: 14, sm: 16 },
        textTransform: 'uppercase', color: TOKENS.hlBlueDark,
        borderTop: `3px solid ${TOKENS.hlGold}`, borderBottom: `1px solid ${TOKENS.lineSoft}`,
        p: { xs: '12px 14px', sm: '14px 18px' },
        '& > .MuiBox-root': { minWidth: 0, overflowWrap: 'anywhere' }
      }}>
        <Box>{title}</Box>
        <IconButton size="small" onClick={handleClose} disabled={processing} aria-label="Close" sx={{
          width: 24, height: 24, border: `1px solid ${TOKENS.lineSoft}`,
          borderRadius: '4px', fontSize: 11, color: TOKENS.ink,
          '&:hover': { backgroundColor: TOKENS.gray1 }
        }}>
          <CloseIcon sx={{ fontSize: 12 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{
        p: { xs: '14px 14px 4px', sm: '16px 18px 4px' },
        maxHeight: { xs: 'calc(100dvh - 150px)', sm: 'calc(100dvh - 190px)' },
        overflowY: 'auto',
        overflowX: 'auto',
        '& > *': { minWidth: 0, maxWidth: '100%' }
      }}>
        {children}
      </DialogContent>

      <DialogActions sx={{
        p: { xs: '10px 14px', sm: '14px 18px' },
        borderTop: `1px solid ${TOKENS.lineSoft}`,
        flexWrap: 'wrap',
        gap: 1,
        pointerEvents: processing ? 'none' : 'auto',
        justifyContent: isMobile && width === 'confirm' ? 'flex-end' : undefined,
        '& .MuiButton-root': {
          ...(footerButtonSx || {}),
          minWidth: 0,
          maxWidth: '100%',
          '@media (max-width:599.95px)': {
            width: '100%',
            flex: '1 1 100%'
          }
        }
      }}>
        {footer !== undefined ? footer : (
          <>
            <Button variant="outlined" onClick={handleClose} disabled={processing} sx={{
              width: isMobile && width !== 'confirm' ? '100%' : 'auto',
              order: { xs: 2, sm: 1 },
            }}>
              Cancel
            </Button>
            {!hideConfirm && (
              <Button variant="contained" onClick={handleConfirm} sx={{
                width: isMobile && width !== 'confirm' ? '100%' : 'auto',
                order: { xs: 1, sm: 2 },
              }}>
                {processing && <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />}
                {processing ? 'Processing…' : confirmLabel}
              </Button>
            )}
          </>
        )}
      </DialogActions>
      </SizedDialog>
      <Dialog
        open={confirmationOpen}
        onClose={() => { if (!processing) setConfirmationOpen(false); }}
        aria-busy={processing}
        maxWidth="xs"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            width: `min(380px, calc(100vw - ${isMobile ? 24 : 48}px)) !important`,
            minWidth: '0 !important',
            maxWidth: `calc(100vw - ${isMobile ? 24 : 48}px) !important`,
            maxHeight: 'calc(100dvh - 24px)',
            margin: isMobile ? '12px' : isResponsive ? '24px' : '32px',
            boxSizing: 'border-box',
            borderRadius: `${TOKENS.radius}px`,
            border: `1.5px solid ${TOKENS.hlBlue}`,
            boxShadow: '0 12px 36px rgba(13,50,38,.24)',
          },
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          fontFamily: TOKENS.fontDisplay,
          fontSize: 17,
          fontWeight: 700,
          color: TOKENS.hlBlueDark,
          textTransform: 'uppercase',
          borderTop: `3px solid ${TOKENS.hlGold}`,
          borderBottom: `1px solid ${TOKENS.lineSoft}`,
          px: { xs: 2, sm: 2.5 },
          py: 1.5,
          overflowWrap: 'anywhere',
          '& > .MuiBox-root': { minWidth: 0, overflowWrap: 'anywhere' },
        }}>
          <Box>{confirmationTitle}</Box>
          <IconButton size="small" onClick={() => { if (!processing) setConfirmationOpen(false); }} disabled={processing} aria-label="Close">
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{
          px: { xs: 2, sm: 2.5 },
          py: 2,
          maxHeight: { xs: 'calc(100dvh - 150px)', sm: 'calc(100dvh - 190px)' },
          overflowY: 'auto',
          overflowX: 'auto'
        }}>
          <Typography sx={{ fontSize: 13, lineHeight: 1.5 }}>
            {confirmationMessage}
          </Typography>
        </DialogContent>
        <DialogActions sx={{
          p: { xs: '10px 14px', sm: '14px 20px' },
          borderTop: `1px solid ${TOKENS.lineSoft}`,
          gap: 1,
          flexWrap: 'wrap',
          pointerEvents: processing ? 'none' : 'auto',
          '& .MuiButton-root': {
            minWidth: 0,
            '@media (max-width:599.95px)': {
              width: '100%',
              flex: '1 1 100%'
            }
          }
        }}>
          <Button onClick={() => setConfirmationOpen(false)} disabled={processing} sx={{ minWidth: 0, px: 1.5 }}>Go back</Button>
          <Button
            variant="contained"
            sx={{ minWidth: 0, px: 1.75 }}
            onClick={async () => {
              if (processing) return;
              setProcessing(true);
              try {
                await onConfirm?.();
              } finally {
                setConfirmationOpen(false);
                setProcessing(false);
              }
            }}
          >
            {processing && <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />}
            {processing ? 'Processing…' : confirmationLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}