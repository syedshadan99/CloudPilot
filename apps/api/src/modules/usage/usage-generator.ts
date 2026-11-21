/**
 * Reproducible usage metric generator.
 *
 * Given the same (vmId, periodStart) pair the function always produces the
 * same values. No randomness — purely deterministic arithmetic so records can
 * be re-generated from their primary key without diverging.
 */
export interface UsageMetrics {
  cpu_percent: number;
  ram_percent: number;
  disk_read_mb: number;
  disk_write_mb: number;
  net_in_mb: number;
  net_out_mb: number;
}

/** Simple djb2-style hash that works on arbitrary strings. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; // keep as uint32
  }
  return h;
}

/**
 * Scale an integer hash into [min, max] inclusive.
 * Both min and max are expected to be small positive integers (< 100).
 */
function scale(hash: number, min: number, max: number): number {
  return min + (hash % (max - min + 1));
}

/**
 * Generate reproducible usage metrics for one hour period.
 *
 * @param vmId        UUID of the VM (used as part of the seed)
 * @param periodStart ISO-8601 string or Date representing the start of the hour
 */
export function generateUsageMetrics(
  vmId: string,
  periodStart: Date | string,
): UsageMetrics {
  const seed = `${vmId}::${new Date(periodStart).toISOString()}`;

  // Use different rotations of the same hash for each metric so they are
  // correlated but not identical.
  const h0 = hashString(seed);
  const h1 = hashString(seed + ":1");
  const h2 = hashString(seed + ":2");
  const h3 = hashString(seed + ":3");
  const h4 = hashString(seed + ":4");
  const h5 = hashString(seed + ":5");

  return {
    cpu_percent:    scale(h0, 10, 85),
    ram_percent:    scale(h1, 20, 75),
    disk_read_mb:   scale(h2, 1, 500),
    disk_write_mb:  scale(h3, 1, 300),
    net_in_mb:      scale(h4, 1, 200),
    net_out_mb:     scale(h5, 1, 100),
  };
}

/**
 * Returns the ISO-8601 timestamp for the start of the current UTC hour.
 */
export function currentHourStart(): Date {
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  return now;
}
