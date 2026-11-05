import React from 'react';
import { Box } from '@mui/material';
import { PAYMENT_CONFIRMATION_PENDING_LABEL } from '../utils/businessRules';

const COLOR_MAP = {
  Active: 'warning',
  'Partially Paid': 'warning',
  Pending: 'warning',
  [PAYMENT_CONFIRMATION_PENDING_LABEL]: 'warning',
  Checked: 'info',
  Completed: 'success',
  'Fully Paid': 'success',
  Received: 'success',
  Delivered: 'success',
  'Picked Up': 'success',
  Paid: 'success',
  Cancelled: 'neutral',
  Unpaid: 'neutral',
  Overdue: 'error',
  'Due Today': 'warning',
  'Due Soon': 'info'
};

export default function StatusText({ status }) {
  return (
    <Box
      component="span"
      sx={(theme) => {
        const paletteColor = COLOR_MAP[status] || 'neutral';
        const color = paletteColor === 'neutral'
          ? theme.palette.text.secondary
          : theme.palette[paletteColor].main;
        return {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px solid ${color}`,
          borderRadius: 10,
          px: 0.9,
          py: 0.2,
          color,
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1.4,
          whiteSpace: 'nowrap'
        };
      }}
    >
      {status || '—'}
    </Box>
  );
}
