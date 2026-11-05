import React from 'react';
import { TextField } from '@mui/material';

export default function DateField({
  label, value, onChange, min, max,
  fullWidth = false,
  sx = {}
}) {
  return (
    <TextField
      size="small"
      type="date"
      label={label}
      value={value}
      onChange={onChange}
      inputProps={{ min, max }}
      fullWidth={fullWidth}
      InputLabelProps={{ shrink: true }}
      sx={{
        width: { xs: '100%', sm: 'auto' },
        // Shrunk minWidth so it compresses properly on tablets
        minWidth: { xs: '100%', sm: 120 },
        ...sx
      }}
    />
  );
}