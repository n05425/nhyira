import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/role-governance.functions", () => ({ authorizeModuleExport: mocks.authorize }));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));

import { permitModuleExport } from "@/lib/module-export";
import { downloadCsv, downloadRecordsCsv } from "@/lib/csv";
import { printDocument } from "@/lib/print-document";

describe("fresh Export authorization for application output", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.history.replaceState({}, "", "/portal/assessment");
  });
  it("checks the actual open module with the server before permitting output", async () => {
    mocks.authorize.mockResolvedValue({ allowed: true });
    expect(await permitModuleExport()).toBe(true);
    expect(mocks.authorize).toHaveBeenCalledWith({ data: { moduleId: "assessment" } });
  });
  it("rechecks saved permission on every export so revocation takes effect without a reload", async () => {
    mocks.authorize.mockResolvedValueOnce({ allowed: true }).mockRejectedValueOnce(new Error("Export denied"));
    expect(await permitModuleExport()).toBe(true);
    expect(await permitModuleExport()).toBe(false);
    expect(mocks.authorize).toHaveBeenCalledTimes(2);
  });
  it("denies output if authorization is unavailable", async () => {
    mocks.authorize.mockRejectedValue(new Error("Unavailable"));
    expect(await permitModuleExport()).toBe(false);
  });
  it("does not create downloadable files or print frames without Export", async () => {
    mocks.authorize.mockRejectedValue(new Error("Export denied"));
    const create = vi.spyOn(document, "createElement");
    await downloadCsv("scores.csv", [["score"], [90]]);
    await downloadRecordsCsv("scores.csv", [{ score: 90 }]);
    await printDocument(document.body, "Scores");
    expect(create).not.toHaveBeenCalled();
    expect(mocks.authorize).toHaveBeenCalledTimes(3);
    create.mockRestore();
  });
  it("never guesses a module outside the portal", async () => {
    window.history.replaceState({}, "", "/");
    expect(await permitModuleExport()).toBe(false);
    expect(mocks.authorize).not.toHaveBeenCalled();
  });
});