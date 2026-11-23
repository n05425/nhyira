import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin, getRoles, logAudit } from "@/lib/admin.server";
import { resolveProvisionedSchool, readSchoolSettings } from "@/lib/school.server";
import { defaultPeopleRules, peopleRulesSchema, PEOPLE_FEATURE_KEY } from "@/lib/people-rules";
import { managedRoleSchema, defaultManagedRole, deleteManagedRole, operationAllowed, assertGrantDependencies } from "@/lib/role-governance";
import { ACCESS_OPERATIONS } from "@/lib/role-governance";
import { MODULES, ROLES, ROLE_META } from "@/lib/access";
import { writeVersionedConfiguration } from "@/lib/configuration-writes";
import { loadRoleAccess } from "@/lib/role-access.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function readEditor(supabase: SupabaseClient<Database>, userId: string) {
  await assertSuperAdmin(supabase, userId);
  const school = await resolveProvisionedSchool(supabase);
  if (!school) throw new Error("An active school is required.");
  const settings = await readSchoolSettings(supabase, school.id);
  const features = settings?.features as Record<string, unknown> | null;
  const raw = features?.[PEOPLE_FEATURE_KEY];
  const rules = raw == null ? defaultPeopleRules() : peopleRulesSchema.parse(raw);
  return { school, rules };
}

export const getRoleGovernance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { school, rules } = await readEditor(context.supabase, context.userId);
    const { data: accounts, error } = await context.supabase.from("profiles")
      .select("id, full_name, email, status").eq("school_id", school.id).order("full_name");
    if (error) throw new Error("Could not load school accounts.");
    const { data: protectedRoles, error: roleError } = await context.supabase.from("user_roles")
      .select("user_id, role").or(`school_id.eq.${school.id},school_id.is.null`);
    if (roleError) throw new Error("Could not verify account roles.");
    return {
      schoolName: school.name, version: rules.version,
      governance: rules.accessGovernance,
      accounts: (accounts ?? []).map((a) => ({ ...a, roles: (protectedRoles ?? []).filter((r) => r.user_id === a.id).map((r) => r.role) })),
      roles: ROLES.filter((r): r is Exclude<typeof r, "super_admin"> => r !== "super_admin")
        .map((r) => rules.accessGovernance.roles.find((v) => v.id === r) ?? defaultManagedRole(r))
        .concat(rules.accessGovernance.roles.filter((r) => !ROLES.includes(r.id as never))),
    };
  });

const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), expectedVersion: z.number().int().min(0), role: managedRoleSchema }),
  z.object({ action: z.literal("update"), expectedVersion: z.number().int().min(0), role: managedRoleSchema }),
  z.object({ action: z.literal("delete"), expectedVersion: z.number().int().min(0), roleId: z.string() }),
  z.object({ action: z.literal("assign"), expectedVersion: z.number().int().min(0), userId: z.string().uuid(), roleId: z.string() }),
  z.object({ action: z.literal("unassign"), expectedVersion: z.number().int().min(0), userId: z.string().uuid() }),
]);
export type RoleGovernanceMutation = z.infer<typeof mutationSchema>;

