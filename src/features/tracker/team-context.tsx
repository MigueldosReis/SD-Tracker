'use client';

import { createContext, use, type ReactNode } from 'react';

const TeamContext = createContext<readonly string[]>([]);

/** Makes the team list (read on the server from data/team.json) available to tracker components. */
export function TeamProvider({
  people,
  children
}: {
  people: readonly string[];
  children: ReactNode;
}) {
  return <TeamContext value={people}>{children}</TeamContext>;
}

export const useTeam = () => use(TeamContext);
