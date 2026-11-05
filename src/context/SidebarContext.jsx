import React, { createContext, useContext, useState } from 'react';

const SidebarCtx = createContext(null);

export const useSidebar = () => useContext(SidebarCtx);

/* Coordinates the mobile sidebar drawer between the Sidebar (which renders
   it) and the Topbar (which opens it via the burger icon). Any nav action
   inside the Sidebar also closes it, so the user lands on the new page with
   the drawer already dismissed. */
export function SidebarProvider({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const open = () => setMobileOpen(true);
  const close = () => setMobileOpen(false);

  return (
    <SidebarCtx.Provider value={{ mobileOpen, open, close, setMobileOpen }}>
      {children}
    </SidebarCtx.Provider>
  );
}