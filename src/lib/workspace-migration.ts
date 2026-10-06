import { normalizeWorkspace } from "./workspace";
import type { SyncState } from "./sync";

export const MAX_STATE_BYTES = 1_000_000;
const object = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function historicalMatches(value: unknown): unknown {
  if (!object(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([id, match]) => [
      id,
      object(match) && match.isActive === false
        ? {
            ...match,
            isRunning: match.isRunning === undefined ? false : match.isRunning,
            currentPeriod: match.currentPeriod === undefined ? 1 : match.currentPeriod,
            totalPausedTime: match.totalPausedTime === undefined ? 0 : match.totalPausedTime,
          }
        : match,
    ]),
  );
}

/** The preflight and first DO import use the same compatibility and size checks. */
export function parseMigrationState(raw: string): SyncState {
  if (new TextEncoder().encode(raw).byteLength > MAX_STATE_BYTES)
    throw new Error("Legacy workspace source is too large (limit: 1,000,000 bytes)");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new Error("Legacy workspace is not valid JSON");
  }
  if (object(body)) {
    body = {
      ...body,
      fullMatches: historicalMatches(body.fullMatches),
      ...(object(body.seasons)
        ? {
            seasons: Object.fromEntries(
              Object.entries(body.seasons).map(([id, season]) => [
                id,
                object(season)
                  ? { ...season, fullMatches: historicalMatches(season.fullMatches) }
                  : season,
              ]),
            ),
          }
        : {}),
    };
  }
  const state = normalizeWorkspace(body);
  if (new TextEncoder().encode(JSON.stringify(state)).byteLength > MAX_STATE_BYTES)
    throw new Error("Normalized workspace is too large (limit: 1,000,000 bytes)");
  return state;
}
