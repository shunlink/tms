"use client";

import { createContext, useContext, useMemo } from "react";

const PermissionsContext = createContext<string[]>([]);

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: string[];
  children: React.ReactNode;
}) {
  const value = useMemo(() => permissions, [permissions]);
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  return useContext(PermissionsContext);
}

export function useHasPermission(key: string) {
  const permissions = usePermissions();
  return permissions.includes(key);
}
