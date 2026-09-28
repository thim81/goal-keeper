import { fetchRemoteState } from "@/lib/sync";

export function createViewerLink(base: string, viewerToken: string): string {
  const url = new URL(base);
  url.hash = new URLSearchParams({ viewer: viewerToken }).toString();
  return url.toString();
}

export async function validateViewerLink(
  viewerToken: string,
  existingToken: string,
): Promise<string> {
  const imported = await fetchRemoteState(viewerToken);
  if (imported.role !== "viewer") throw new Error("This link is not view-only");
  if (existingToken && existingToken !== viewerToken) {
    try {
      const existing = await fetchRemoteState(existingToken);
      if (existing.role === "editor") return existingToken;
    } catch (error) {
      if ((error as { status?: number }).status !== 401) throw error;
    }
  }
  return viewerToken;
}

export function getViewerTokenFromUrl(url: string): string | null {
  return new URLSearchParams(new URL(url).hash.slice(1)).get("viewer");
}

export function clearViewerTokenFromUrl(url: string): string {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.hash.slice(1));
  params.delete("viewer");
  parsed.hash = params.toString();
  return parsed.toString();
}
