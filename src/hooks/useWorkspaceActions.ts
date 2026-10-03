import { useCallback, useRef } from "react";
import { applyWorkspaceCommand } from "@/lib/workspace-mutations";
import type { WorkspaceCommand, WorkspaceCommandType } from "@/lib/workspace";
import type { SyncState } from "@/lib/sync";
import { saveWorkspaceCache, emptyMetadata } from "@/lib/workspace-cache";
import { toast } from "sonner";
const intent = (command: Omit<WorkspaceCommand, "id">) =>
  JSON.stringify([
    command.type,
    command.matchId,
    command.seasonId,
    command.expectedRevision,
    command.payload,
    command.timeZone,
  ]);
export function useWorkspaceActions(
  state: SyncState,
  local: boolean,
  apply: (state: SyncState) => void,
  execute: (command: WorkspaceCommand) => Promise<boolean>,
  failed: WorkspaceCommand | null,
) {
  const current = useRef({ state, local, apply, execute, failed });
  current.current = { state, local, apply, execute, failed };
  return useCallback(
    async (
      type: WorkspaceCommandType,
      payload: Record<string, unknown> = {},
      targets: Pick<WorkspaceCommand, "matchId" | "seasonId" | "expectedRevision"> = {},
    ): Promise<boolean> => {
      const props = current.current;
      const content = {
        type,
        payload,
        ...targets,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      const command: WorkspaceCommand =
        props.failed && intent(props.failed) === intent(content)
          ? props.failed
          : {
              ...content,
              occurredAt: Date.now(),
              id:
                globalThis.crypto?.randomUUID?.() ??
                `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`,
            };
      if (!props.local) return props.execute(command);
      try {
        const result = applyWorkspaceCommand(props.state, command);
        props.state = result.state;
        props.apply(result.state);
        saveWorkspaceCache({
          credential: "",
          workspaceId: "local",
          role: "editor",
          state: result.state,
          metadata: emptyMetadata(),
        });
        return true;
      } catch (error) {
        toast.error((error as Error).message);
        return false;
      }
    },
    [],
  );
}
