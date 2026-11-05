import React from 'react';
import { Chip } from '@mui/material';
import StatusText from './StatusText';
import { operationalStatusForDisplay } from '../utils/businessRules';

const COLOR_MAP = {
  Pending: 'warning',
  Checked: 'info',
  Overdue: 'error',
  'Due Today': 'warning',
  'Due Soon': 'info',
  Delivered: 'success',
  'Picked Up': 'success',
  Received: 'success',
  Cancelled: 'default'
};

export default function OperationalStatus({ status, scheduledDate, variant = 'chip' }) {
  const actualStatus = status || 'Pending';
  const displayStatus = operationalStatusForDisplay(actualStatus, scheduledDate);

  if (variant === 'text') {
    return <StatusText status={displayStatus} />;
  }

  return <Chip label={displayStatus} color={COLOR_MAP[displayStatus] || 'default'} size="small" />;
}
