import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const APP_URL = "http://127.0.0.1:8790";
const LIVE_POLL_MS = 10_000;
const IDLE_POLL_MS = 30_000;
const POLL_TIMEOUT = IDLE_POLL_MS + LIVE_POLL_MS;
const editorToken = "e2e-editor";
const viewerToken = "e2e-viewer";

type Read = { path: string; body: any };

function observePage(page: Page, commands: string[]) {
  const reads: Read[] = [];
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") {
      const path = new URL(request.url()).pathname;
      posts.push(path);
      if (path === "/api/command") commands.push(request.postDataJSON().type);
    }
  });
  page.on("response", async (response) => {
    const path = new URL(response.url()).pathname;
    if (
      response.request().method() !== "GET" ||
      !["/api/state", "/api/active-match"].includes(path)
    )
      return;
    try {
      reads.push({ path, body: await response.json() });
    } catch {
      // Ignore non-JSON/error responses. No mutation endpoint is read here.
    }
  });
  return { reads, posts };
}

async function openSession(context: BrowserContext, token: string, commands: string[]) {
  await context.addInitScript((syncToken) => {
    localStorage.setItem("football-tracker-settings", JSON.stringify({ syncToken }));
  }, token);
  const page = await context.newPage();
  const observed = observePage(page, commands);
  await page.goto(APP_URL);
  return { page, ...observed };
}

async function startMatch(page: Page, team: string, opponent: string) {
  await expect(page.getByRole("button", { name: "Start New Match" })).toBeVisible();
  await page.getByRole("button", { name: "Start New Match" }).click();
  await page.getByPlaceholder("My Team").fill(team);
  await page.getByPlaceholder("Opponent").fill(opponent);
  await page.getByRole("button", { name: "Kick Off!" }).click();
  await expect(page.getByRole("button", { name: "We Scored!" })).toBeVisible();
}

async function prepareGoal(page: Page, scorer: string) {
  await page.getByRole("button", { name: "We Scored!" }).click();
  await page.getByPlaceholder("Who scored?").fill(scorer);
  return page.getByRole("button", { name: "Add Goal" });
}

async function prepareCard(page: Page, player: string) {
  await page.getByRole("button", { name: "Show extra actions" }).click();
  await page.getByRole("button", { name: "Event", exact: true }).click();
  await page.getByRole("button", { name: "Yellow Card" }).click();
  await page.getByPlaceholder("Which player?").fill(player);
  return page.getByRole("button", { name: "Add Card Event" });
}

function liveMatch(body: any) {
  return body?.scope === "structural" ? body.state?.activeMatch : body?.activeMatch;
}

function hasGoalsAndCard(body: any, scorers: string[], cardPlayer: string) {
  const match = liveMatch(body);
  return (
    match &&
    scorers.every((scorer) => match.goals?.some((goal: any) => goal.scorer === scorer)) &&
    match.events?.some((event: any) => event.type === "yellow-card" && event.player === cardPlayer)
  );
}

async function waitForRead(reads: Read[], predicate: (read: Read) => boolean) {
  await expect
    .poll(() => reads.some(predicate), { timeout: POLL_TIMEOUT, intervals: [250, 500, 1000] })
    .toBe(true);
}

async function cachedMatch(page: Page, opponent: string) {
  return page.evaluate((opponentName) => {
    const cache = JSON.parse(localStorage.getItem("football-tracker-workspace-v2") || "null");
    const state = cache?.state;
    const season = state?.seasons?.[state.activeSeasonId];
    const summary = season?.matches?.find((match: any) => match.opponentName === opponentName);
    const match = summary ? season.fullMatches[summary.id] : null;
    return { summary, match, activeMatch: state?.activeMatch };
  }, opponent);
}

async function openHistory(page: Page, opponent: string) {
  await expect(page.getByRole("button", { name: "History" }).first()).toBeVisible();
  await page.getByRole("button", { name: "History" }).first().click();
  const matchCard = page.getByRole("button").filter({ hasText: opponent });
  await expect(matchCard).toBeVisible({ timeout: POLL_TIMEOUT });
  await matchCard.click();
  await expect(page.locator(".scoreboard-gradient")).toBeVisible();
  await expect(page.getByText(opponent)).toBeVisible();
  return page.locator(".scoreboard-gradient");
}

async function submitCommand(page: Page, click: () => Promise<unknown>, type: string) {
  const received = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/command" &&
      response.request().postDataJSON()?.type === type,
  );
  await click();
  const response = await received;
  expect(response.status()).toBe(200);
  return response.json();
}

