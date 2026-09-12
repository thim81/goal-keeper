import { describe, expect, it } from 'vitest';
import {
  isAllowedCalendarUrl,
  parseCalendarGames,
} from '@/lib/calendar';
import { getUpcomingMatches } from '@/lib/upcoming-matches';

const calendar = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260914T181500Z
SUMMARY:Groepstraining IPU15
UID:training|17089
END:VEVENT
BEGIN:VEVENT
DTSTART:20260919T111500Z
SUMMARY:IPU15 - Rc Hades Kiewit Hasselt U15
UID:game|6547
END:VEVENT
BEGIN:VEVENT
DTSTART:20260912T101500Z
SUMMARY:Eendracht Mechelen A/d Maas U15 - IPU15
UID:game|6550
END:VEVENT
BEGIN:VEVENT
DTSTART:20260910T101500Z
SUMMARY:IPU15 - Past Opponent
UID:game|old
END:VEVENT
END:VCALENDAR`;

describe('calendar helpers', () => {
  it('only allows HTTPS ProSoccerData calendar URLs', () => {
    expect(
      isAllowedCalendarUrl(
        'https://bocholtvv.prosoccerdata.com/api/v2/members/ics/file?id=1927&uuid=value',
      ),
    ).toBe(true);
    expect(isAllowedCalendarUrl('http://bocholtvv.prosoccerdata.com/api/v2/members/ics/file')).toBe(
      false,
    );
    expect(isAllowedCalendarUrl('https://example.com/api/v2/members/ics/file')).toBe(false);
    expect(isAllowedCalendarUrl('not a url')).toBe(false);
  });

  it('parses future games, ignores training and past games, and sorts by start time', () => {
    const games = parseCalendarGames(calendar, new Date('2026-09-12T09:00:00Z'));

    expect(games).toEqual([
      {
        id: 'game|6550',
        start: '2026-09-12T10:15:00.000Z',
        homeTeam: 'Eendracht Mechelen A/d Maas U15',
        awayTeam: 'IPU15',
      },
      {
        id: 'game|6547',
        start: '2026-09-19T11:15:00.000Z',
        homeTeam: 'IPU15',
        awayTeam: 'Rc Hades Kiewit Hasselt U15',
      },
    ]);
  });

  it('detects the IPU team and resolves opponent plus venue', () => {
    const games = parseCalendarGames(calendar, new Date('2026-09-12T09:00:00Z'));
    const result = getUpcomingMatches(games, '');

    expect(result.detectedTeamName).toBe('IPU15');
    expect(result.matches).toEqual([
      expect.objectContaining({ opponentName: 'Eendracht Mechelen A/d Maas U15', isHome: false }),
      expect.objectContaining({ opponentName: 'Rc Hades Kiewit Hasselt U15', isHome: true }),
    ]);
  });

  it('uses an explicitly configured calendar team name', () => {
    const games = parseCalendarGames(calendar, new Date('2026-09-12T09:00:00Z'));
    const result = getUpcomingMatches(games, 'ipu15');

    expect(result.detectedTeamName).toBeNull();
    expect(result.matches).toHaveLength(2);
  });

  it('ignores malformed game summaries', () => {
    const malformed = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260919T111500Z
SUMMARY:IPU15 versus Opponent
UID:game|broken
END:VEVENT
END:VCALENDAR`;

    expect(parseCalendarGames(malformed, new Date('2026-09-12T09:00:00Z'))).toEqual([]);
  });
});
