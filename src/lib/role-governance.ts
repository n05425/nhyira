import { z } from "zod";
import { MODULES, ROLES, ROLE_META, canAccess, type Role, type AccessLevel } from "@/lib/access";

export const ACCESS_OPERATIONS = ["read", "create", "update", "delete", "export"] as const;
export type AccessOperation = (typeof ACCESS_OPERATIONS)[number];
export const grantSchema = z.object({
  resource: z.string().refine((id) => MODULES.some((m) => m.id === id), "Unknown module"),
  action: z.enum(ACCESS_OPERATIONS),
});
export const managedRoleSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500),
  baseRole: z.enum(["school_manager", "staff", "student", "parent"]),
  status: z.enum(["active", "inactive"]),
  grants: z.array(grantSchema).max(MODULES.length * ACCESS_OPERATIONS.length),
}).superRefine((role, ctx) => {
  if (role.id === "super_admin") ctx.addIssue({ code: "custom", message: "Super Admin is protected" });
  if (ROLES.includes(role.id as Role) && role.id !== role.baseRole)
    ctx.addIssue({ code: "custom", message: "A built-in role cannot change its identity" });
  if (ROLES.includes(role.id as Role) && role.status !== "active")
    ctx.addIssue({ code: "custom", message: "Built-in roles cannot be deactivated" });
  const keys = new Set<string>();
  for (const grant of role.grants) {
    const key = `${grant.resource}:${grant.action}`;
    if (keys.has(key)) ctx.addIssue({ code: "custom", message: "Duplicate permission" });
    keys.add(key);
    if (!canAccess(role.baseRole, ROLE_META[role.baseRole].accessLevel, grant.resource))
      ctx.addIssue({ code: "custom", message: "Permissions must remain within the existing base-role access" });
    if (grant.action === "export" && grant.resource !== "archives")
      ctx.addIssue({ code: "custom", message: "Export control is available only for archived records" });
  }
});
export const roleGovernanceSchema = z.object({
  roles: z.array(managedRoleSchema).max(100).default([]),
  assignments: z.array(z.object({ userId: z.string().uuid(), roleId: z.string().min(1).max(80) })).max(10000).default([]),
}).superRefine((value, ctx) => {
  if (new Set(value.roles.map((r) => r.id)).size !== value.roles.length)
    ctx.addIssue({ code: "custom", message: "Role identifiers must be unique" });
  if (new Set(value.roles.map((r) => r.name.toLowerCase())).size !== value.roles.length)
    ctx.addIssue({ code: "custom", message: "Role names must be unique" });
  if (new Set(value.assignments.map((a) => a.userId)).size !== value.assignments.length)
    ctx.addIssue({ code: "custom", message: "An account can have only one custom role" });
  for (const assignment of value.assignments) {
    if (ROLES.includes(assignment.roleId as Role) || !value.roles.some((r) => r.id === assignment.roleId))
      ctx.addIssue({ code: "custom", message: "Assignment must refer to an existing custom role" });
  }
});
export type ManagedRole = z.infer<typeof managedRoleSchema>;
export type RoleGovernance = z.infer<typeof roleGovernanceSchema>;

export function defaultManagedRole(baseRole: Exclude<Role, "super_admin">): ManagedRole {
  return {
    id: baseRole, name: ROLE_META[baseRole].label, description: ROLE_META[baseRole].tagline,
    baseRole, status: "active",
    grants: MODULES.filter((m) => canAccess(baseRole, ROLE_META[baseRole].accessLevel, m.id))
      .flatMap((m) => ACCESS_OPERATIONS.filter((action) => action !== "export" || m.id === "archives").map((action) => ({ resource: m.id, action }))),
  };
}

/** Additional restrictions only: existing role, level, RLS and teaching guards still apply. */
export function operationAllowed(
  governance: RoleGovernance, userId: string, roles: string[], level: AccessLevel,
  resource: string, action: AccessOperation,
): boolean {
  if (roles.includes("super_admin")) return true;
  if (action === "export" && resource !== "archives") return false;
  const eligible = roles.filter((r): r is Role => ROLES.includes(r as Role) && canAccess(r as Role, level, resource));
  if (!eligible.length) return false;
  const builtInAllowed = eligible.some((id) => {
    const override = governance.roles.find((r) => r.id === id);
    return !override || override.grants.some((g) => g.resource === resource && g.action === action);
  });
  if (!builtInAllowed) return false;
  const assignment = governance.assignments.find((a) => a.userId === userId);
  if (!assignment) return true;
  const custom = governance.roles.find((r) => r.id === assignment.roleId);
  return Boolean(custom && custom.status === "active" && roles.includes(custom.baseRole) &&
    custom.grants.some((g) => g.resource === resource && g.action === action));
}

export function deleteManagedRole(governance: RoleGovernance, id: string): RoleGovernance {
  if (ROLES.includes(id as Role)) throw new Error("Built-in roles cannot be deleted.");
  if (governance.assignments.some((a) => a.roleId === id)) throw new Error("Remove account assignments before deleting this role.");
  if (!governance.roles.some((r) => r.id === id)) throw new Error("Role not found.");
  return { ...governance, roles: governance.roles.filter((r) => r.id !== id) };
}