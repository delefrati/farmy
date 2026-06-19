// Sync history + conflict bookkeeping (P8).
//
// The game keeps a single authoritative save. Cloud sync is therefore a
// whole-save replace, never a field-level merge: merging two diverged farm
// saves could produce invalid state (duplicated tiles, negative coins), so the
// safe + faithful model is "the player explicitly chooses which side wins and
// the losing side is backed up". This module owns the auditable history of
// those decisions.

const SYNC_HISTORY_KEY = 'farmy.syncHistory';
const SYNC_HISTORY_LIMIT = 10;

export type SyncAction = 'upload' | 'download';

export type SyncOutcome =
  | 'uploaded'
  | 'downloaded'
  | 'forced-upload'
  | 'forced-download'
  | 'conflict'
  | 'blocked'
  | 'failed'
  | 'no-remote';

export type SyncHistoryEntry = {
  at: string;
  action: SyncAction;
  outcome: SyncOutcome;
  detail: string;
};

export function loadSyncHistory(): SyncHistoryEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = localStorage.getItem(SYNC_HISTORY_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isSyncHistoryEntry).slice(0, SYNC_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function recordSyncEvent(
  history: SyncHistoryEntry[],
  action: SyncAction,
  outcome: SyncOutcome,
  detail: string,
): SyncHistoryEntry[] {
  const entry: SyncHistoryEntry = {
    at: new Date().toISOString(),
    action,
    outcome,
    detail,
  };

  const next = [entry, ...history].slice(0, SYNC_HISTORY_LIMIT);

  if (typeof window !== 'undefined') {
    localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(next));
  }

  return next;
}

export function formatSyncHistory(history: SyncHistoryEntry[]): string {
  if (history.length === 0) {
    return 'Sync history: none yet.';
  }

  const lines = history.slice(0, 5).map((entry) => {
    const time = new Date(entry.at).toLocaleTimeString();
    return `\u2022 [${time}] ${entry.action} \u2192 ${entry.outcome}`;
  });

  return `Sync history:\n${lines.join('\n')}`;
}

function isSyncOutcome(value: unknown): value is SyncOutcome {
  return (
    value === 'uploaded' ||
    value === 'downloaded' ||
    value === 'forced-upload' ||
    value === 'forced-download' ||
    value === 'conflict' ||
    value === 'blocked' ||
    value === 'failed' ||
    value === 'no-remote'
  );
}

function isSyncHistoryEntry(value: unknown): value is SyncHistoryEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return (
    typeof entry.at === 'string' &&
    (entry.action === 'upload' || entry.action === 'download') &&
    isSyncOutcome(entry.outcome) &&
    typeof entry.detail === 'string'
  );
}
