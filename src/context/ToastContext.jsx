import React, { createContext, useCallback, useContext, useState } from 'react';
import Toast from '../components/Toast';

const ToastCtx = createContext(null);

function useToast() {
  return useContext(ToastCtx);
}

function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const showToast = useCallback((m) => setMsg(m), []);
  return (
    <ToastCtx.Provider value={showToast}>
      {children}
      <Toast message={msg} onClose={() => setMsg('')} />
    </ToastCtx.Provider>
  );
}

export { ToastProvider, useToast };