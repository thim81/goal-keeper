import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "@/components/SettingsScreen";
import { DEFAULT_SETTINGS } from "@/types/match";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const shareDescriptor = Object.getOwnPropertyDescriptor(navigator, "share");
afterEach(() => {
  for (const [key, descriptor] of [
    ["clipboard", clipboardDescriptor],
    ["share", shareDescriptor],
  ] as const) {
    if (descriptor) Object.defineProperty(navigator, key, descriptor);
    else Reflect.deleteProperty(navigator, key);
  }
  vi.clearAllMocks();
});

function renderSettings() {
  const onUpdateCalendarSettings = vi.fn();
  render(
    <SettingsScreen
      settings={{ ...DEFAULT_SETTINGS }}
      onBack={vi.fn()}
      onUpdateTeamName={vi.fn()}
      onUpdateCalendarSettings={onUpdateCalendarSettings}
      onAddPlayer={vi.fn()}
      onRemovePlayer={vi.fn()}
      onUpdatePeriods={vi.fn()}
      onUpdateSyncToken={vi.fn()}
      onUpdateTheme={vi.fn()}
      onUpdateDebug={vi.fn()}
      onExportBackup={vi.fn()}
      onImportBackup={vi.fn()}
    />,
  );
  return onUpdateCalendarSettings;
}

describe("SettingsScreen calendar settings", () => {
  it("saves the URL and calendar team name on blur", () => {
    const onUpdateCalendarSettings = renderSettings();

    fireEvent.change(screen.getByPlaceholderText("Paste ProSoccerData subscription URL"), {
      target: { value: "https://club.prosoccerdata.com/api/v2/members/ics/file?id=1&uuid=x" },
    });
    fireEvent.change(screen.getByPlaceholderText("Detected automatically, for example IPU15"), {
      target: { value: "IPU15" },
    });
    fireEvent.blur(screen.getByPlaceholderText("Detected automatically, for example IPU15"));

    expect(onUpdateCalendarSettings).toHaveBeenCalledWith(
      "https://club.prosoccerdata.com/api/v2/members/ics/file?id=1&uuid=x",
      "IPU15",
    );
  });

  it("resyncs the local team field when settings change while the screen is open", () => {
    const onUpdateCalendarSettings = vi.fn();
    const view = render(
      <SettingsScreen
        settings={{ ...DEFAULT_SETTINGS, calendarTeamName: "" }}
        onBack={vi.fn()}
        onUpdateTeamName={vi.fn()}
        onUpdateCalendarSettings={onUpdateCalendarSettings}
        onAddPlayer={vi.fn()}
        onRemovePlayer={vi.fn()}
        onUpdatePeriods={vi.fn()}
        onUpdateSyncToken={vi.fn()}
        onUpdateTheme={vi.fn()}
        onUpdateDebug={vi.fn()}
        onExportBackup={vi.fn()}
        onImportBackup={vi.fn()}
      />,
    );

    view.rerender(
      <SettingsScreen
        settings={{ ...DEFAULT_SETTINGS, calendarTeamName: "IPU15" }}
        onBack={vi.fn()}
        onUpdateTeamName={vi.fn()}
        onUpdateCalendarSettings={onUpdateCalendarSettings}
        onAddPlayer={vi.fn()}
        onRemovePlayer={vi.fn()}
        onUpdatePeriods={vi.fn()}
        onUpdateSyncToken={vi.fn()}
        onUpdateTheme={vi.fn()}
        onUpdateDebug={vi.fn()}
        onExportBackup={vi.fn()}
        onImportBackup={vi.fn()}
      />,
    );

    fireEvent.blur(screen.getByPlaceholderText("Paste ProSoccerData subscription URL"));

    expect(onUpdateCalendarSettings).toHaveBeenCalledWith("", "IPU15");
  });
});

function renderFullSettings(settingsOverrides: Partial<typeof DEFAULT_SETTINGS> = {}) {
  const handlers = {
    onBack: vi.fn(),
    onUpdateTeamName: vi.fn(),
    onUpdateCalendarSettings: vi.fn(),
    onAddPlayer: vi.fn(),
    onRemovePlayer: vi.fn(),
    onUpdatePeriods: vi.fn(),
    onUpdateSyncToken: vi.fn(),
    onUpdateTheme: vi.fn(),
    onUpdateDebug: vi.fn(),
    onExportBackup: vi.fn(),
    onImportBackup: vi.fn(),
  };
  render(<SettingsScreen settings={{ ...DEFAULT_SETTINGS, ...settingsOverrides }} {...handlers} />);
  return handlers;
}

function renderSharingSettings({
  viewerLink = "",
  onLoadViewerLink,
}: {
  viewerLink?: string;
  onLoadViewerLink: () => Promise<string>;
}) {
  render(
    <SettingsScreen
      settings={{ ...DEFAULT_SETTINGS, syncToken: "editor-token" }}
      onBack={vi.fn()}
      onUpdateTeamName={vi.fn()}
      onUpdateCalendarSettings={vi.fn()}
      onAddPlayer={vi.fn()}
      onRemovePlayer={vi.fn()}
      onUpdatePeriods={vi.fn()}
      onUpdateSyncToken={vi.fn()}
      onUpdateTheme={vi.fn()}
      onUpdateDebug={vi.fn()}
      onExportBackup={vi.fn()}
      onImportBackup={vi.fn()}
      syncStatus="editor"
      viewerLink={viewerLink}
      onLoadViewerLink={onLoadViewerLink}
    />,
  );
}

