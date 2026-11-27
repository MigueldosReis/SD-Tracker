import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The service delivery team (order owners, update authors, @mentions).
 * Real names live in data/team.json, which is git-ignored because the repository is public;
 * without it the fictional data/team.sample.json is used.
 */
export function readTeam(): string[] {
  const dir = path.join(process.cwd(), 'data');
  const file = [
    process.env.TRACKER_TEAM_PATH,
    path.join(dir, 'team.json'),
    path.join(dir, 'team.sample.json')
  ].find((f): f is string => !!f && existsSync(f));
  if (!file) return [];
  try {
    const list: unknown = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(list)
      ? list
          .filter((n): n is string => typeof n === 'string' && n.trim() !== '')
          .map((n) => n.trim())
      : [];
  } catch {
    return [];
  }
}

/** The team member making a request (the X-Tracker-Person header the browser sends), or null. */
export function personFrom(req: Request): string | null {
  const raw = req.headers.get('x-tracker-person');
  if (!raw) return null;
  let name: string;
  try {
    name = decodeURIComponent(raw).trim();
  } catch {
    return null;
  }
  return readTeam().includes(name) ? name : null;
}
