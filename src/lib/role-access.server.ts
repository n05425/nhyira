import type { SupabaseClient } from "@supabase/supabase-js";
import { getRoles } from "@/lib/admin.server";
import { readSchoolSettings } from "@/lib/school.server";
import { PEOPLE_FEATURE_KEY } from "@/lib/people-rules";
import { roleGovernanceSchema, operationAllowed, type AccessOperation } from "@/lib/role-governance";
import { ACCESS_RANK, type AccessLevel } from "@/lib/access";
import { serverOperation } from "@/lib/role-operations";

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
  if (!operation) return; // Public setup, account recovery and shared registries retain their own guards.
  const access = await loadRoleAccess(supabase, userId);
  // No override/assignment means the existing server guards remain exactly as before.
  if (!access.governance.roles.length && !access.governance.assignments.length) return;
  for (const action of operation.actions) {
    if (!operationAllowed(access.governance, userId, access.roles, access.level, operation.resource, action as AccessOperation))
      throw new Error(`Forbidden: ${action} access to ${operation.resource} is not assigned to this account.`);
  }
}