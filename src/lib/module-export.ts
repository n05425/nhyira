import { toast } from "sonner";
import { authorizeModuleExport } from "@/lib/role-governance.functions";

/** All app export controls recheck the current account's saved grants before producing a file. */
export async function permitModuleExport(): Promise<boolean> {
  const moduleId = window.location.pathname.match(/^\/portal\/([^/]+)\/?$/)?.[1];
  if (!moduleId) { toast.error("Open a module before exporting records."); return false; }
  try {
    await authorizeModuleExport({ data: { moduleId } });
    return true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Export permission could not be verified.");
    return false;
  }
}