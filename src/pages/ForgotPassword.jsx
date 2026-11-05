import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, TextField, Button, Typography, Alert } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../context/AuthContext';
import { authError } from '../utils/authErrors';
import { isValidEmailAddress } from '../utils/validation';
import { TOKENS } from '../styles/HomeLineStyles';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErr('');

    const trimmed = email.trim();
    if (!trimmed) { setErr('Enter your email address.'); return; }
    if (!isValidEmailAddress(trimmed)) { setErr('That email address doesn’t look right.'); return; }

    setBusy(true);
    try {
      await resetPassword(trimmed);
      setSent(true);
    } catch (ex) {
      setErr(authError(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: 3,
      background: `linear-gradient(180deg, ${TOKENS.hlBlue} 0%, ${TOKENS.hlBlueDark} 100%)`,
    }}>
      <Box sx={{
        width: 420,
        maxWidth: '100%',
        bgcolor: '#fff',
        borderRadius: `${TOKENS.radius}px`,
        borderTop: `5px solid ${TOKENS.hlCream}`,
        boxShadow: '0 12px 40px rgba(0,0,0,.35)',
        p: 3,
      }}>
        {/* ACCESSIBILITY: Semantic h1 */}
        <Typography component="h1" sx={{
          fontFamily: TOKENS.fontDisplay, fontSize: 22, fontWeight: 700,
          color: TOKENS.hlBlueDark, textTransform: 'uppercase', letterSpacing: 0.4, mb: 1,
        }}>
          Forgot Password
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: TOKENS.gray5, mb: 2.5, lineHeight: 1.5 }}>
          Enter the email on your account. We’ll send you a link to reset your password.
        </Typography>

        {/* ACCESSIBILITY: Alert roles */}
        {err && <Alert severity="error" role="alert" sx={{ mb: 2, fontSize: 12 }}>{err}</Alert>}
        {sent && (
          <Alert severity="success" role="status" sx={{ mb: 2, fontSize: 12 }}>
            If that email is registered, a reset link has been sent. Check your inbox and spam folder.
          </Alert>
        )}

        {!sent && (
          <Box component="form" onSubmit={submit}>
            <Typography component="label" htmlFor="reset-email" sx={{ fontSize: 11, fontWeight: 700, color: TOKENS.hlBlueDark, textTransform: 'uppercase', letterSpacing: 0.4, mb: 0.75, display: 'block' }}>
              Email
            </Typography>
            <TextField
              id="reset-email"
              type="email"
              size="small"
              fullWidth
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 2.5 }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={busy}
              sx={{ py: 1.25, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}
            >
              {busy ? 'Sending…' : 'Send Reset Link'}
            </Button>
          </Box>
        )}

        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Typography
            component={RouterLink}
            to="/login"
            sx={{
              fontSize: 12, color: TOKENS.hlBlue, fontWeight: 600, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 0.5,
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 14 }} /> Back to sign in
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}