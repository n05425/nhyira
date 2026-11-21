import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultManagedRole, deleteManagedRole, managedRoleSchema, operationAllowed, roleGovernanceSchema, type RoleGovernance } from "@/lib/role-governance";
import { defaultPeopleRules, peopleRulesSchema } from "@/lib/people-rules";
import { assertSuperAdmin } from "@/lib/admin.server";
import { assertServerRoleOperation } from "@/lib/role-access.server";
import { serverOperation } from "@/lib/role-operations";

const userId = "00000000-0000-4000-8000-000000000001";
const custom = { ...defaultManagedRole("staff"), id: "exam-reviewer", name: "Exam reviewer", grants: [{ resource: "assessment", action: "read" as const }] };
const assigned: RoleGovernance = { roles: [custom], assignments: [{ userId, roleId: custom.id }] };

describe("preserved authority and custom-role CRUD", () => {
  it("preserves existing staff access when no role override is saved", () => {
    expect(operationAllowed({ roles: [], assignments: [] }, userId, ["staff"], "standard", "assessment", "update")).toBe(true);
  });
  it("allows Super Admin even when a built-in or custom role grants nothing", () => {
    expect(operationAllowed(assigned, userId, ["super_admin"], "super_administrator", "user-management", "delete")).toBe(true);
  });
  it("allows only a protected Super Admin to manage role definitions", async () => {
    const client = { from: vi.fn(() => ({ select: () => ({ eq: async () => ({ data: [{ role: "school_manager" }], error: null }) }) })) } as unknown as SupabaseClient;
    await expect(assertSuperAdmin(client, userId)).rejects.toThrow("Super Admin access required");
  });
  it("creates a custom role without replacing any built-in role", () => {
    const parsed = roleGovernanceSchema.parse(assigned);
    expect(parsed.roles[0]?.id).toBe("exam-reviewer");
    expect(parsed.roles[0]?.baseRole).toBe("staff");
  });
  it("rejects administrator permissions on a staff-based custom role", () => {
    expect(managedRoleSchema.safeParse({ ...custom, grants: [{ resource: "user-management", action: "create" }] }).success).toBe(false);
  });
  it("rejects editing the protected Super Admin role", () => {
    expect(managedRoleSchema.safeParse({ ...custom, id: "super_admin" }).success).toBe(false);
  });
  it("keeps a built-in role identity intact while its permissions are edited", () => {
    expect(managedRoleSchema.safeParse({ ...defaultManagedRole("staff"), baseRole: "school_manager" }).success).toBe(false);
    expect(managedRoleSchema.safeParse({ ...defaultManagedRole("staff"), grants: [] }).success).toBe(true);
  });
  it("permits assigned read access and denies unassigned create, update and delete operations", () => {
    expect(operationAllowed(assigned, userId, ["staff"], "standard", "assessment", "read")).toBe(true);
    for (const op of ["create", "update", "delete"] as const)
      expect(operationAllowed(assigned, userId, ["staff"], "standard", "assessment", op)).toBe(false);
  });
  it("applies edited permissions to an existing built-in role", () => {
    const governance = { roles: [{ ...defaultManagedRole("staff"), grants: [{ resource: "assessment", action: "read" as const }] }], assignments: [] };
    expect(operationAllowed(governance, userId, ["staff"], "standard", "assessment", "update")).toBe(false);
  });
  it("deactivating a custom role revokes its assigned access", () => {
    expect(operationAllowed({ ...assigned, roles: [{ ...custom, status: "inactive" }] }, userId, ["staff"], "standard", "assessment", "read")).toBe(false);
  });
  it("removing an assignment restores the existing protected role access", () => {
    expect(operationAllowed({ ...assigned, assignments: [] }, userId, ["staff"], "standard", "assessment", "update")).toBe(true);
  });
  it("a changed protected role cannot keep an incompatible custom assignment", () => {
    expect(operationAllowed(assigned, userId, ["student"], "basic", "assessment", "read")).toBe(false);
  });
  it("custom permissions cannot override the existing access level", () => {
    expect(operationAllowed(assigned, userId, ["staff"], "basic", "assessment", "read")).toBe(false);
  });
  it("blocks deleting assigned roles and every built-in role", () => {
    expect(() => deleteManagedRole(assigned, custom.id)).toThrow("Remove account assignments");
    expect(() => deleteManagedRole({ roles: [], assignments: [] }, "staff")).toThrow("Built-in roles");
  });
  it("deletes an unassigned custom role without changing other definitions", () => {
    const other = { ...custom, id: "second", name: "Second" };
    expect(deleteManagedRole({ roles: [custom, other], assignments: [] }, custom.id).roles).toEqual([other]);
  });
  it("rejects missing role assignments, duplicate grants and duplicate custom names", () => {
    expect(roleGovernanceSchema.safeParse({ roles: [], assignments: assigned.assignments }).success).toBe(false);
    expect(managedRoleSchema.safeParse({ ...custom, grants: [...custom.grants, ...custom.grants] }).success).toBe(false);
    expect(roleGovernanceSchema.safeParse({ roles: [custom, { ...custom, id: "second" }], assignments: [] }).success).toBe(false);
  });
  it("older people settings gain empty access rules without changing lifecycle terms", () => {
    const { accessGovernance: _access, ...old } = defaultPeopleRules();
    const parsed = peopleRulesSchema.parse(old);
    expect(parsed.accessGovernance).toEqual({ roles: [], assignments: [] });
    expect(parsed.staffLifecycle.find((r) => r.key === "notice-months")?.value).toBe(1);
  });
  it("people-settings round trips preserve role definitions and assignments", () => {
    expect(peopleRulesSchema.parse({ ...defaultPeopleRules(), accessGovernance: assigned }).accessGovernance).toEqual(assigned);
  });
});

