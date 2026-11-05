import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { TOKENS } from '../styles/HomeLineStyles';

export default function Toast({ message, onClose, duration = 2300 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) { setVisible(false); return; }
    setVisible(true);
    const t1 = setTimeout(() => setVisible(false), duration - 250);
    const t2 = setTimeout(onClose, duration);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <Box
      // ACCESSIBILITY: Alert role for screen readers
      role="alert"
      aria-live="assertive"
      sx={{
        position: 'fixed',
        top: { xs: 16, sm: 24 },
        left: '50%',
        width: 'max-content',
        maxWidth: 'calc(100vw - 32px)',
        backgroundColor: TOKENS.hlBlueDark, color: '#fff',
        border: `1px solid ${TOKENS.hlBlueDark}`,
        borderLeft: `4px solid ${TOKENS.hlGold}`,
        borderRadius: `${TOKENS.radius}px`,
        padding: '11px 18px', fontSize: 12, fontWeight: 600, letterSpacing: 0.2,
        boxShadow: '0 0 0 1px #fff, 0 2px 10px rgba(0,0,0,.25)',
        zIndex: 1500, opacity: visible ? 1 : 0,
        transform: visible ? 'translate(-50%, 0)' : 'translate(-50%, -8px)',
        transition: 'opacity .25s ease, transform .25s ease'
      }}
    >
      {message}
    </Box>
  );
}