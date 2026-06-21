import { createFileRoute } from "@tanstack/react-router";
import { IdeShell } from "../components/ide/IdeShell";
import { parseIdeRouteSearch } from "./_chat.ide.search";

function IdeRoute() {
  const { environmentId, workspaceRoot, filePath } = Route.useSearch();
  return (
    <IdeShell
      environmentIdOverride={environmentId ?? null}
      workspaceRootOverride={workspaceRoot ?? null}
      initialFilePath={filePath ?? null}
    />
  );
}

export const Route = createFileRoute("/_chat/ide")({
  validateSearch: parseIdeRouteSearch,
  component: IdeRoute,
});
