import { isAllowedCalendarUrl, parseCalendarGames } from './calendar';

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

export async function handleCalendarRequest(
  request: Request,
  fetcher: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let url: unknown;
  try {
    const body = (await request.json()) as { url?: unknown };
    url = body.url;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (typeof url !== 'string' || !isAllowedCalendarUrl(url)) {
    return jsonResponse({ error: 'Invalid calendar URL' }, 400);
  }

  try {
    const upstream = await fetcher(url, {
      headers: { Accept: 'text/calendar' },
      redirect: 'follow',
    });
    if (!upstream.ok) {
      return jsonResponse({ error: 'Calendar request failed' }, 502);
    }

    const source = await upstream.text();
    return jsonResponse({ games: parseCalendarGames(source, now) }, 200);
  } catch {
    return jsonResponse({ error: 'Calendar request failed' }, 502);
  }
}
