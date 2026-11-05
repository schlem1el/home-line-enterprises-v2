import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { TOKENS } from '../styles/HomeLineStyles';

export default function Pagination({ page, totalPages, onPrev, onNext, info }) {
  const changePage = (handler) => {
    handler();
    const main = document.querySelector('main');
    if (main) {
      main.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: { xs: 'column', sm: 'row' },
      justifyContent: 'space-between',
      alignItems: { xs: 'flex-start', sm: 'center' },
      gap: 2,
      mt: 1.5
    }}>
      <Typography sx={{ fontSize: 12, color: TOKENS.gray5 }}>{info}</Typography>
      {totalPages > 1 && (
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'row', sm: 'row' },
          width: { xs: '100%', sm: 'auto' },
          alignItems: 'center',
          justifyContent: { xs: 'space-between', sm: 'flex-end' },
          gap: 1.5
        }}>
          <Button size="small" variant="outlined" disabled={page === 1} onClick={() => changePage(onPrev)} sx={{ flex: { xs: 1, sm: 'none' } }}>
            Previous
          </Button>
          <Typography sx={{ fontSize: 12, color: TOKENS.gray5, whiteSpace: 'nowrap' }}>
            Page {page} of {totalPages}
          </Typography>
          <Button size="small" variant="outlined" disabled={page === totalPages} onClick={() => changePage(onNext)} sx={{ flex: { xs: 1, sm: 'none' } }}>
            Next
          </Button>
        </Box>
      )}
    </Box>
  );
}