// src/utils/auditHelpers.js
import { db } from '../firebaseConfig';
import { collection, addDoc, doc, getDoc, setDoc } from 'firebase/firestore';

let cachedNextId = null;

async function nextAuditId() {
  if (cachedNextId != null) {
    const id = cachedNextId;
    cachedNextId = id + 1;
    try {
      await setDoc(doc(db, 'counters', 'audit_trail'),
        { last_id: cachedNextId - 1 }, { merge: true });
    } catch { /* non-fatal */ }
    return id;
  }

  const ref = doc(db, 'counters', 'audit_trail');
  const snap = await getDoc(ref);
  const last = snap.exists() ? Number(snap.data().last_id || 0) : 0;
  const next = last + 1;
  cachedNextId = next + 1;
  await setDoc(ref, { last_id: next }, { merge: true });
  return next;
}

export function diffObjects(before = {}, after = {}, ignore = []) {
  const changes = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  keys.forEach((k) => {
    if (ignore.includes(k)) return;
    const a = before?.[k];
    const b = after?.[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changes[k] = { from: a ?? null, to: b ?? null };
    }
  });
  return changes;
}

export async function writeAudit({
  user, actionType, recordType, recordId = '', details = {},
}) {
  try {
    const id = await nextAuditId();
    await addDoc(collection(db, 'audit_trail'), {
      audit_id: id,
      user_id: user?.uid || null,
      action_type: actionType,
      record_type: recordType,
      record_id: String(recordId ?? ''),
      details: details || {},
      action_timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Audit write failed:', err);
  }
}