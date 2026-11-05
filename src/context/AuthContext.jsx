// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
} from '../firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { writeAudit } from '../utils/auditHelpers';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setLoading(true);
      if (!fbUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      setUser(fbUser);
      try {
        const ref = doc(db, 'users', fbUser.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setProfile({ _id: snap.id, ...snap.data() });
        } else {
          setProfile(null);
          await fbSignOut(auth);
          setUser(null);
        }
      } catch (err) {
        console.error('Load profile failed:', err);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const signIn = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, 'users', cred.user.uid));
    if (!snap.exists()) {
      await fbSignOut(auth);
      const e = new Error('Your account is not set up. Contact an administrator.');
      e.code = 'auth/user-not-found';
      throw e;
    }
    const data = snap.data();
    if (data.status === 'inactive' || data.status === 'deleted') {
      await fbSignOut(auth);
      const e = new Error('Your account has been deactivated. Contact an administrator.');
      e.code = 'auth/user-disabled';
      throw e;
    }
    setProfile({ _id: snap.id, ...data });
    try {
      await setDoc(doc(db, 'users', cred.user.uid), { last_login: serverTimestamp() }, { merge: true });
    } catch { /* non-fatal */ }
    return cred;
  };

  const signOut = async () => {
    if (user) {
      await writeAudit({
        user,
        actionType: 'LOGOUT',
        recordType: 'Session',
        recordId: user.uid,
        details: { summary: 'Signed out of account' },
      });
    }
    return fbSignOut(auth);
  };
  const resetPassword = (email) => sendPasswordResetEmail(auth, email);

  const updateLocalProfile = (patch) => {
    setProfile((p) => (p ? { ...p, ...patch } : p));
  };

  const isAdmin = profile?.role === 'admin';
  const isActive = profile?.status === 'active' || profile?.status === undefined;
  const mustChangePassword = profile?.must_change_password === true;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role || null,
        status: profile?.status || null,
        isAdmin,
        isActive,
        mustChangePassword,
        loading,
        signIn,
        signOut,
        resetPassword,
        updateLocalProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}