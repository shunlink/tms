"use client";

import { createContext, useContext } from "react";

const ClientPortalViewOnlyContext = createContext(false);

export function ClientPortalViewOnlyProvider({
  viewOnly,
  children,
}: {
  viewOnly: boolean;
  children: React.ReactNode;
}) {
  return (
    <ClientPortalViewOnlyContext.Provider value={viewOnly}>
      {children}
    </ClientPortalViewOnlyContext.Provider>
  );
}

export function useClientPortalViewOnly() {
  return useContext(ClientPortalViewOnlyContext);
}
