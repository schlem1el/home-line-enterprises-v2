import React from 'react';
import { Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ScheduleIcon from '@mui/icons-material/Schedule';
import BlockIcon from '@mui/icons-material/Block';

const COLOR_MAP = {
  Active: 'warning', Pending: 'warning', Completed: 'success', Cancelled: 'default',
  Unpaid: 'default', 'Partially Paid': 'warning', 'Fully Paid': 'success',
  'Not Delivered': 'default', 'Partially Delivered': 'warning', 'Fully Delivered': 'success',
  'Not Applicable': 'default', 'Not Received': 'default',
  'Partially Received': 'warning', Received: 'success',
  Paid: 'success', Delivered: 'success', 'Picked Up': 'success',
  'Low Stock': 'warning', 'Out of Stock': 'default'
};

// ACCESSIBILITY: Add icons to distinct statuses so color is not the only indicator
const getIcon = (status) => {
  switch (status) {
    case 'Active':
      return <ScheduleIcon style={{ fontSize: 14 }} />;
    case 'Completed':
    case 'Fully Paid':
    case 'Received':
    case 'Delivered':
    case 'Picked Up':
    case 'Paid':
      return <CheckCircleIcon style={{ fontSize: 14 }} />;
    case 'Partially Paid':
    case 'Partially Delivered':
    case 'Partially Received':
    case 'Pending':
    case 'Low Stock':
      return <WarningIcon style={{ fontSize: 14 }} />;
    case 'Cancelled':
    case 'Out of Stock':
      return <BlockIcon style={{ fontSize: 14 }} />;
    case 'Unpaid':
    case 'Not Delivered':
    case 'Not Received':
      return <ScheduleIcon style={{ fontSize: 14 }} />;
    default:
      return null;
  }
};

export default function StatusBadge({ status }) {
  const icon = getIcon(status);
  return (
    <Chip
      label={status}
      color={COLOR_MAP[status] || 'default'}
      size="small"
      icon={icon}
      sx={{ '& .MuiChip-icon': { color: 'inherit' } }}
    />
  );
}