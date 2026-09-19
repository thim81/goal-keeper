import ICAL from "ical.js";

export interface CalendarFixture {
  id: string;
  start: string;
  homeTeam: string;
  awayTeam: string;
}

export function isAllowedCalendarUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const isProSoccerDataHost =
      url.hostname === "prosoccerdata.com" || url.hostname.endsWith(".prosoccerdata.com");

    return (
      url.protocol === "https:" &&
      isProSoccerDataHost &&
      url.pathname === "/api/v2/members/ics/file" &&
      Boolean(url.searchParams.get("id")) &&
      Boolean(url.searchParams.get("uuid"))
    );
  } catch {
    return false;
  }
}

export function parseCalendarGames(
  source: string,
  now: Date = new Date(),
  limit = 10,
): CalendarFixture[] {
  const calendar = new ICAL.Component(ICAL.parse(source));

  return calendar
    .getAllSubcomponents("vevent")
    .map((component) => new ICAL.Event(component))
    .filter(
      (event) =>
        typeof event.uid === "string" &&
        event.uid.startsWith("game|") &&
        typeof event.summary === "string" &&
        Boolean(event.startDate),
    )
    .map((event) => {
      const teams = event.summary.split(/\s+-\s+/).map((team) => team.trim());
      if (teams.length !== 2 || teams.some((team) => !team)) return null;

      return {
        id: event.uid,
        start: event.startDate.toJSDate().toISOString(),
        homeTeam: teams[0],
        awayTeam: teams[1],
      } satisfies CalendarFixture;
    })
    .filter((fixture): fixture is CalendarFixture => fixture !== null)
    .filter((fixture) => new Date(fixture.start).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, limit);
}
