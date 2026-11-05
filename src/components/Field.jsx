import React, { cloneElement, useId } from 'react';
import { Box, Typography } from '@mui/material';
import { TOKENS } from '../styles/HomeLineStyles';

export default function Field({
  label, children, sx = {}, flex = 1, error, helperText, labelColor = TOKENS.gray5
}) {
  const labelId = useId();
  const messageId = `${labelId}-message`;
  const hasMessage = Boolean(error || helperText);
  const labelledChildren = React.isValidElement(children) && label
    ? cloneElement(children, {
      'aria-labelledby': labelId,
      ...(hasMessage ? { 'aria-describedby': messageId } : {}),
      ...(error ? { 'aria-invalid': true } : {}),
      ...(error ? {
        error: true,
        sx: [
          children.props.sx,
          {
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: TOKENS.hlError },
              '&:hover fieldset': { borderColor: TOKENS.hlError },
              '&.Mui-focused fieldset': {
                borderColor: TOKENS.hlError,
                boxShadow: `0 0 0 3px ${TOKENS.hlError}33`,
              },
            },
          },
        ],
      } : {}),
    })
    : children;

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      gap: 0.5,
      flex,
      minWidth: 0,
      width: '100%',
      ...sx
    }}>
      {label && (
        <Typography id={labelId} component="label" sx={{
          fontSize: 11,
          color: labelColor,
          lineHeight: 1.4
        }}>
          {label}
        </Typography>
      )}
      {labelledChildren}
      {/* ACCESSIBILITY: Explicit inline error message for screen readers and low-vision users */}
      {(error || helperText) && (
        <Typography
          id={messageId}
          role={error ? "alert" : undefined}
          sx={{
            fontSize: 10.5,
            color: error ? TOKENS.hlError : TOKENS.gray5,
            lineHeight: 1.3,
            mt: 0.5
          }}
        >
          {error || helperText}
        </Typography>
      )}
    </Box>
  );
}