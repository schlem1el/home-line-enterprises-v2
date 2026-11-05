import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, TextField, MenuItem, Button, Table, TableHead, TableBody,
  TableRow, TableCell, Typography, Chip, IconButton, Tooltip, Alert,
  Card, CardContent, Divider
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LockResetOutlinedIcon from '@mui/icons-material/LockResetOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import Topbar from '../components/Topbar';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';
import Field from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { isValidEmailAddress } from '../utils/validation';
import { stopRowActivationPropagation } from '../utils/keyboard';
import { useAudit } from '../utils/useAudit';
import { TOKENS, filterChip } from '../styles/HomeLineStyles';
import {
  db, auth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
} from '../firebaseConfig';
import {
  collection, getDocs, doc, setDoc, updateDoc, query, orderBy, serverTimestamp,
} from 'firebase/firestore';

const PAGE_SIZE = 10;
const STATUSES = ['active', 'inactive'];
const COLOR_MAP = { active: 'success', inactive: 'default' };

export default function Admin() {
  const { profile: me } = useAuth();
  const showToast = useToast();
  const log = useAudit();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState({ full_name: '', email: '', password: '', status: 'active' });
  const [saving, setSaving] = useState(false);

  const [editRow, setEditRow] = useState(null);
  const [editDraft, setEditDraft] = useState({ full_name: '', status: 'active' });
  const [editSaving, setEditSaving] = useState(false);

  const [confirmRow, setConfirmRow] = useState(null);
  const [confirmKind, setConfirmKind] = useState(null);
  const [resetConfirmRow, setResetConfirmRow] = useState(null);

  const fetchUsers = useCallback(async () => {
    const q = query(collection(db, 'users'), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ _id: d.id, ...d.data() }))
      .filter((r) => r.status !== 'deleted');
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await fetchUsers());
    } catch (err) {
      console.error('Load users failed:', err);
      showToast('Could not load staff. Check your Firestore rules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadInitialUsers = async () => {
      try {
        const users = await fetchUsers();
        if (!cancelled) setRows(users);
      } catch (err) {
        console.error('Load users failed:', err);
        if (!cancelled) showToast('Could not load staff. Check your Firestore rules.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadInitialUsers();
    return () => { cancelled = true; };
  }, [fetchUsers, showToast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (q && !(`${r.full_name || ''} ${r.email || ''}`.toLowerCase().includes(q))) return false;
        if (statusFilter && r.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [rows, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const openAdd = () => {
    setAddDraft({ full_name: '', email: '', password: '', status: 'active' });
    setAddOpen(true);
  };

  const saveAdd = async () => {
    if (saving) return;
    const name = addDraft.full_name.trim().replace(/\s+/g, ' ');
    const email = addDraft.email.trim().toLowerCase();
    const password = addDraft.password;

    if (!name) { showToast('Enter the staff member’s full name'); return; }
    if (!email) { showToast('Enter their email address'); return; }
    if (!isValidEmailAddress(email)) { showToast('That email address doesn’t look right'); return; }
    if (!password) { showToast('Enter a temporary password'); return; }
    if (password.length < 6) { showToast('Password must be at least 6 characters'); return; }
    if (rows.some((r) => (r.email || '').toLowerCase() === email)) { showToast('That email is already in use'); return; }

    setSaving(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      await setDoc(doc(db, 'users', uid), {
        uid,
        email,
        full_name: name,
        role: 'staff',
        status: addDraft.status,
        must_change_password: true,
        created_at: serverTimestamp(),
        created_by: me?.uid || null,
      });

      await log('LOGOUT', 'Session', me?.uid || '', {
        summary: 'Signed out after creating staff account',
      });
      await signOut(auth);

      setAddOpen(false);
      showToast(`Staff ${name} created. Please sign in again to continue.`);
    } catch (err) {
      console.error('Create staff failed:', err);
      showToast(err.message || 'Could not create staff');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row) => {
    setEditRow(row);
    setEditDraft({ full_name: row.full_name || '', status: row.status || 'active' });
  };

  const saveEdit = async () => {
    if (editSaving) return;
    const name = editDraft.full_name.trim().replace(/\s+/g, ' ');
    if (!name) { showToast('Enter their full name'); return; }

    setEditSaving(true);
    try {
      await updateDoc(doc(db, 'users', editRow._id), {
        full_name: name,
        status: editDraft.status,
      });
      await load();
      await log('UPDATE', 'User', editRow.email, {
        summary: `Updated staff "${name}" (${editRow.email})`,
        email: editRow.email,
        full_name: name,
        status: editDraft.status,
      });
      setEditRow(null);
      showToast('Staff updated ✓');
    } catch (err) {
      console.error('Update staff failed:', err);
      showToast(err.message || 'Could not update');
    } finally {
      setEditSaving(false);
    }
  };

  const openStatusConfirm = (row, kind) => {
    setConfirmRow(row);
    setConfirmKind(kind);
  };

  const applyStatusChange = async () => {
    if (!confirmRow) return;
    try {
      if (confirmKind === 'delete') {
        await updateDoc(doc(db, 'users', confirmRow._id), {
          status: 'deleted',
          deleted_at: serverTimestamp(),
        });
        await log('DELETE', 'User', confirmRow.email, {
          summary: `Removed staff "${confirmRow.full_name}" from the list`,
          email: confirmRow.email,
          full_name: confirmRow.full_name,
        });
        showToast(`${confirmRow.full_name} removed from staff list ✓`);
      } else {
        const next = confirmKind === 'deactivate' ? 'inactive' : 'active';
        await updateDoc(doc(db, 'users', confirmRow._id), { status: next });
        await log(
          confirmKind === 'deactivate' ? 'CANCEL' : 'CREATE',
          'User',
          confirmRow.email,
          {
            summary: `Staff "${confirmRow.full_name}" ${confirmKind === 'deactivate' ? 'deactivated' : 'reactivated'}`,
            email: confirmRow.email,
            full_name: confirmRow.full_name,
            new_status: next,
          }
        );
        showToast(`Staff ${confirmKind === 'deactivate' ? 'deactivated' : 'reactivated'} ✓`);
      }
      await load();
    } catch (err) {
      console.error('Action failed:', err);
      showToast(err.message || 'Could not complete');
    } finally {
      setConfirmRow(null);
      setConfirmKind(null);
    }
  };

  const resetPasswordFor = async (row) => {
    try {
      await sendPasswordResetEmail(auth, row.email);
      await log('UPDATE', 'User', row.email, {
        summary: `Sent password reset link to ${row.email}`,
        email: row.email,
        full_name: row.full_name,
      });
      showToast(`Reset link sent to ${row.email} ✓`);
    } catch (err) {
      console.error('Reset failed:', err);
      showToast(err.message || 'Could not send reset email');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPage(1);
  };

  return (
    <>
      <Topbar title="Staff Management" />
      <Box sx={{ p: { xs: '16px 14px 30px', sm: 'clamp(18px, 2.5vw, 30px) clamp(18px, 3vw, 40px) 40px' } }}>

        <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
          Admins can create, edit, deactivate and reset passwords for <strong>staff accounts</strong>.
          Admin accounts can only be created from the Firebase console.
          Deleted staff remain in Firebase Authentication until removed there manually.
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'minmax(200px, 1fr) minmax(150px, auto) auto auto'
            },
            gap: 2,
            alignItems: 'center',
            '& > *': { minWidth: 0 }
          }}>
            <TextField
              size="small"
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              fullWidth
            />
            <TextField
              select size="small" label="Status" value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              fullWidth
            >
              <MenuItem value="">All statuses</MenuItem>
              {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
            <Box sx={{
              gridColumn: { xs: '1', sm: '1 / -1', lg: 'auto' },
              display: 'flex',
              justifyContent: { xs: 'stretch', sm: 'flex-end' },
              flexDirection: { xs: 'column', sm: 'row' },
              flexWrap: 'wrap',
              gap: 1.5,
              '& > *': { minWidth: 0 }
            }}>
              <Button sx={{ ...filterChip, height: 40, whiteSpace: 'nowrap', width: { xs: '100%', sm: 'auto' } }} startIcon={<FilterAltOffIcon />} onClick={clearFilters}>
                Clear Filters
              </Button>
              <Button variant="contained" sx={{ height: 40, whiteSpace: 'nowrap', width: { xs: '100%', sm: 'auto' } }} onClick={openAdd}>
                + Add Staff
              </Button>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: { xs: 'none', sm: 'block' }, border: `1px solid ${TOKENS.lineSoft}`, borderRadius: `${TOKENS.radius}px`, overflow: 'auto', maxWidth: '100%' }}>
          <Table sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow>
                <TableCell>Full Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell sx={{ width: 220 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: TOKENS.gray5 }}>Loading…</TableCell></TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: TOKENS.gray5 }}>No staff match these filters.</TableCell></TableRow>
              ) : pageRows.map((row) => {
                const isMe = row.uid === me?.uid;
                const isAdminRow = row.role === 'admin';
                return (
                  <TableRow key={row._id} hover>
                    <TableCell>{row.full_name}{isMe && <Chip label="You" size="small" sx={{ ml: 1, height: 18, fontSize: 9 }} />}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell><Chip label={row.role} size="small" color={isAdminRow ? 'primary' : 'default'} /></TableCell>
                    <TableCell><Chip label={row.status || 'active'} size="small" color={COLOR_MAP[row.status] || 'default'} /></TableCell>
                    <TableCell sx={{ fontSize: 11.5, color: TOKENS.gray5, whiteSpace: 'nowrap' }}>{row.last_login?.toDate ? row.last_login.toDate().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</TableCell>
                    <TableCell>
                      <Tooltip title="Edit"><span><IconButton size="small" disabled={isAdminRow} onClick={() => openEdit(row)} onKeyDown={stopRowActivationPropagation} aria-label={`Edit staff ${row.full_name}`}><EditOutlinedIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
                      <Tooltip title={row.status === 'inactive' ? 'Reactivate' : 'Deactivate'}><span><IconButton size="small" disabled={isMe || isAdminRow} onClick={() => openStatusConfirm(row, row.status === 'inactive' ? 'reactivate' : 'deactivate')} aria-label={`${row.status === 'inactive' ? 'Reactivate' : 'Deactivate'} staff ${row.full_name}`}>{row.status === 'inactive' ? <CheckCircleOutlineIcon sx={{ fontSize: 16 }} /> : <BlockOutlinedIcon sx={{ fontSize: 16 }} />}</IconButton></span></Tooltip>
                      <Tooltip title="Send password reset email"><span><IconButton size="small" onClick={() => setResetConfirmRow(row)} aria-label={`Send password reset email to ${row.full_name}`}><LockResetOutlinedIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
                      <Tooltip title="Delete staff"><span><IconButton size="small" disabled={isMe || isAdminRow} onClick={() => openStatusConfirm(row, 'delete')} aria-label={`Delete staff ${row.full_name}`}><DeleteOutlineIcon sx={{ fontSize: 16, color: TOKENS.hlError }} /></IconButton></span></Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>

        <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 2 }}>
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4, color: TOKENS.gray5 }}>Loading…</Box>
          ) : pageRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: TOKENS.gray5 }}>No staff match these filters.</Box>
          ) : pageRows.map((row) => {
            const isMe = row.uid === me?.uid;
            const isAdminRow = row.role === 'admin';
            return (
              <Card key={row._id} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: 14, color: TOKENS.hlBlueDark }}>
                        {row.full_name} {isMe && <Chip label="You" size="small" sx={{ ml: 1, height: 18, fontSize: 9 }} />}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: TOKENS.gray5, mt: 0.5 }}>{row.email}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Chip label={row.role} size="small" color={isAdminRow ? 'primary' : 'default'} />
                    </Box>
                  </Box>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.gray5, letterSpacing: 0.5 }}>Status</Typography>
                      <Chip label={row.status || 'active'} size="small" color={COLOR_MAP[row.status] || 'default'} sx={{ mt: 0.5 }} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton size="small" disabled={isAdminRow} onClick={() => openEdit(row)} onKeyDown={stopRowActivationPropagation} aria-label={`Edit staff ${row.full_name}`}><EditOutlinedIcon sx={{ fontSize: 16 }} /></IconButton>
                      <IconButton size="small" disabled={isMe || isAdminRow} onClick={() => openStatusConfirm(row, row.status === 'inactive' ? 'reactivate' : 'deactivate')} aria-label={`${row.status === 'inactive' ? 'Reactivate' : 'Deactivate'} staff ${row.full_name}`}>
                        {row.status === 'inactive' ? <CheckCircleOutlineIcon sx={{ fontSize: 16 }} /> : <BlockOutlinedIcon sx={{ fontSize: 16 }} />}
                      </IconButton>
                      <IconButton size="small" onClick={() => setResetConfirmRow(row)} aria-label={`Send password reset email to ${row.full_name}`}><LockResetOutlinedIcon sx={{ fontSize: 16 }} /></IconButton>
                      <IconButton size="small" disabled={isMe || isAdminRow} onClick={() => openStatusConfirm(row, 'delete')} aria-label={`Delete staff ${row.full_name}`}><DeleteOutlineIcon sx={{ fontSize: 16, color: TOKENS.hlError }} /></IconButton>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>

        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPrev={() => setPage(safePage - 1)}
          onNext={() => setPage(safePage + 1)}
          info={filtered.length
            ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + pageRows.length} of ${filtered.length} staff`
            : '0 staff'}
        />
      </Box>

      <Modal open={addOpen} title="Add Staff" onClose={() => setAddOpen(false)} onConfirm={saveAdd} confirmLabel={saving ? 'Creating…' : 'Create Staff'} confirmationTitle="Confirm staff account" confirmationMessage="Create this staff account with the entered access status?" confirmationLabel="Create staff" width="form">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, pt: 1 }}>
          <Field label="Full Name" labelColor={TOKENS.hlBlueDark}>
            <TextField autoFocus fullWidth size="small" value={addDraft.full_name} onChange={(e) => setAddDraft((d) => ({ ...d, full_name: e.target.value }))} />
          </Field>
          <Field label="Email" labelColor={TOKENS.hlBlueDark}>
            <TextField fullWidth size="small" type="email" value={addDraft.email} onChange={(e) => setAddDraft((d) => ({ ...d, email: e.target.value }))} />
          </Field>
          <Field label="Temporary Password" labelColor={TOKENS.hlBlueDark}>
            <TextField fullWidth size="small" type="text" value={addDraft.password} onChange={(e) => setAddDraft((d) => ({ ...d, password: e.target.value }))} helperText="At least 6 characters. The staff member will change this on first sign-in." />
          </Field>
          <Field label="Status" labelColor={TOKENS.hlBlueDark}>
            <TextField select fullWidth size="small" value={addDraft.status} onChange={(e) => setAddDraft((d) => ({ ...d, status: e.target.value }))}>
              {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Field>
        </Box>
      </Modal>

      {editRow && (
        <Modal open title={'Edit Staff — ' + editRow.full_name} onClose={() => setEditRow(null)} onConfirm={saveEdit} confirmLabel={editSaving ? 'Saving…' : 'Save changes'} confirmationTitle="Confirm staff update" confirmationMessage="Save these changes to the staff account?" confirmationLabel="Save changes" width="form">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, pt: 1 }}>
            <Field label="Full Name" labelColor={TOKENS.hlBlueDark}>
              <TextField autoFocus fullWidth size="small" value={editDraft.full_name} onChange={(e) => setEditDraft((d) => ({ ...d, full_name: e.target.value }))} />
            </Field>
            <Field label="Email" labelColor={TOKENS.hlBlueDark}>
              <TextField fullWidth size="small" value={editRow.email} InputProps={{ readOnly: true }} helperText="Email can’t be changed after the account is created." />
            </Field>
            <Field label="Status" labelColor={TOKENS.hlBlueDark}>
              <TextField select fullWidth size="small" value={editDraft.status} onChange={(e) => setEditDraft((d) => ({ ...d, status: e.target.value }))}>
                {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Field>
          </Box>
        </Modal>
      )}

      <Modal open={!!confirmRow && !!confirmKind} title={confirmKind === 'deactivate' ? 'Deactivate staff?' : confirmKind === 'reactivate' ? 'Reactivate staff?' : 'Delete staff?'} onClose={() => { setConfirmRow(null); setConfirmKind(null); }} onConfirm={applyStatusChange} confirmLabel={confirmKind === 'deactivate' ? 'Deactivate' : confirmKind === 'reactivate' ? 'Reactivate' : 'Delete'} width="confirm">
        {confirmRow && (
          <Typography sx={{ fontSize: 13, lineHeight: 1.5 }}>
            {confirmKind === 'deactivate' && `${confirmRow.full_name} won’t be able to sign in until reactivated.`}
            {confirmKind === 'reactivate' && `${confirmRow.full_name} will be able to sign in again.`}
            {confirmKind === 'delete' && (
              <>
                {confirmRow.full_name} will be removed from the staff list and blocked from signing in.
                <br /><br />
                To fully delete them, go to <strong>Firebase Console → Authentication → Users</strong>{' '}
                and remove their account manually. Their Firestore record will be marked deleted.
              </>
            )}
          </Typography>
        )}
      </Modal>

      <Modal
        open={!!resetConfirmRow}
        title="Send password reset email?"
        onClose={() => setResetConfirmRow(null)}
        onConfirm={() => {
          const row = resetConfirmRow;
          setResetConfirmRow(null);
          if (row) resetPasswordFor(row);
        }}
        confirmLabel="Send reset link"
        width="confirm"
      >
        <Typography sx={{ fontSize: 13, lineHeight: 1.5 }}>
          Send a password reset link to {resetConfirmRow?.email}?
        </Typography>
      </Modal>
    </>
  );
}