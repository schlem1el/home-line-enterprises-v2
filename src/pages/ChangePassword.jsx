// src/pages/ChangePassword.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, TextField, Button, Typography, Alert, InputAdornment, IconButton } from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import Topbar from '../components/Topbar';
import { useAuth } from '../context/AuthContext';
import { useAudit } from '../utils/useAudit';
import {
  auth,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  db,
} from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { authError } from '../utils/authErrors';
import { TOKENS } from '../styles/HomeLineStyles';

export default function ChangePassword() {
  const { user, profile, updateLocalProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const log = useAudit();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);

  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErr('');

    if (!current) { setErr('Enter your current (temporary) password.'); return; }
    if (!next) { setErr('Enter a new password.'); return; }
    if (next.length < 6) { setErr('New password must be at least 6 characters.'); return; }
    if (next === current) { setErr('New password can’t be the same as the current one.'); return; }
    if (next !== confirm) { setErr('The two new passwords don’t match.'); return; }

    setBusy(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, current);
      await reauthenticateWithCredential(user, cred);

      await updatePassword(user, next);

      await updateDoc(doc(db, 'users', user.uid), {
        must_change_password: false,
      });

      updateLocalProfile({ must_change_password: false });

      await log('CHANGE_PASSWORD', 'User', user.email, {
        summary: 'Changed account password',
        email: user.email,
      });

      navigate('/dashboard', { replace: true });
    } catch (ex) {
      setErr(authError(ex));
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <Topbar title="Change Password" />
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        p: 'clamp(18px, 2.5vw, 30px) clamp(18px, 3vw, 40px) 40px',
      }}>
        <Box sx={{
          width: 520,
          maxWidth: '100%',
          border: `1px solid ${TOKENS.lineSoft}`,
          borderRadius: `${TOKENS.radius}px`,
          bgcolor: '#fff',
          p: 3,
        }}>
          <Typography sx={{
            fontFamily: TOKENS.fontDisplay, fontSize: 20, fontWeight: 700,
            color: TOKENS.hlBlueDark, textTransform: 'uppercase', letterSpacing: 0.4, mb: 1,
          }}>
            Set a New Password
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: TOKENS.gray5, mb: 2.5, lineHeight: 1.5 }}>
            Hi {profile?.full_name || 'there'} — your account is using a temporary
            password. Choose a new one before continuing.
          </Typography>

          {err && <Alert severity="error" sx={{ mb: 2, fontSize: 12 }}>{err}</Alert>}

          <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOKENS.hlBlueDark, textTransform: 'uppercase', letterSpacing: 0.4, mb: 0.75 }}>
                Current (Temporary) Password
              </Typography>
              <TextField
                type={showCur ? 'text' : 'password'}
                fullWidth size="small"
                autoFocus
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowCur((v) => !v)} edge="end" aria-label={showCur ? 'Hide current password' : 'Show current password'}>
                        {showCur ? <VisibilityOffOutlinedIcon sx={{ fontSize: 18 }} /> : <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOKENS.hlBlueDark, textTransform: 'uppercase', letterSpacing: 0.4, mb: 0.75 }}>
                New Password
              </Typography>
              <TextField
                type={showNew ? 'text' : 'password'}
                fullWidth size="small"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                helperText="At least 6 characters."
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowNew((v) => !v)} edge="end" aria-label={showNew ? 'Hide new password' : 'Show new password'}>
                        {showNew ? <VisibilityOffOutlinedIcon sx={{ fontSize: 18 }} /> : <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOKENS.hlBlueDark, textTransform: 'uppercase', letterSpacing: 0.4, mb: 0.75 }}>
                Confirm New Password
              </Typography>
              <TextField
                type={showConf ? 'text' : 'password'}
                fullWidth size="small"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowConf((v) => !v)} edge="end" aria-label={showConf ? 'Hide password confirmation' : 'Show password confirmation'}>
                        {showConf ? <VisibilityOffOutlinedIcon sx={{ fontSize: 18 }} /> : <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1.5 }}>
              <Button variant="outlined" onClick={onSignOut} disabled={busy}>
                Sign Out
              </Button>
              <Button type="submit" variant="contained" disabled={busy}>
                {busy ? 'Saving…' : 'Change Password'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
}