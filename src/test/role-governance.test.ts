import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACCESS_OPERATIONS, assertGrantDependencies, defaultManagedRole, deleteManagedRole, managedRoleSchema, operationAllowed, roleGovernanceSchema, setModuleGrant, type RoleGovernance } from "@/lib/role-governance";
import { defaultPeopleRules, peopleRulesSchema } from "@/lib/people-rules";
import { assertSuperAdmin } from "@/lib/admin.server";
import { assertRoleOperations, assertServerRoleOperation } from "@/lib/role-access.server";
import { financePermissionResource, OPERATION_EXEMPTIONS, SERVER_OPERATIONS, serverOperation } from "@/lib/role-operations";

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
  it("revoking module view also blocks direct writes with a retained write grant", () => {
    const governance: RoleGovernance = { ...assigned, roles: [{ ...custom, grants: [{ resource: "assessment", action: "update" }] }] };
    expect(operationAllowed(governance, userId, ["staff"], "standard", "assessment", "update")).toBe(false);
    governance.roles[0]?.grants.push({ resource: "assessment", action: "read" });
    expect(operationAllowed(governance, userId, ["staff"], "standard", "assessment", "update")).toBe(true);
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
  it("applies report permissions even when function metadata carries an extraction suffix", () => {
    expect(serverOperation({ filename: "src/lib/reports.functions.ts?tsr-split", name: "getTermlyReport" }, {}))
      .toEqual({ resource: "termly-reports", actions: ["read"] });
  });
  it("identifies reads, writes and deletion independently of caller input", () => {
    expect(serverOperation({ filename: "src/lib/assessment.functions.ts", name: "deleteAssessment" }, { resource: "dashboard", action: "read" })).toEqual({ resource: "assessment", actions: ["delete"] });
  });
  it("ID editors distinguish Add from Edit, including assessments and finance rules", () => {
    const meta = { filename: "src/lib/assignments.functions.ts", name: "saveAssignment" };
    expect(serverOperation(meta, {})?.actions).toEqual(["create"]);
    expect(serverOperation(meta, { id: "existing" })?.actions).toEqual(["update"]);
    expect(serverOperation({ filename: "src/lib/assessment.functions.ts", name: "saveAssessment" }, {})?.actions).toEqual(["create"]);
    expect(serverOperation({ filename: "src/lib/assessment.functions.ts", name: "saveAssessment" }, { id: "existing" })?.actions).toEqual(["update"]);
    expect(serverOperation({ filename: "src/lib/finance-config.functions.ts", name: "saveFinanceRule" }, { ruleKey: "retention-policies" })?.actions).toEqual(["create"]);
    expect(serverOperation({ filename: "src/lib/finance-config.functions.ts", name: "saveFinanceRule" }, { ruleKey: "retention-policies", id: "existing" })?.actions).toEqual(["update"]);
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

function permissionClient(governance: RoleGovernance) {
  const client = {
    rpc: vi.fn().mockResolvedValue({ data: "school-a", error: null }),
    from: vi.fn((table: string) => {
      const result = table === "user_roles" ? { data: [{ role: "staff" }], error: null }
        : table === "profiles" ? { data: { access_level: "standard", status: "active" }, error: null }
        : table === "schools" ? { data: { id: "school-a" }, error: null }
        : { data: { features: { __people_rules: { accessGovernance: governance } } }, error: null };
      const builder = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(result), then: (resolveValue: (value: unknown) => void) => Promise.resolve(result).then(resolveValue) };
      builder.select.mockReturnValue(builder); builder.eq.mockReturnValue(builder);
      return builder;
    }),
  };
  return client as unknown as SupabaseClient;
}

describe("five independent operation permissions", () => {
  for (const action of ACCESS_OPERATIONS) {
    it(`granting ${action} never grants any other operation`, () => {
      const role = setModuleGrant({ ...custom, grants: [] }, "assessment", action, true);
      const governance: RoleGovernance = { roles: [role], assignments: assigned.assignments };
      for (const candidate of ACCESS_OPERATIONS)
        expect(operationAllowed(governance, userId, ["staff"], "standard", "assessment", candidate)).toBe(candidate === "read" || candidate === action);
    });
  }
  it("revoking View removes Add, Edit, Delete and Export for that module only", () => {
    const role = setModuleGrant(defaultManagedRole("staff"), "assessment", "read", false);
    expect(role.grants.filter((g) => g.resource === "assessment")).toEqual([]);
    expect(role.grants.some((g) => g.resource === "assignments")).toBe(true);
  });
  it("permission updates apply immediately to an existing assignment", () => {
    const role = setModuleGrant(custom, "assessment", "update", true);
    const governance = { ...assigned, roles: [role] };
    expect(operationAllowed(governance, userId, ["staff"], "standard", "assessment", "update")).toBe(true);
    governance.roles = [setModuleGrant(role, "assessment", "update", false)];
    expect(operationAllowed(governance, userId, ["staff"], "standard", "assessment", "update")).toBe(false);
    expect(governance.assignments).toEqual(assigned.assignments);
  });
  it("rejects inconsistent permission updates or assignments without View", () => {
    expect(() => assertGrantDependencies({ ...custom, grants: [{ resource: "assessment", action: "create" }] })).toThrow("View permission");
    expect(() => assertGrantDependencies(custom)).not.toThrow();
  });
  it("supports independent Export permission outside Archives", () => {
    const role = setModuleGrant(custom, "assessment", "export", true);
    expect(managedRoleSchema.safeParse(role).success).toBe(true);
    expect(operationAllowed({ ...assigned, roles: [role] }, userId, ["staff"], "standard", "assessment", "export")).toBe(true);
    expect(operationAllowed(assigned, userId, ["staff"], "standard", "assessment", "export")).toBe(false);
  });
  it("requires both permissions for a mixed attendance register, but not for a new-only register", async () => {
    const role = setModuleGrant({ ...custom, grants: [] }, "attendance", "create", true);
    const client = permissionClient({ roles: [role], assignments: assigned.assignments });
    await expect(assertRoleOperations(client, userId, [{ resource: "attendance", actions: ["create"] }])).resolves.toBeUndefined();
    await expect(assertRoleOperations(client, userId, [{ resource: "attendance", actions: ["create", "update"] }])).rejects.toThrow("update access");
  });
  it("rejects Export at the server for a View-only account", async () => {
    await expect(assertRoleOperations(permissionClient(assigned), userId, [{ resource: "assessment", actions: ["export"] }])).rejects.toThrow("export access");
  });
  it("rejects unregistered authenticated operations rather than skipping the guard", async () => {
    await expect(assertServerRoleOperation(permissionClient(assigned), userId, { filename: "src/lib/new.functions.ts", name: "deleteRecord" }, {})).rejects.toThrow("no registered permission");
  });
  for (const [stem, name] of [["assignments", "gradeSubmission"], ["assignments", "reviewRegradeRequest"], ["exams", "syncExamToAssessment"]]) {
    it(`blocks assessment creation through ${stem}:${name} when Assessment/Add is denied`, async () => {
      const role = setModuleGrant(setModuleGrant(custom, "assignments", "update", true), "exams-quizzes", "read", true);
      const client = permissionClient({ ...assigned, roles: [role] });
      await expect(assertServerRoleOperation(client, userId, { filename: `src/lib/${stem}.functions.ts`, name: name ?? "" }, { syncToAssessment: true })).rejects.toThrow("create access to assessment");
    });
  }
  it("classifies insert-only imports, submissions and groups as Add", () => {
    for (const [stem, name] of [["admin", "bulkImportAccounts"], ["finance", "importStaffPayroll"], ["assignments", "submitAssignment"], ["assignments", "manageAssignmentGroups"]])
      expect(serverOperation({ filename: `src/lib/${stem}.functions.ts`, name: name ?? "" }, {})?.actions).toEqual(["create"]);
  });
  it("editing singleton settings requires Edit, not Add", () => {
    expect(serverOperation({ filename: "src/lib/admin.functions.ts", name: "saveSecuritySettings" }, {})?.actions).toEqual(["update"]);
    expect(serverOperation({ filename: "src/lib/performance-tracker.functions.ts", name: "updatePerformanceRiskRules" }, {})?.actions).toEqual(["update"]);
    expect(serverOperation({ filename: "src/lib/config.functions.ts", name: "savePeopleSettings" }, {})?.actions).toEqual(["update"]);
  });
  it("uses canonical Reporting ownership rather than Financial permissions", () => {
    expect(financePermissionResource("retention-policies")).toBe("reporting-configuration");
    expect(serverOperation({ filename: "src/lib/finance-config.functions.ts", name: "getFinanceConfiguration" }, { owner: "reporting-configuration" })?.resource).toBe("reporting-configuration");
    expect(serverOperation({ filename: "src/lib/finance-config.functions.ts", name: "saveFinanceRule" }, { ruleKey: "retention-policies" })?.resource).toBe("reporting-configuration");
  });
  it("covers every authenticated function with a registered policy or explicit exemption", () => {
    const directory = resolve("src/lib");
    const missing: string[] = [];
    let checked = 0;
    for (const file of readdirSync(directory).filter((f) => f.endsWith(".functions.ts"))) {
      const source = readFileSync(resolve(directory, file), "utf8");
      for (const match of source.matchAll(/export const (\w+) = createServerFn/g)) {
        const start = (match.index ?? 0) + match[0].length;
        const handler = source.indexOf(".handler", start);
        if (!source.slice(start, handler).includes("requireSupabaseAuth")) continue;
        checked++;
        const key = `${file.replace(".functions.ts", "")}:${match[1]}`;
        if (!SERVER_OPERATIONS[key] && !OPERATION_EXEMPTIONS.has(key)) missing.push(key);
      }
    }
    expect(checked).toBeGreaterThan(180);
    expect(missing).toEqual([]);
  });
});