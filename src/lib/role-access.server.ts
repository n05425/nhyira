import type { SupabaseClient } from "@supabase/supabase-js";
import { getRoles } from "@/lib/admin.server";
import { readSchoolSettings } from "@/lib/school.server";
import { PEOPLE_FEATURE_KEY } from "@/lib/people-rules";
import { roleGovernanceSchema, operationAllowed, type AccessOperation } from "@/lib/role-governance";
import { ACCESS_RANK, type AccessLevel } from "@/lib/access";
import { financePermissionResource, operationKey, OPERATION_EXEMPTIONS, serverOperation } from "@/lib/role-operations";

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
  const operation = serverOperation(meta, data);
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
  const requirements = [operation];
  if ((["assignments:gradeSubmission", "assignments:reviewRegradeRequest"].includes(operationKey(meta) ?? "") && input['syncToAssessment'] === true) || operationKey(meta) === "exams:syncExamToAssessment")
    requirements.push({ resource: "assessment", actions: ["create"] });
  await assertRoleOperations(supabase, userId, requirements);
}

export async function assertRoleOperations(
  supabase: SupabaseClient, userId: string,
  requirements: { resource: string; actions: AccessOperation[] }[],
) {
  const access = await loadRoleAccess(supabase, userId);
  // No override/assignment means the existing server guards remain exactly as before.
  if (!access.governance.roles.length && !access.governance.assignments.length) return;
  for (const operation of requirements) {
    for (const action of operation.actions) {
      if (!operationAllowed(access.governance, userId, access.roles, access.level, operation.resource, action))
        throw new Error(`Forbidden: ${action} access to ${operation.resource} is not assigned to this account.`);
    }
  }
}