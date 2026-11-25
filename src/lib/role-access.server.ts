import type { SupabaseClient } from "@supabase/supabase-js";
import { getRoles } from "@/lib/admin.server";
import { readSchoolSettings } from "@/lib/school.server";
import { PEOPLE_FEATURE_KEY } from "@/lib/people-rules";
import { ACCESS_OPERATIONS, roleGovernanceSchema, operationAllowed } from "@/lib/role-governance";
import { ACCESS_RANK, MODULES, type AccessLevel } from "@/lib/access";
import { financePermissionResource, operationKey, OPERATION_EXEMPTIONS, serverRequirements, recordSaveRequirements, type OperationRequirement } from "@/lib/role-operations";

export async function loadRoleAccess(supabase: SupabaseClient, userId: string) {
  const roles = await getRoles(supabase, userId);
  const { data: profile, error } = await supabase.from("profiles")
    .select("access_level, status").eq("id", userId).maybeSingle();
  if (error || !profile || profile.status !== "active") throw new Error("An active account is required.");
  const level = profile.access_level as AccessLevel;
  if (!(level in ACCESS_RANK)) throw new Error("Could not verify account access level.");
  if (roles.includes("super_admin")) return { roles, level, governance: roleGovernanceSchema.parse({}) };
  const settings = await readSchoolSettings(supabase);
  const features = settings?.features as Record<string, unknown> | null;
  const people = features?.[PEOPLE_FEATURE_KEY] as Record<string, unknown> | undefined;
  // Absent is the legacy policy; malformed saved access rules never grant fallback access.
  const governance = roleGovernanceSchema.parse(people?.['accessGovernance'] ?? {});
  return { roles, level, governance };
}

export async function assertServerRoleOperation(
  supabase: SupabaseClient, userId: string,
  meta: { name: string; filename: string }, data: unknown,
) {
  const requirements = serverRequirements(meta, data);
  const operation = requirements[0];
  if (!operation) {
    const key = operationKey(meta);
    if (key && OPERATION_EXEMPTIONS.has(key)) return;
    throw new Error("Forbidden: this operation has no registered permission policy.");
  }
  const input = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const key = operationKey(meta);
  if (key === "finance-config:setFinanceSectionStatus" || key === "finance-config:deleteFinanceConfigRow") {
    const kind = key === "finance-config:setFinanceSectionStatus" ? "section" : input['kind'];
    const target = kind === "item" ? { table: "finance_reference_items", column: "list_key" }
      : kind === "rule" ? { table: "finance_rules", column: "rule_key" }
      : kind === "section" ? { table: "finance_config_sections", column: "section_key" } : null;
    if (!target || typeof input['id'] !== "string") throw new Error("Invalid configuration record.");
    const { data: row, error } = await supabase.from(target.table).select(target.column).eq("id", input['id']).maybeSingle();
    const record = row && typeof row === "object" && !Array.isArray(row) ? row as Record<string, unknown> : null;
    const sectionKey = record?.[target.column];
    if (error || typeof sectionKey !== "string") throw new Error("Configuration record not found.");
    operation.resource = financePermissionResource(sectionKey);
  }
  await assertRoleOperations(supabase, userId, requirements);
}

/** Modules provide only trusted row counts, never duplicate resource/action decisions. */
export async function assertRecordRoleOperation(
  supabase: SupabaseClient, userId: string, key: string, data: unknown,
  facts: { additions: number; edits: number },
) {
  await assertRoleOperations(supabase, userId, recordSaveRequirements(key, data, facts));
}

export async function assertRoleOperations(
  supabase: SupabaseClient, userId: string,
  requirements: OperationRequirement[],
  preserveLegacyGuards = true,
) {
  if (!requirements.length || requirements.some((r) => !MODULES.some((m) => m.id === r.resource) ||
    !r.actions.length || r.actions.some((a) => !ACCESS_OPERATIONS.includes(a))))
    throw new Error("Forbidden: invalid permission requirement.");
  const access = await loadRoleAccess(supabase, userId);
  // No override/assignment means the existing server guards remain exactly as before.
  if (preserveLegacyGuards && !access.governance.roles.length && !access.governance.assignments.length) return;
  for (const operation of requirements) {
    for (const action of operation.actions) {
      if (!operationAllowed(access.governance, userId, access.roles, access.level, operation.resource, action))
        throw new Error(`Forbidden: ${action} access to ${operation.resource} is not assigned to this account.`);
    }
  }
}