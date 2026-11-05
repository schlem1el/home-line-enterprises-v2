// src/utils/useAudit.js
import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { writeAudit } from './auditHelpers';

export function useAudit() {
  const { user } = useAuth();
  return useCallback(
    (actionType, recordType, recordId, details) =>
      writeAudit({ user, actionType, recordType, recordId, details }),
    [user]
  );
}