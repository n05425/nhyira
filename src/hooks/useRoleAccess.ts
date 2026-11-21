import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRoleAccess } from "@/lib/role-governance.functions";
import { useSession } from "@/hooks/useSession";
import type { AccessOperation } from "@/lib/role-governance";

export function useRoleAccess() {
  const { profile } = useSession();
  const fetchAccess = useServerFn(getMyRoleAccess);
  const result = useQuery({
    queryKey: ["my-role-access", profile?.id],
    queryFn: () => fetchAccess(), enabled: !!profile, staleTime: 0, refetchInterval: 30_000,
  });
  return {
    ...result,
    allows: (moduleId: string, action: AccessOperation = "read") =>
      Boolean(result.data?.operations.find((o) => o.moduleId === moduleId)?.actions.includes(action)),
  };
}