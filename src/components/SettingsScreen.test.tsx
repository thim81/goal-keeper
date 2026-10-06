import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "@/components/SettingsScreen";
import { DEFAULT_SETTINGS } from "@/types/match";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
afterEach(() => {
  if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
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
    expect(screen.getByPlaceholderText("Detected automatically, for example IPU15")).toHaveValue(
      "IPU15",
    );
    expect(onUpdateCalendarSettings).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText("Paste ProSoccerData subscription URL"), {
      target: { value: "https://example.test/calendar.ics" },
    });
    fireEvent.blur(screen.getByPlaceholderText("Paste ProSoccerData subscription URL"));
    expect(onUpdateCalendarSettings).toHaveBeenCalledWith(
      "https://example.test/calendar.ics",
      "IPU15",
    );
  });

  it.each([false, true])(
    "skips unchanged calendar values on either blur, surrounding spaces: %s",
    (spaces) => {
      const handlers = renderFullSettings({
        calendarUrl: "https://example.test/calendar.ics",
        calendarTeamName: "IPU15",
      });
      const url = screen.getByPlaceholderText("Paste ProSoccerData subscription URL");
      const calendarTeam = screen.getByPlaceholderText("Detected automatically, for example IPU15");
      if (spaces) {
        fireEvent.change(url, { target: { value: " https://example.test/calendar.ics " } });
        fireEvent.change(calendarTeam, { target: { value: " IPU15 " } });
      }
      fireEvent.blur(url);
      fireEvent.blur(calendarTeam);
      expect(handlers.onUpdateCalendarSettings).not.toHaveBeenCalled();
    },
  );

  it("keeps focus and accepts later field saves while a calendar save is pending", async () => {
    const handlers = renderFullSettings();
    let resolve!: (success: boolean) => void;
    handlers.onUpdateCalendarSettings.mockImplementationOnce(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    );
    const url = screen.getByPlaceholderText("Paste ProSoccerData subscription URL");
    const calendarTeam = screen.getByPlaceholderText("Detected automatically, for example IPU15");
    const team = screen.getByPlaceholderText("Enter your team name");
    act(() => {
      url.focus();
    });
    fireEvent.change(url, { target: { value: " https://example.test/calendar.ics " } });
    act(() => {
      calendarTeam.focus();
    });
    expect(calendarTeam).toBeEnabled();
    expect(calendarTeam).toHaveFocus();
    expect(team).toBeEnabled();
    expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
    fireEvent.change(calendarTeam, { target: { value: " IPU15 " } });
    act(() => {
      team.focus();
    });
    fireEvent.change(team, { target: { value: " New Team " } });
    fireEvent.blur(team);
    expect(handlers.onUpdateCalendarSettings.mock.calls).toEqual([
      ["https://example.test/calendar.ics", ""],
      ["https://example.test/calendar.ics", "IPU15"],
    ]);
    expect(handlers.onUpdateTeamName).toHaveBeenCalledWith("New Team");
    await act(async () => {
      resolve(true);
    });
  });

  it("preserves a newer calendar draft when an earlier save response arrives", () => {
    const { rerender, ...handlers } = renderFullSettings();
    const url = screen.getByPlaceholderText("Paste ProSoccerData subscription URL");
    const calendarTeam = screen.getByPlaceholderText("Detected automatically, for example IPU15");
    fireEvent.change(url, { target: { value: "https://example.test/calendar.ics" } });
    fireEvent.blur(url);
    fireEvent.change(calendarTeam, { target: { value: "IPU15" } });
    rerender(
      <SettingsScreen
        settings={{ ...DEFAULT_SETTINGS, calendarUrl: "https://example.test/calendar.ics" }}
        {...handlers}
      />,
    );
    expect(calendarTeam).toHaveValue("IPU15");
    fireEvent.blur(calendarTeam);
    expect(handlers.onUpdateCalendarSettings).toHaveBeenLastCalledWith(
      "https://example.test/calendar.ics",
      "IPU15",
    );
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
  const view = render(
    <SettingsScreen settings={{ ...DEFAULT_SETTINGS, ...settingsOverrides }} {...handlers} />,
  );
  return { ...handlers, ...view };
}

function renderSharingSettings({
  viewerLink = "",
  onLoadViewerLink,
}: {
  viewerLink?: string;
  onLoadViewerLink: () => Promise<string | null>;
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
  it("preserves an unsaved team name when remote settings arrive", () => {
    const { rerender, ...handlers } = renderFullSettings();
    const input = screen.getByPlaceholderText("Enter your team name");
    fireEvent.change(input, { target: { value: "My draft" } });
    rerender(
      <SettingsScreen
        settings={{ ...DEFAULT_SETTINGS, teamName: "Other editor's team" }}
        {...handlers}
      />,
    );
    expect(input).toHaveValue("My draft");
    fireEvent.blur(input);
    expect(handlers.onUpdateTeamName).toHaveBeenCalledWith("My draft");
  });

  it("allows device theme changes while a shared save is pending", async () => {
    const handlers = renderFullSettings();
    let resolve: (value: boolean) => void = () => {};
    handlers.onAddPlayer.mockImplementation(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    );
    const input = screen.getByPlaceholderText("Add player name");
    fireEvent.change(input, { target: { value: "Alice" } });
    fireEvent.click(input.closest("div")!.querySelector("button")!);
    expect(input).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(handlers.onUpdateTheme).toHaveBeenCalledWith("dark");
    await act(async () => {
      resolve(true);
    });
  });
  it("hides sharing when viewer access is not configured", async () => {
    renderSharingSettings({ onLoadViewerLink: vi.fn().mockResolvedValue(null) });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Share link" })).not.toBeInTheDocument(),
    );
  });

  it("copies a freshly loaded link on the same retry click after prefetch fails", async () => {
    const link = "https://example.test/#viewer=share-token";
    const onLoadViewerLink = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(link);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderSharingSettings({ onLoadViewerLink });

    const copy = screen.getByRole("button", { name: "Share link" });
    await waitFor(() => expect(copy).toBeEnabled());
    fireEvent.click(copy);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(link);
    expect(onLoadViewerLink).toHaveBeenCalledTimes(2);
  });

  it("copies a prefetched link from Share link", async () => {
    const link = "https://example.test/#viewer=share-token";
    const onLoadViewerLink = vi.fn().mockResolvedValue(link);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderSharingSettings({ viewerLink: link, onLoadViewerLink });

    fireEvent.click(screen.getByRole("button", { name: "Share link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(link));
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith("View link copied");
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
    expect(screen.queryByText("Share link")).not.toBeInTheDocument();
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

  it.each([false, "throw"] as const)("keeps player draft after %s add", async (result) => {
    const handlers = renderFullSettings();
    if (result === "throw") handlers.onAddPlayer.mockRejectedValue(new Error("offline"));
    else handlers.onAddPlayer.mockResolvedValue(false);
    const input = screen.getByPlaceholderText("Add player name");
    fireEvent.change(input, { target: { value: "Alice" } });
    fireEvent.click(input.closest("div")!.querySelector("button")!);

    await waitFor(() => expect(input).toBeEnabled());
    expect(input).toHaveValue("Alice");
  });

  it("clears player draft only after async add succeeds", async () => {
    let resolve: (result: boolean) => void = () => {};
    const handlers = renderFullSettings();
    handlers.onAddPlayer.mockImplementation(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    );
    const input = screen.getByPlaceholderText("Add player name");
    fireEvent.change(input, { target: { value: "Alice" } });
    fireEvent.click(input.closest("div")!.querySelector("button")!);
    expect(input).toBeEnabled();
    expect(input.closest("div")!.querySelector("button")!).toBeDisabled();
    expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
    await act(async () => {
      resolve(true);
      await Promise.resolve();
    });
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("keeps a new player draft typed while the previous add is pending", async () => {
    const handlers = renderFullSettings();
    let resolve!: (success: boolean) => void;
    handlers.onAddPlayer.mockImplementation(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    );
    const input = screen.getByPlaceholderText("Add player name");
    fireEvent.change(input, { target: { value: "Alice" } });
    fireEvent.click(input.closest("div")!.querySelector("button")!);
    fireEvent.change(input, { target: { value: "Bob" } });
    const team = screen.getByPlaceholderText("Enter your team name");
    fireEvent.change(team, { target: { value: "New Team" } });
    fireEvent.blur(team);
    expect(handlers.onUpdateTeamName).toHaveBeenCalledWith("New Team");
    await act(async () => {
      resolve(true);
    });
    expect(input).toHaveValue("Bob");
  });

  it("skips whitespace-only team-name and token changes", () => {
    const handlers = renderFullSettings({ syncToken: "abc" });
    const team = screen.getByPlaceholderText("Enter your team name");
    const token = screen.getByPlaceholderText("Enter sync token");
    fireEvent.change(team, { target: { value: ` ${DEFAULT_SETTINGS.teamName} ` } });
    fireEvent.blur(team);
    fireEvent.change(token, { target: { value: " abc " } });
    fireEvent.blur(token);
    expect(handlers.onUpdateTeamName).not.toHaveBeenCalled();
    expect(handlers.onUpdateSyncToken).not.toHaveBeenCalled();
  });

  it("retains team and calendar drafts when async saves fail", async () => {
    const handlers = renderFullSettings();
    handlers.onUpdateTeamName.mockResolvedValue(false);
    handlers.onUpdateCalendarSettings.mockRejectedValue(new Error("offline"));
    const team = screen.getByPlaceholderText("Enter your team name");
    fireEvent.change(team, { target: { value: "New Team" } });
    fireEvent.blur(team);
    await waitFor(() => expect(team).toBeEnabled());
    expect(team).toHaveValue("New Team");

    const url = screen.getByPlaceholderText("Paste ProSoccerData subscription URL");
    const calendarTeam = screen.getByPlaceholderText("Detected automatically, for example IPU15");
    fireEvent.change(url, { target: { value: "https://example.test/calendar.ics" } });
    fireEvent.change(calendarTeam, { target: { value: "IPU15" } });
    fireEvent.blur(calendarTeam);
    await waitFor(() => expect(url).toBeEnabled());
    expect(url).toHaveValue("https://example.test/calendar.ics");
    expect(calendarTeam).toHaveValue("IPU15");
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
