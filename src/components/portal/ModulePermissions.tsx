import { createContext, useContext, type ReactNode } from "react";
import { moduleControlAllowed, type ControlPermission, type PermissionProjection } from "@/lib/permission-controls";

const ModulePermissionContext = createContext<{
  moduleId: string;
  projection: PermissionProjection;
} | null>(null);

export function ModulePermissions({ moduleId, projection, children }: {
  moduleId: string;
  projection: PermissionProjection;
  children: ReactNode;
}) {
  return <ModulePermissionContext.Provider value={{ moduleId, projection }}>{children}</ModulePermissionContext.Provider>;
}

/** React context follows dialogs/portals, without another query for every control. */
export function useControlPermission(permission: ControlPermission | undefined) {
  const context = useContext(ModulePermissionContext);
  return context ? moduleControlAllowed(context.projection, context.moduleId, permission) : true;
}