async function authoritative(page: Page) {
  const response = await page.request.get(`${APP_URL}/api/state`, {
    headers: { "x-auth-token": editorToken, "X-Workspace-Protocol": "2" },
  });
  expect(response.ok()).toBe(true);
  return response.json();
}

function sharedState(state: any) {
  const { debug: _debug, theme: _theme, syncToken: _token, ...settings } = state.settings;
  return { ...state, settings };
}

async function cachedState(page: Page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem("football-tracker-workspace-v2") || "null")?.state,
  );
}

for (const order of ["goal-first", "card-first"] as const) {
  test(`three isolated sessions preserve the match (${order})`, async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    const suffix = `${Date.now()}-${testInfo.retry}-${order}`;
    const team = `Team-${suffix}`;
    const opponent = `Rivals-${suffix}`;
    const firstScorer = `Goal-A-${suffix}`;
    const secondScorer = `Goal-B-${suffix}`;
    const cardPlayer = `Booked-${suffix}`;
    const commands: string[] = [];
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    try {
      // All three sessions begin idle. B and C must discover the match by polling.
      const [a, b, c] = await Promise.all([
        openSession(contexts[0], editorToken, commands),
        openSession(contexts[1], editorToken, commands),
        openSession(contexts[2], viewerToken, commands),
      ]);
      for (const session of [a, b, c]) {
        await waitForRead(
          session.reads,
          (read) => read.path === "/api/state" && read.body.state?.activeMatch === null,
        );
      }
      const beforeStartB = b.reads.length;
      const beforeStartC = c.reads.length;
      await startMatch(a.page, team, opponent);
      await waitForRead(
        b.reads,
        (read) =>
          b.reads.indexOf(read) >= beforeStartB && liveMatch(read.body)?.opponentName === opponent,
      );
      await waitForRead(
        c.reads,
        (read) =>
          c.reads.indexOf(read) >= beforeStartC && liveMatch(read.body)?.opponentName === opponent,
      );
      await expect(b.page.getByRole("button", { name: "We Scored!" })).toBeVisible();
      await expect(b.page.getByText(opponent)).toBeVisible();
      await expect(c.page.getByText(opponent)).toBeVisible();
      await expect(c.page.getByRole("button", { name: "We Scored!" })).toHaveCount(0);
      await expect(c.page.getByRole("button", { name: "Event", exact: true })).toHaveCount(0);

      // Both forms are prepared from the same earlier state. The second editor
      // submits immediately after the first response, without a manual refresh.
      const goalSubmit = await prepareGoal(a.page, firstScorer);
      const cardSubmit = await prepareCard(b.page, cardPlayer);
      const waveStart = commands.length;
      if (order === "goal-first") {
        await submitCommand(a.page, () => goalSubmit.click(), "add-goal");
        await submitCommand(b.page, () => cardSubmit.click(), "add-event");
      } else {
        await submitCommand(b.page, () => cardSubmit.click(), "add-event");
        await submitCommand(a.page, () => goalSubmit.click(), "add-goal");
      }
      expect(commands.slice(waveStart)).toEqual(
        order === "goal-first" ? ["add-goal", "add-event"] : ["add-event", "add-goal"],
      );
      await expect(a.page.getByPlaceholder("Who scored?")).toHaveCount(0);
      await expect(b.page.getByPlaceholder("Which player?")).toHaveCount(0);
      const firstWave = await authoritative(a.page);
      expect(hasGoalsAndCard(firstWave, [firstScorer], cardPlayer)).toBe(true);
      await waitForRead(c.reads, (read) => hasGoalsAndCard(read.body, [firstScorer], cardPlayer));
      await expect(c.page.getByText(firstScorer)).toBeVisible({ timeout: POLL_TIMEOUT });
      await expect(c.page.getByText(new RegExp(cardPlayer))).toBeVisible({ timeout: POLL_TIMEOUT });

      const secondGoalSubmit = await prepareGoal(b.page, secondScorer);
      await submitCommand(b.page, () => secondGoalSubmit.click(), "add-goal");
      await expect(b.page.getByPlaceholder("Who scored?")).toHaveCount(0);
      const beforeManual = a.reads.length;
      await a.page.getByRole("button", { name: "Sync match" }).click();
      await waitForRead(
        a.reads,
        (read) =>
          a.reads.indexOf(read) >= beforeManual &&
          read.path === "/api/state" &&
          hasGoalsAndCard(read.body, [firstScorer, secondScorer], cardPlayer),
      );
      await expect(a.page.getByText(secondScorer)).toBeVisible();
      const beforeEnd = (await authoritative(a.page)).state.activeMatch;
      expect(beforeEnd.goals).toHaveLength(2);
      expect(beforeEnd.events.filter((event: any) => event.type === "yellow-card")).toHaveLength(1);

      await a.page.getByRole("button", { name: "Show extra actions" }).click();
      await submitCommand(
        a.page,
        () => a.page.getByRole("button", { name: "End", exact: true }).click(),
        "end-match",
      );
      await expect(a.page.getByRole("button", { name: "Start New Match" })).toBeVisible({
        timeout: POLL_TIMEOUT,
      });
      await expect(b.page.getByRole("button", { name: "Start New Match" })).toBeVisible({
        timeout: POLL_TIMEOUT,
      });
      await expect(c.page.getByText("Waiting for the next match")).toBeVisible({
        timeout: POLL_TIMEOUT,
      });
      const final = await authoritative(a.page);
      expect(final.state.activeMatch).toBeNull();
      const season = final.state.seasons[final.state.activeSeasonId];
      const completed = season.fullMatches[beforeEnd.id];
      expect(completed.goals).toEqual(beforeEnd.goals);
      expect(completed.events.map((event: any) => event.id)).toEqual(
        expect.arrayContaining(beforeEnd.events.map((event: any) => event.id)),
      );
      expect(completed.isActive).toBe(false);
      expect(season.matches.find((match: any) => match.id === beforeEnd.id)).toMatchObject({
        myTeamScore: 2,
        opponentScore: 0,
        yellowCardCount: 1,
      });
      for (const session of [a, b, c]) {
        await expect
          .poll(async () => sharedState(await cachedState(session.page)), { timeout: POLL_TIMEOUT })
          .toEqual(sharedState(final.state));
        const scoreboard = await openHistory(session.page, opponent);
        await expect(scoreboard.locator(".font-black").nth(0)).toHaveText("2");
        await expect(scoreboard.locator(".font-black").nth(1)).toHaveText("0");
        await expect(session.page.getByText(firstScorer, { exact: true }).last()).toBeVisible();
        await expect(session.page.getByText(secondScorer, { exact: true }).last()).toBeVisible();
        await expect(session.page.getByText(new RegExp(cardPlayer))).toBeVisible();
        expect(await cachedMatch(session.page, opponent)).toMatchObject({
          match: completed,
          activeMatch: null,
        });
      }
      await expect(c.page.getByRole("button", { name: /delete match/i })).toHaveCount(0);

      // Observe another normal idle poll in every session. No old cache can
      // upload itself and restore the earlier active state.
      const pollCounts = [a, b, c].map((session) => session.reads.length);
      await Promise.all(
        [a, b, c].map((session, index) =>
          waitForRead(
            session.reads,
            (read) =>
              session.reads.indexOf(read) >= pollCounts[index] &&
              read.path === "/api/state" &&
              read.body.revision === final.revision &&
              read.body.state?.activeMatch === null,
          ),
        ),
      );
      expect(await authoritative(a.page)).toEqual(final);
      for (const session of [a, b, c])
        expect(sharedState(await cachedState(session.page))).toEqual(sharedState(final.state));

      const reloadCounts = [a, b, c].map((session) => session.reads.length);
      await Promise.all([a.page.reload(), b.page.reload(), c.page.reload()]);
      for (const [index, session] of [a, b, c].entries()) {
        await waitForRead(
          session.reads,
          (read) =>
            session.reads.indexOf(read) >= reloadCounts[index] &&
            read.path === "/api/state" &&
            read.body.revision === final.revision,
        );
        await expect
          .poll(async () => sharedState(await cachedState(session.page)))
          .toEqual(sharedState(final.state));
        expect(await cachedMatch(session.page, opponent)).toMatchObject({
          match: completed,
          activeMatch: null,
        });
        await openHistory(session.page, opponent);
        await expect(session.page.getByText(firstScorer, { exact: true }).last()).toBeVisible();
        await expect(session.page.getByText(secondScorer, { exact: true }).last()).toBeVisible();
        await expect(session.page.getByText(new RegExp(cardPlayer))).toBeVisible();
      }
      expect(c.posts).toEqual([]);
      for (const session of [a, b, c]) expect(session.posts).not.toContain("/api/state");
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
}