describe("server-side operation enforcement", () => {
  it("identifies reads, writes and deletion independently of caller input", () => {
    expect(serverOperation({ filename: "src/lib/assessment.functions.ts", name: "deleteAssessment" }, { resource: "dashboard", action: "read" })).toEqual({ resource: "assessment", actions: ["delete"] });
  });
  it("ID editors distinguish create from update while natural-key upserts require both", () => {
    const meta = { filename: "src/lib/assignments.functions.ts", name: "saveAssignment" };
    expect(serverOperation(meta, {})?.actions).toEqual(["create"]);
    expect(serverOperation(meta, { id: "existing" })?.actions).toEqual(["update"]);
    expect(serverOperation({ filename: "src/lib/assessment.functions.ts", name: "saveAssessment" }, {})?.actions).toEqual(["create", "update"]);
  });
  it("preserves public landing reads and account-recovery checks", () => {
    expect(serverOperation({ filename: "src/lib/publicity.functions.ts", name: "getPublicLandingData" }, {})).toBeNull();
    expect(serverOperation({ filename: "src/lib/admin.functions.ts", name: "changeOwnPassword" }, {})).toBeNull();
  });
  it("server guard rejects direct deletion even when a caller skips the UI", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: "school-a", error: null }),
      from: vi.fn((table: string) => {
        const result = table === "user_roles" ? { data: [{ role: "staff" }], error: null }
          : table === "profiles" ? { data: { access_level: "standard", status: "active" }, error: null }
          : table === "schools" ? { data: { id: "school-a" }, error: null }
          : { data: { features: { __people_rules: { accessGovernance: assigned } } }, error: null };
        const builder = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(result), then: (resolve: (value: unknown) => void) => Promise.resolve(result).then(resolve) };
        builder.select.mockReturnValue(builder); builder.eq.mockReturnValue(builder);
        return builder;
      }),
    } as unknown as SupabaseClient;
    await expect(assertServerRoleOperation(client, userId, { filename: "src/lib/assessment.functions.ts", name: "deleteAssessment" }, {})).rejects.toThrow("delete access");
  });
});