// src/components/StaffBlockedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessRoute } from '../utils/permissions';

export default function StaffBlockedRoute({ path, children }) {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!canAccessRoute(path, profile)) return <Navigate to="/dashboard" replace />;
  return children;
}