// src/utils/permissions.js
import { useAuth } from '../context/AuthContext';

/* Routes staff cannot open — admin only. */
export const STAFF_BLOCKED_ROUTES = [
  '/customers',
  '/suppliers',
  '/payments/customer',
  '/payments/supplier',
  '/reports/sales',
  '/reports/purchase',
  '/reports/payment',
  // '/reports/inventory', <--- Removed so staff can access it
];

/* Routes only admin can open. */
export const ADMIN_ONLY_ROUTES = [
  '/admin',
  '/admin/audit',
];

export function isAdmin(profile) {
  return profile?.role === 'admin';
}

export function canSeeNavItem(item, profile) {
  const admin = isAdmin(profile);
  if (item.type === 'admin') return admin;
  if (item.children) {
    const visible = item.children.filter(
      (c) => admin || !STAFF_BLOCKED_ROUTES.includes(c.to)
    );
    return visible.length > 0;
  }
  if (item.to && STAFF_BLOCKED_ROUTES.includes(item.to)) return admin;
  return true;
}

export function canAccessRoute(path, profile) {
  const admin = isAdmin(profile);
  if (ADMIN_ONLY_ROUTES.includes(path)) return admin;
  if (STAFF_BLOCKED_ROUTES.includes(path)) return admin;
  return true;
}

export function usePermissions() {
  const { profile } = useAuth();
  const admin = isAdmin(profile);
  return {
    isAdmin: admin,
    isStaff: !admin,
    canSeeNavItem: (item) => canSeeNavItem(item, profile),
    canAccessRoute: (path) => canAccessRoute(path, profile),
  };
}