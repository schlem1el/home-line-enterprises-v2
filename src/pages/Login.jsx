import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, Alert,
  InputAdornment, IconButton, Divider,
} from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAuth } from '../context/AuthContext';
import { authError } from '../utils/authErrors';
import { isValidEmailAddress } from '../utils/validation';
import { writeAudit } from '../utils/auditHelpers';
import loginStyle from '../styles/LoginStyles';
import logo from '../images/home-line-logo.png';
import { TOKENS } from '../styles/HomeLineStyles';

import {
  auth,
  db,
  GoogleAuthProvider,
  signInWithPopup,
} from '../firebaseConfig';
import {
  doc, getDoc, setDoc, deleteDoc,
  collection, query, where, getDocs, serverTimestamp,
} from 'firebase/firestore';

const GoogleIcon = (props) => (
  <svg viewBox="0 0 48 48" {...props} aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C41 35.6 44 30.3 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErr('');

    const trimmed = email.trim();
    if (!trimmed) { setErr('Enter your email address.'); return; }
    if (!isValidEmailAddress(trimmed)) { setErr("That email address doesn't look right."); return; }
    if (!password) { setErr('Enter your password.'); return; }

    setBusy(true);
    try {
      await signIn(trimmed, password);

      try {
        await writeAudit({
          user: auth.currentUser,
          actionType: 'LOGIN',
          recordType: 'Session',
          recordId: auth.currentUser?.email || trimmed,
          details: { summary: 'Signed in via email' },
        });
      } catch { /* non-fatal */ }

      navigate('/dashboard', { replace: true });
    } catch (ex) {
      setErr(authError(ex));
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    if (busy) return;
    setErr('');
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const cred = await signInWithPopup(auth, provider);
      const uid = cred.user.uid;
      const lowerEmail = (cred.user.email || '').toLowerCase();

      const byUidRef = doc(db, 'users', uid);
      let snap = await getDoc(byUidRef);

      if (!snap.exists()) {
        const q = query(collection(db, 'users'), where('email', '==', lowerEmail));
        const qs = await getDocs(q);

        if (qs.empty) {
          await auth.signOut();
          setErr('Your Google account is not registered. Contact an administrator.');
          return;
        }

        const oldDocRef = qs.docs[0].ref;
        const oldData = qs.docs[0].data();
        await setDoc(byUidRef, {
          ...oldData,
          uid,
          email: lowerEmail,
          last_login: serverTimestamp(),
          linked_google_at: serverTimestamp(),
        });
        await deleteDoc(oldDocRef);
        snap = await getDoc(byUidRef);
      }

      const data = snap.data();
      if (data.status === 'inactive' || data.status === 'deleted') {
        await auth.signOut();
        setErr('Your account has been deactivated. Contact an administrator.');
        return;
      }

      try {
        await setDoc(byUidRef, { last_login: serverTimestamp() }, { merge: true });
      } catch { /* non-fatal */ }

      try {
        await writeAudit({
          user: auth.currentUser,
          actionType: 'LOGIN',
          recordType: 'Session',
          recordId: auth.currentUser?.email || lowerEmail,
          details: { summary: 'Signed in via Google' },
        });
      } catch { /* non-fatal */ }

      navigate('/dashboard', { replace: true });
    } catch (ex) {
      if (ex?.code !== 'auth/popup-closed-by-user') {
        setErr(authError(ex));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={loginStyle.page}>
      <Box sx={loginStyle.card}>

        {/* MOBILE & TABLET HEADER */}
        <Box sx={loginStyle.mobileHeader}>
          <Box sx={loginStyle.mobileBrandMark}>
            <Box component="img" src={logo} alt="Home Line Enterprises Logo" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </Box>
          <Typography sx={loginStyle.mobileBrandName}>Home Line</Typography>
          <Typography sx={loginStyle.mobileBrandSub}>Enterprises</Typography>
        </Box>

        {/* DESKTOP BRAND PANEL */}
        <Box sx={loginStyle.brandPanel}>
          <Box sx={loginStyle.brandTopRow}>
            <Box sx={loginStyle.brandMark}>
              <Box component="img" src={logo} alt="Home Line Enterprises Logo"
                sx={loginStyle.brandMarkImg} />
            </Box>
            <Box>
              <Typography sx={loginStyle.brandName}>Home Line</Typography>
              <Typography sx={loginStyle.brandSub}>Enterprises</Typography>
            </Box>
          </Box>

          <Box sx={loginStyle.heroBlock}>
            <Typography sx={loginStyle.heroTitle}>
              Sales &amp; Inventory,<br />All in One Place.
            </Typography>
            <Typography sx={loginStyle.heroText}>
              Manage your products, track deliveries, and record payments —
              built for Home Line Enterprises.
            </Typography>

            <Box sx={loginStyle.heroDots} aria-hidden="true">
              <Box sx={loginStyle.heroDotActive} />
              <Box sx={loginStyle.heroDot} />
              <Box sx={loginStyle.heroDot} />
            </Box>
          </Box>
        </Box>

        {/* ACCESSIBILITY: Semantic form */}
        <Box component="form" onSubmit={submit} sx={loginStyle.formPanel}>
          <Typography component="h1" sx={loginStyle.formTitle}>Sign In</Typography>
          <Typography sx={loginStyle.formIntro}>
            Use your Home Line Enterprises account to continue.
          </Typography>

          {err && <Alert severity="error" role="alert" sx={{ mb: 3, borderRadius: '10px' }}>{err}</Alert>}

          <Typography component="label" htmlFor="login-email" sx={loginStyle.fieldLabel}>Email</Typography>
          <TextField
            id="login-email"
            type="email"
            size="small"
            fullWidth
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            placeholder="you@example.com"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <AlternateEmailIcon sx={loginStyle.fieldIcon} aria-hidden="true" />
                </InputAdornment>
              ),
            }}
            sx={{ ...loginStyle.fieldInput, mb: 2.5 }}
          />

          <Typography component="label" htmlFor="login-password" sx={loginStyle.fieldLabel}>Password</Typography>
          <TextField
            id="login-password"
            type={showPw ? 'text' : 'password'}
            size="small"
            fullWidth
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            placeholder="••••••••"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlinedIcon sx={loginStyle.fieldIcon} aria-hidden="true" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    edge="end"
                  >
                    {showPw
                      ? <VisibilityOffOutlinedIcon sx={{ fontSize: 20, color: TOKENS.gray5 }} />
                      : <VisibilityOutlinedIcon sx={{ fontSize: 20, color: TOKENS.gray5 }} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={loginStyle.fieldInput}
          />

          <Box sx={loginStyle.forgotRow}>
            <Typography
              component={RouterLink}
              to="/forgot-password"
              sx={loginStyle.forgotLink}
            >
              Forgot password?
            </Typography>
          </Box>

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={busy}
            sx={loginStyle.submitBtn}
          >
            {busy ? 'Signing in...' : 'Sign In'}
          </Button>

          <Box sx={loginStyle.orRow}>
            <Divider sx={{ flex: 1, borderColor: TOKENS.lineSoft }} aria-hidden="true" />
            <Typography sx={loginStyle.orLabel}>Or continue with</Typography>
            <Divider sx={{ flex: 1, borderColor: TOKENS.lineSoft }} aria-hidden="true" />
          </Box>

          <Box sx={loginStyle.oauthRow}>
            <Box
              component="button"
              type="button"
              onClick={onGoogle}
              disabled={busy}
              sx={loginStyle.oauthBtn}
              aria-label="Continue with Google"
            >
              <GoogleIcon style={loginStyle.oauthIcon} />
              Continue with Google
            </Box>
          </Box>

          <Typography sx={loginStyle.footNote}>
            Contact an administrator if you don't have an account.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}