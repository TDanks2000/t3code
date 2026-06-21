export interface IdeRouteSearch {
  environmentId?: string;
  workspaceRoot?: string;
  filePath?: string;
}

export function parseIdeRouteSearch(search: Record<string, unknown>): IdeRouteSearch {
  const result: IdeRouteSearch = {};
  if (typeof search.environmentId === "string" && search.environmentId.length > 0) {
    result.environmentId = search.environmentId;
  }
  if (typeof search.workspaceRoot === "string" && search.workspaceRoot.length > 0) {
    result.workspaceRoot = search.workspaceRoot;
  }
  if (typeof search.filePath === "string" && search.filePath.length > 0) {
    result.filePath = search.filePath;
  }
  return result;
}