export const mutateRoleGovernance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => mutationSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { school, rules } = await readEditor(context.supabase, context.userId);
    if (data.expectedVersion !== rules.version) throw new Error("These settings changed. Reload before saving.");
    let governance = rules.accessGovernance;
    if (data.action === "create" || data.action === "update") {
      assertGrantDependencies(data.role);
      const existing = governance.roles.find((r) => r.id === data.role.id);
      const builtIn = ROLES.some((r) => r === data.role.id);
      const effectiveRoles = ROLES.filter((r) => r !== "super_admin").map((r) => governance.roles.find((v) => v.id === r) ?? defaultManagedRole(r));
      if ([...effectiveRoles, ...governance.roles].some((r) => r.id !== data.role.id && r.name.toLowerCase() === data.role.name.toLowerCase()))
        throw new Error("A role already uses this name.");
      if (data.action === "create" && (existing || builtIn)) throw new Error("Role already exists.");
      if (data.action === "update" && !existing && !builtIn) throw new Error("Role not found.");
      if (existing && existing.baseRole !== data.role.baseRole && governance.assignments.some((a) => a.roleId === existing.id))
        throw new Error("Remove account assignments before changing the base role.");
      governance = { ...governance, roles: [...governance.roles.filter((r) => r.id !== data.role.id), data.role] };
    } else if (data.action === "delete") {
      governance = deleteManagedRole(governance, data.roleId);
    } else if (data.action === "unassign") {
      if (!governance.assignments.some((a) => a.userId === data.userId)) throw new Error("Assignment not found.");
      governance = { ...governance, assignments: governance.assignments.filter((a) => a.userId !== data.userId) };
    } else {
      const { data: account, error } = await context.supabase.from("profiles")
        .select("id, school_id, status").eq("id", data.userId).eq("school_id", school.id).maybeSingle();
      if (error || !account) throw new Error("Account does not belong to this school.");
      const roles = await getRoles(context.supabase, data.userId);
      if (roles.includes("super_admin")) throw new Error("Super Admin access cannot be changed with a custom role.");
      const assignments = governance.assignments.filter((a) => a.userId !== data.userId);
      if (data.action === "assign") {
        const role = governance.roles.find((r) => r.id === data.roleId);
        if (!role || ROLES.some((r) => r === role.id) || role.status !== "active") throw new Error("Select an active custom role.");
        assertGrantDependencies(role);
        if (!roles.includes(role.baseRole)) throw new Error("The custom role must match the account's existing protected role.");
        if (account.status !== "active") throw new Error("Only active accounts can receive a custom role.");
        assignments.push({ userId: data.userId, roleId: role.id });
      }
      governance = { ...governance, assignments };
    }
    const next = peopleRulesSchema.parse({ ...rules, accessGovernance: governance });
    const saved = await writeVersionedConfiguration(context.supabase, school.id, PEOPLE_FEATURE_KEY, next, (raw) => peopleRulesSchema.parse(raw));
    await logAudit(context.supabase, context.userId, {
      action: `role_governance_${data.action}`, description: `Role access ${data.action} in ${school.name}`,
      details: { schoolId: school.id, version: saved.version, ...(data.action === "create" || data.action === "update" ? { roleId: data.role.id } : data.action === "unassign" ? { userId: data.userId } : { roleId: data.roleId }) },
    });
    return { version: saved.version };
  });

/** Read-only UI projection, never accepted back as authorization input. */
export const getMyRoleAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await loadRoleAccess(context.supabase, context.userId);
    const assignment = access.governance.assignments.find((a) => a.userId === context.userId);
    const customRole = access.governance.roles.find((r) => r.id === assignment?.roleId);
    const protectedRole = ROLES.find((r) => access.roles.includes(r));
    const roleName = customRole?.name ?? access.governance.roles.find((r) => r.id === protectedRole)?.name ?? (protectedRole ? ROLE_META[protectedRole].label : null);
    return {
      customRoleName: roleName,
      operations: MODULES.map((m) => ({ moduleId: m.id, actions: ACCESS_OPERATIONS.filter((action) =>
        operationAllowed(access.governance, context.userId, access.roles, access.level, m.id, action)) })),
    };
  });

export const getMyPortalProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("profiles")
      .select("id, full_name, email, access_level, status, force_password_change, avatar_url")
      .eq("id", context.userId).maybeSingle();
    if (error) throw new Error("Could not load your account.");
    if (!data) return null;
    const roles = await getRoles(context.supabase, context.userId);
    const role = ROLES.find((r) => roles.includes(r));
    if (!role) throw new Error("No protected role is assigned to this account.");
    return { ...data, role, roleLabel: ROLE_META[role].label };
  });

/** Fresh server authorization for every application download or printed/PDF document. */
export const authorizeModuleExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ moduleId: z.string().refine((id) => MODULES.some((m) => m.id === id), "Unknown module") }).parse(input))
  .handler(async ({ data, context }) => {
    const access = await loadRoleAccess(context.supabase, context.userId);
    if (!operationAllowed(access.governance, context.userId, access.roles, access.level, data.moduleId, "export"))
      throw new Error("Export permission is required to download or print this module's records.");
    return { allowed: true };
  });