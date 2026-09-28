import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearViewerTokenFromUrl,
  createViewerLink,
  getViewerTokenFromUrl,
  validateViewerLink,
} from "./share";

describe("viewer links", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("keeps the viewer credential in the URL fragment and encodes it", () => {
    const link = createViewerLink("https://example.com/app?source=test", "secret+/=");
    expect(new URL(link).search).toBe("?source=test");
    expect(getViewerTokenFromUrl(link)).toBe("secret+/=");
    expect(link).not.toContain("editor-token");
  });

  it("clears only the viewer fragment parameter after import", () => {
    expect(clearViewerTokenFromUrl("https://example.com/app?x=1#viewer=secret&other=value")).toBe(
      "https://example.com/app?x=1#other=value",
    );
  });

  it("validates the viewer token and keeps a separately validated editor credential", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { headers: { "X-Workspace-Role": "viewer" } }))
      .mockResolvedValueOnce(new Response("{}", { headers: { "X-Workspace-Role": "editor" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(validateViewerLink("viewer-token", "editor-token")).resolves.toBe("editor-token");
  });

  it("rejects invalid viewer links without selecting a replacement credential", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 })),
    );
    await expect(validateViewerLink("bad-token", "saved-token")).rejects.toMatchObject({
      status: 401,
    });
  });

  it("does not replace an editor credential when its validation service is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { headers: { "X-Workspace-Role": "viewer" } }))
        .mockResolvedValueOnce(new Response("Unavailable", { status: 503 })),
    );
    await expect(validateViewerLink("viewer-token", "saved-editor")).rejects.toMatchObject({
      status: 503,
    });
  });

  it("uses the viewer link when the saved credential is explicitly revoked", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { headers: { "X-Workspace-Role": "viewer" } }))
        .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 })),
    );
    await expect(validateViewerLink("viewer-token", "revoked-editor")).resolves.toBe(
      "viewer-token",
    );
  });
});
