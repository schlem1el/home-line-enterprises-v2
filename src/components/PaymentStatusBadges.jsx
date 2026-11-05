import React from 'react';
import { Box, Chip } from '@mui/material';
import { TOKENS } from '../styles/HomeLineStyles';
import { PAYMENT_CONFIRMATION_PENDING_LABEL } from '../utils/businessRules';

const COLOR_MAP = {
  Unpaid: 'default',
  'Partially Paid': 'warning',
  'Fully Paid': 'success',
};

export default function PaymentStatusBadges({
  status, overdue = false, dueStatus = '', pendingConfirmation = false
}) {
  const displayDueStatus = dueStatus || (overdue ? 'Overdue' : '');
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
      <Chip label={status || '—'} color={COLOR_MAP[status] || 'default'} size="small" />
      {pendingConfirmation && <Chip label={PAYMENT_CONFIRMATION_PENDING_LABEL} color="warning" size="small" />}
      {displayDueStatus && <Chip label={displayDueStatus} size="small" sx={{
        bgcolor: displayDueStatus === 'Overdue' ? TOKENS.hlError : displayDueStatus === 'Due Today' ? '#ed6c02' : '#0288d1',
        color: '#fff'
      }} />}
    </Box>
  );
}