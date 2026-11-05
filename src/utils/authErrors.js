// src/utils/authErrors.js
const MAP = {
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/missing-email': 'Enter your email address.',
  'auth/user-disabled': 'This account has been disabled. Contact an administrator.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-login-credentials': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/email-already-in-use': 'That email is already registered.',
  'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
  'auth/requires-recent-login': 'Please sign in again to continue.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled. Contact an administrator.',
};

export function authError(err) {
  if (!err) return 'Something went wrong. Try again.';
  const code = err.code || '';
  return MAP[code] || err.message || 'Something went wrong. Try again.';
}