import { describe, expect, it, vi } from 'vitest';
import { handleCalendarRequest } from '@/lib/calendar-api';

const validUrl =
  'https://bocholtvv.prosoccerdata.com/api/v2/members/ics/file?id=1927&uuid=value';
const calendar = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260919T111500Z
SUMMARY:IPU15 - Opponent U15
UID:game|6547
END:VEVENT
END:VCALENDAR`;

describe('calendar API handler', () => {
  it('rejects methods other than POST', async () => {
    const response = await handleCalendarRequest(new Request('https://app.test/api/calendar'));

    expect(response.status).toBe(405);
  });

  it('rejects calendar URLs outside the allowed endpoint', async () => {
    const request = new Request('https://app.test/api/calendar', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/calendar.ics' }),
    });

    const response = await handleCalendarRequest(request);

    expect(response.status).toBe(400);
  });

  it('returns upcoming games from the upstream calendar', async () => {
    const request = new Request('https://app.test/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: validUrl }),
    });
    const fetcher = vi.fn().mockResolvedValue(
      new Response(calendar, { headers: { 'Content-Type': 'text/calendar' } }),
    );

    const response = await handleCalendarRequest(
      request,
      fetcher,
      new Date('2026-09-12T09:00:00Z'),
    );

    expect(fetcher).toHaveBeenCalledWith(validUrl, expect.objectContaining({ redirect: 'follow' }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      games: [
        {
          id: 'game|6547',
          start: '2026-09-19T11:15:00.000Z',
          homeTeam: 'IPU15',
          awayTeam: 'Opponent U15',
        },
      ],
    });
  });

  it('returns a gateway error when the upstream request fails', async () => {
    const request = new Request('https://app.test/api/calendar', {
      method: 'POST',
      body: JSON.stringify({ url: validUrl }),
    });
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));

    const response = await handleCalendarRequest(request, fetcher);

    expect(response.status).toBe(502);
  });
});
