import { ACCESS_OPERATIONS, type AccessOperation } from "@/lib/role-governance";
import { projectedOperationAllowed, recordSaveRequirements } from "@/lib/role-operations";

export type PermissionProjection = readonly { moduleId: string; actions: readonly AccessOperation[] }[];
export type ControlPermission = AccessOperation | readonly AccessOperation[] | {
  operation: string;
  data?: unknown;
  facts?: { additions: number; edits: number };
};

/** Only explicit semantic declarations are accepted; never infer access from text or icons. */
export function moduleControlAllowed(
  projection: PermissionProjection, moduleId: string, permission: ControlPermission | undefined,
): boolean {
  const module = projection.find((entry) => entry.moduleId === moduleId);
  if (!module?.actions.includes("read") || !permission) return false;
  if (typeof permission === "object" && "operation" in permission) {
    try {
      if (!permission.facts) return projectedOperationAllowed(projection, permission.operation, permission.data);
      const requirements = recordSaveRequirements(permission.operation, permission.data ?? {}, permission.facts);
      return requirements.length > 0 && requirements.every((requirement) => {
        const target = projection.find((entry) => entry.moduleId === requirement.resource);
        return target?.actions.includes("read") && requirement.actions.every((action) => target.actions.includes(action));
      });
    } catch { return false; }
  }
  const actions = typeof permission === "string" ? [permission] : permission;
  return actions.length > 0 && actions.every((action) => ACCESS_OPERATIONS.includes(action) && module.actions.includes(action));
}