/**
 * Deterministic pricing rate card and calculations for CP-14.
 *
 * Rate card:
 *  - vCPU: $5.00 / core / month
 *  - RAM: $2.00 / GB / month
 *  - Storage: $0.10 / GB / month
 */

export interface VmSpec {
  cpuCores: number;
  ramGb: number;
  storageGb: number;
}

export const RATE_CARD = {
  cpuPerCoreMonthly: 5.0,
  ramPerGbMonthly: 2.0,
  storagePerGbMonthly: 0.1,
} as const;

/**
 * Calculates monthly price in USD rounded to two decimal places.
 */
export function calculateMonthlyPrice(spec: VmSpec): number {
  const cpu = Number(spec.cpuCores) || 0;
  const ram = Number(spec.ramGb) || 0;
  const storage = Number(spec.storageGb) || 0;

  const total =
    cpu * RATE_CARD.cpuPerCoreMonthly +
    ram * RATE_CARD.ramPerGbMonthly +
    storage * RATE_CARD.storagePerGbMonthly;

  return Math.round(total * 100) / 100;
}

/**
 * Calculates price difference (newPrice - oldPrice).
 * Positive means price increase (upgrade), negative means decrease (downgrade).
 */
export function calculatePriceDifference(oldSpec: VmSpec, newSpec: VmSpec): number {
  const oldPrice = calculateMonthlyPrice(oldSpec);
  const newPrice = calculateMonthlyPrice(newSpec);
  return Math.round((newPrice - oldPrice) * 100) / 100;
}
