import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock, Plus, RefreshCw, Save, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRoleGovernance, mutateRoleGovernance, type RoleGovernanceMutation } from "@/lib/role-governance.functions";
import { ACCESS_OPERATIONS, OPERATION_LABELS, setModuleGrant, managedRoleSchema, type ManagedRole } from "@/lib/role-governance";
import { MODULES, ROLES, ROLE_META, canAccess } from "@/lib/access";

const OPERATION_LABEL = OPERATION_LABELS;
type BaseRole = ManagedRole["baseRole"];

export function RolePermissionManager() {
  const client = useQueryClient();
  const fetchRoles = useServerFn(getRoleGovernance);
  const mutate = useServerFn(mutateRoleGovernance);
  const query = useQuery({ queryKey: ["role-governance"], queryFn: () => fetchRoles() });
  const [selected, setSelected] = useState("staff");
  const [draft, setDraft] = useState<ManagedRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseRole, setBaseRole] = useState<BaseRole>("staff");
  const [accountId, setAccountId] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const role = query.data?.roles.find((r) => r.id === selected);
    setDraft(role ? { ...role, grants: role.grants.map((g) => ({ ...g })) } : null);
    setDirty(false);
    setAccountId("");
  }, [query.data, selected]);

  async function perform(data: RoleGovernanceMutation, success: string) {
    setBusy(true);
    try {
      await mutate({ data });
      await Promise.all([
        client.invalidateQueries({ queryKey: ["role-governance"] }),
        client.invalidateQueries({ queryKey: ["my-role-access"] }),
        client.invalidateQueries({ queryKey: ["people-settings"] }),
      ]);
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save role access.");
      return false;
    } finally { setBusy(false); }
  }

  const chooseRole = (id: string) => {
    if (dirty && !window.confirm("Discard the unsaved role changes?")) return;
    setSelected(id);
  };

  if (query.isPending) return <p className="text-sm text-muted-foreground">Loading roles and permissions…</p>;
  if (query.isError || !query.data) return (
    <div role="alert" className="space-y-3 border border-destructive/30 rounded-md p-5">
      <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Role management is unavailable."}</p>
      <Button variant="outline" onClick={() => void query.refetch()}><RefreshCw className="size-4" /> Retry</Button>
    </div>
  );

  const data = query.data;
  const builtIn = ROLES.some((id) => id === selected);
  const availableModules = draft ? MODULES.filter((m) => canAccess(draft.baseRole, ROLE_META[draft.baseRole].accessLevel, m.id)) : [];
  const visibleModules = availableModules.filter((m) => `${m.name} ${m.category}`.toLowerCase().includes(filter.toLowerCase()));
  const assignments = data.governance.assignments.filter((a) => a.roleId === selected);
  const eligibleAccounts = data.accounts.filter((a) => draft && a.status === "active" && a.roles.includes(draft.baseRole) && !a.roles.includes("super_admin"));
  const changeDraft = (next: ManagedRole) => { setDraft(next); setDirty(true); };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold">Roles & permissions</h2><p className="text-sm text-muted-foreground">{data.schoolName}</p></div>
      <div className="flex gap-2">
        <Button variant="outline" size="icon" title="Reload roles" aria-label="Reload roles" disabled={busy} onClick={() => {
          if (!dirty || window.confirm("Discard changes and reload roles?")) void query.refetch();
        }}><RefreshCw className="size-4" /></Button>
        <Button onClick={() => setCreateOpen(true)} disabled={busy}><Plus className="size-4" /> Create role</Button>
      </div>
    </div>

    <div className="flex items-center gap-3 border-l-2 border-primary bg-muted/40 p-4 text-sm">
      <Lock className="size-5 shrink-0 text-primary" /><div><b>Super Admin</b><span className="ml-2 text-muted-foreground">Protected · full administration</span></div>
    </div>

    <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
      <nav aria-label="Role selection" className="space-y-1">
        {data.roles.map((role) => <Button key={role.id} variant={selected === role.id ? "secondary" : "ghost"}
          className="h-auto min-h-12 w-full justify-start gap-3 py-3 text-left" disabled={busy} onClick={() => chooseRole(role.id)}>
          <ShieldCheck className="size-4 shrink-0" /><span className="min-w-0 break-words whitespace-normal"><span className="block">{role.name}</span>
          <span className="block text-xs font-normal text-muted-foreground">{ROLES.some((r) => r === role.id) ? "Built-in" : "Custom"} · {role.status}</span></span>
        </Button>)}
      </nav>

      {draft && <div className="min-w-0 space-y-6">
        <section className="space-y-4 border-b border-border pb-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{draft.name}</h3>
            <div className="flex items-center gap-2">
              {dirty && <span className="text-xs text-warning">Unsaved changes</span>}
              <Button disabled={busy || !dirty} onClick={() => {
                const result = managedRoleSchema.safeParse(draft);
                if (!result.success) { toast.error(result.error.issues[0]?.message ?? "Invalid role."); return; }
                void perform({ action: "update", expectedVersion: data.version, role: result.data }, "Role and permissions saved.");
              }}><Save className="size-4" /> Save</Button>
              {!builtIn && <Button variant="outline" size="icon" title="Delete custom role" aria-label="Delete custom role" disabled={busy || assignments.length > 0}
                onClick={async () => {
                  if (!window.confirm(`Permanently delete ${draft.name}?`)) return;
                  if (await perform({ action: "delete", expectedVersion: data.version, roleId: draft.id }, "Custom role deleted.")) setSelected("staff");
                }}><Trash2 className="size-4 text-destructive" /></Button>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="role-name">Role name</Label><Input id="role-name" value={draft.name} maxLength={100} disabled={busy} onChange={(e) => changeDraft({ ...draft, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Existing access role</Label><Select value={draft.baseRole} disabled={busy || builtIn || assignments.length > 0}
              onValueChange={(value) => changeDraft({ ...draft, baseRole: value as BaseRole, grants: [] })}>
              <SelectTrigger aria-label="Existing access role"><SelectValue /></SelectTrigger><SelectContent>{ROLES.filter((r) => r !== "super_admin").map((r) => <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>)}</SelectContent>
            </Select></div>
          </div>
          <div className="space-y-2"><Label htmlFor="role-description">Description</Label><Textarea id="role-description" value={draft.description} maxLength={500} disabled={busy} onChange={(e) => changeDraft({ ...draft, description: e.target.value })} /></div>
          {!builtIn && <div className="flex items-center gap-3"><Checkbox id="role-active" checked={draft.status === "active"} disabled={busy} onCheckedChange={(checked) => changeDraft({ ...draft, status: checked === true ? "active" : "inactive" })} /><Label htmlFor="role-active">Active role</Label></div>}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Allowed operations</h3><Input className="w-full sm:w-60" aria-label="Filter permission modules" placeholder="Find module…" value={filter} onChange={(e) => setFilter(e.target.value)} /></div>
          <div className="overflow-x-auto rounded-md border border-border">
            <Table className="min-w-[650px]"><TableHeader><TableRow><TableHead className="min-w-48">Module</TableHead>
              {ACCESS_OPERATIONS.map((op) => <TableHead key={op} className="w-16 text-center">{OPERATION_LABEL[op]}</TableHead>)}
            </TableRow></TableHeader><TableBody>{visibleModules.map((m) => <TableRow key={m.id}>
              <TableCell><span className="block font-medium">{m.name}</span><span className="text-xs text-muted-foreground">{m.category}</span></TableCell>
              {ACCESS_OPERATIONS.map((op) => <TableCell key={op} className="text-center"><Checkbox aria-label={`${OPERATION_LABEL[op]} ${m.name}`} disabled={busy}
                checked={draft.grants.some((g) => g.resource === m.id && g.action === op)} onCheckedChange={(checked) => {
                  changeDraft(setModuleGrant(draft, m.id, op, checked === true));
                }} /></TableCell>)}
            </TableRow>)}{!visibleModules.length && <TableRow><TableCell colSpan={ACCESS_OPERATIONS.length + 1} className="text-center text-muted-foreground">No matching modules.</TableCell></TableRow>}</TableBody></Table>
          </div>
        </section>

        {!builtIn && <section className="space-y-4 border-t border-border pt-6">
          <h3 className="font-semibold">Account assignments ({assignments.length})</h3>
          <div className="flex flex-wrap gap-3"><Select value={accountId} onValueChange={setAccountId} disabled={busy || draft.status !== "active"}>
            <SelectTrigger className="w-full sm:w-80" aria-label="Account for custom role"><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{eligibleAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>)}</SelectContent>
          </Select><Button disabled={busy || dirty || !accountId || draft.status !== "active"} onClick={async () => {
            if (await perform({ action: "assign", expectedVersion: data.version, userId: accountId, roleId: selected }, "Custom role assigned.")) setAccountId("");
          }}><UserPlus className="size-4" /> Assign role</Button></div>
          <ul className="divide-y divide-border">{assignments.map((a) => {
            const account = data.accounts.find((v) => v.id === a.userId);
            return <li key={a.userId} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><b className="block break-words text-sm">{account?.full_name ?? "Unavailable account"}</b><span className="block break-all text-xs text-muted-foreground">{account?.email}</span></div>
              <Button variant="outline" size="icon" aria-label={`Remove role from ${account?.full_name ?? "account"}`} title="Remove role assignment" disabled={busy || dirty}
                onClick={() => void perform({ action: "unassign", expectedVersion: data.version, userId: a.userId }, "Custom role assignment removed.")}><Trash2 className="size-4" /></Button></li>;
          })}</ul>
          {!assignments.length && <p className="text-sm text-muted-foreground">No accounts assigned.</p>}
        </section>}
      </div>}
    </div>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Create custom role</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        const role = managedRoleSchema.safeParse({ id: crypto.randomUUID(), name, description, baseRole, status: "active", grants: [] });
        if (!role.success) { toast.error(role.error.issues[0]?.message ?? "Invalid role."); return; }
        if (await perform({ action: "create", expectedVersion: data.version, role: role.data }, "Custom role created.")) {
          setSelected(role.data.id); setCreateOpen(false); setName(""); setDescription("");
        }
      }}>
        <div className="space-y-2"><Label htmlFor="new-role-name">Role name</Label><Input id="new-role-name" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="new-role-description">Description</Label><Textarea id="new-role-description" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="space-y-2"><Label>Existing access role</Label><Select value={baseRole} onValueChange={(v) => setBaseRole(v as BaseRole)}><SelectTrigger aria-label="New role existing access"><SelectValue /></SelectTrigger><SelectContent>{ROLES.filter((r) => r !== "super_admin").map((r) => <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>)}</SelectContent></Select></div>
        <Button type="submit" disabled={busy} className="w-full"><Plus className="size-4" /> Create role</Button>
      </form>
    </DialogContent></Dialog>
  </div>;
}