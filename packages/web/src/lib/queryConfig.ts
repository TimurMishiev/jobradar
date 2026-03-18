// Centralised stale times for TanStack Query.
// Values are deliberately generous — data is stable between ingestion runs (every 4h).
// Agent cooldowns are noted so these stay in sync with server-side guards.

export const STALE = {
  companies:      Infinity,         // static list; never refetch unless server restarts
  feed:           60_000,           // 1 min — jobs update after ingestion
  tracker:        60_000,           // 1 min
  digest:         5 * 60_000,       // 5 min
  profile:        5 * 60_000,       // 5 min
  insightTimeline: 5 * 60_000,      // 5 min
  briefing:       10 * 60_000,      // 10 min  (server cooldown: 5 min)
  companySignals: 10 * 60_000,      // 10 min  (server cooldown: 10 min)
  gapAnalysis:    30 * 60_000,      // 30 min  (server cooldown: 15 min)
} as const;
