interface TimestampedEntry {
  timestamp: string;
}

function getTimestampValue(timestamp: string): number {
  const value = new Date(timestamp).getTime();
  return Number.isFinite(value) ? value : 0;
}

export function sortEntriesByTimestamp<T extends TimestampedEntry>(
  entries: T[],
  direction: 'asc' | 'desc' = 'desc',
): T[] {
  return [...entries].sort((a, b) => {
    const difference = getTimestampValue(a.timestamp) - getTimestampValue(b.timestamp);
    return direction === 'asc' ? difference : -difference;
  });
}

export function filterEntriesForToday<T extends TimestampedEntry>(entries: T[], now = new Date()): T[] {
  const today = now.toDateString();
  return entries.filter((entry) => new Date(entry.timestamp).toDateString() === today);
}