describe("SettingsScreen interactions", () => {
  it("copies a freshly loaded link on the same retry click after prefetch fails", async () => {
    const link = "https://example.test/#viewer=share-token";
    const onLoadViewerLink = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(link);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderSharingSettings({ onLoadViewerLink });

    const copy = screen.getByRole("button", { name: "Copy Link" });
    await waitFor(() => expect(copy).toBeEnabled());
    fireEvent.click(copy);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(link);
    expect(onLoadViewerLink).toHaveBeenCalledTimes(2);
  });

  it("shares a prefetched link and keeps cancellation quiet", async () => {
    const link = "https://example.test/#viewer=share-token";
    const share = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("cancel"), { name: "AbortError" }));
    const onLoadViewerLink = vi.fn().mockResolvedValue(link);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    renderSharingSettings({ viewerLink: link, onLoadViewerLink });

    fireEvent.click(screen.getByRole("button", { name: "Share workspace" }));
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        title: "Goal Keeper",
        text: "View-only match access",
        url: link,
      }),
    );
    const { toast } = await import("sonner");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("hides workspace mutations and backup tools in viewer mode while keeping theme local", () => {
    render(
      <SettingsScreen
        settings={{ ...DEFAULT_SETTINGS, syncToken: "viewer" }}
        {...{
          onBack: vi.fn(),
          onUpdateTeamName: vi.fn(),
          onUpdateCalendarSettings: vi.fn(),
          onAddPlayer: vi.fn(),
          onRemovePlayer: vi.fn(),
          onUpdatePeriods: vi.fn(),
          onUpdateSyncToken: vi.fn(),
          onUpdateTheme: vi.fn(),
          onUpdateDebug: vi.fn(),
          onExportBackup: vi.fn(),
          onImportBackup: vi.fn(),
          canEdit: false,
          syncStatus: "viewer",
          lastSyncedAt: null,
          viewerLink: "",
          onLoadViewerLink: vi.fn(),
        }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Viewer");
    expect(screen.getByText("Team Name")).toBeInTheDocument();
    expect(screen.getByText("My Team")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Enter your team name")).not.toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter sync token")).toBeInTheDocument();
    expect(screen.queryByText("Start New Match")).not.toBeInTheDocument();
    expect(screen.queryByText("Export")).not.toBeInTheDocument();
    expect(screen.queryByText("Paste ProSoccerData subscription URL")).not.toBeInTheDocument();
    expect(screen.queryByText("Share workspace")).not.toBeInTheDocument();
  });

  it("saves the team name on blur only when it actually changed", () => {
    const handlers = renderFullSettings({ teamName: "My Team" });
    const teamNameInput = screen.getByPlaceholderText("Enter your team name");

    fireEvent.blur(teamNameInput);
    expect(handlers.onUpdateTeamName).not.toHaveBeenCalled();

    fireEvent.change(teamNameInput, { target: { value: "New Team" } });
    fireEvent.blur(teamNameInput);
    expect(handlers.onUpdateTeamName).toHaveBeenCalledWith("New Team");
  });

  it("updates periods count and duration while preserving the other value", () => {
    const handlers = renderFullSettings({ periodsCount: 4, periodDuration: 20 });

    fireEvent.change(screen.getByDisplayValue("4 periods"), { target: { value: "2" } });
    expect(handlers.onUpdatePeriods).toHaveBeenCalledWith(2, 20);

    fireEvent.change(screen.getByDisplayValue("20 min"), { target: { value: "30" } });
    expect(handlers.onUpdatePeriods).toHaveBeenCalledWith(4, 30);
  });

  it("adds a player and clears the input", () => {
    const handlers = renderFullSettings();
    const input = screen.getByPlaceholderText("Add player name");
    const addButton = input.closest("div")!.querySelector("button")!;

    fireEvent.change(input, { target: { value: "Alice" } });
    fireEvent.click(addButton);

    expect(handlers.onAddPlayer).toHaveBeenCalledWith("Alice");
  });

  it("removes a player from the list", () => {
    const handlers = renderFullSettings({ players: ["Alice", "Bob"] });

    const aliceRow = screen.getByText("Alice").closest("div") as HTMLElement;
    fireEvent.click(aliceRow.querySelector("button")!);

    expect(handlers.onRemovePlayer).toHaveBeenCalledWith("Alice");
  });

  it("switches themes", () => {
    const handlers = renderFullSettings({ theme: "system" });

    fireEvent.click(screen.getByText("Dark"));
    expect(handlers.onUpdateTheme).toHaveBeenCalledWith("dark");

    fireEvent.click(screen.getByText("Light"));
    expect(handlers.onUpdateTheme).toHaveBeenCalledWith("light");
  });

  it("toggles debug mode", () => {
    const handlers = renderFullSettings({ debug: false });

    fireEvent.click(screen.getByText("Show debug overlay"));

    expect(handlers.onUpdateDebug).toHaveBeenCalledWith(true);
  });

  it("saves the sync token on blur only when it actually changed", () => {
    const handlers = renderFullSettings({ syncToken: "abc" });
    const tokenInput = screen.getByPlaceholderText("Enter sync token");

    fireEvent.blur(tokenInput);
    expect(handlers.onUpdateSyncToken).not.toHaveBeenCalled();

    fireEvent.change(tokenInput, { target: { value: " new-token " } });
    fireEvent.blur(tokenInput);
    expect(handlers.onUpdateSyncToken).toHaveBeenCalledWith("new-token");
  });

  it("calls onExportBackup when Export is clicked", () => {
    const handlers = renderFullSettings();

    fireEvent.click(screen.getByText("Export"));

    expect(handlers.onExportBackup).toHaveBeenCalledTimes(1);
  });

  it("imports a selected backup file", () => {
    const handlers = renderFullSettings();
    const file = new File(["{}"], "backup.json", { type: "application/json" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(handlers.onImportBackup).toHaveBeenCalledWith(file);
  });
});
