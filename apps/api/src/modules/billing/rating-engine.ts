import { divideHalfUp, formatMoney, parseMoney } from "../pricing/services/money.js";

export type BillingCycle = "hourly" | "daily" | "monthly";

export interface RatingInput {
  periodStart: Date;
  periodEnd: Date;
  coverageEnd: Date;
  runtimeSeconds: bigint;
  vcpuCount: bigint;
  ratePerPeriod: string;
  billingCycle: BillingCycle;
}

export interface RatedCharge {
  quantity: string;
  unitPrice: string;
  amount: string;
  billableStart: Date;
  billableEnd: Date;
}

const SECONDS_PER_HOUR = 3_600n;
const SECONDS_PER_DAY = 86_400n;
const SECONDS_PER_MONTH = 2_592_000n;

function durationSeconds(start: Date, end: Date): bigint {
  const seconds = BigInt(Math.floor((end.getTime() - start.getTime()) / 1000));
  if (seconds <= 0n) throw new Error("INVALID_BILLING_INTERVAL");
  return seconds;
}

export function rateProvisionedCompute(input: RatingInput): RatedCharge | null {
  if (input.runtimeSeconds <= 0n || input.vcpuCount <= 0n) return null;
  const start = new Date(Math.max(input.periodStart.getTime(), input.coverageEnd.getTime()));
  const end = input.periodEnd;
  if (start >= end) return null;

  const elapsed = durationSeconds(start, end);
  const billableRuntime = input.runtimeSeconds < elapsed ? input.runtimeSeconds : elapsed;
  const denominator = input.billingCycle === "hourly" ? SECONDS_PER_HOUR : input.billingCycle === "daily" ? SECONDS_PER_DAY : SECONDS_PER_MONTH;
  const rate = parseMoney(input.ratePerPeriod);
  const quantityNumerator = billableRuntime * input.vcpuCount;
  const quantity = divideHalfUp(quantityNumerator * 1_000_000n, denominator);
  const amount = divideHalfUp(quantity * rate, 1_000_000n);
  return {
    quantity: `${quantity / 1_000_000n}.${String(quantity % 1_000_000n).padStart(6, "0")}`,
    unitPrice: formatMoney(rate),
    amount: formatMoney(amount),
    billableStart: start,
    billableEnd: end,
  };
}

export function prepaidCoverageEnd(acceptedAt: Date, rentalDurationDays: number): Date {
  if (!Number.isInteger(rentalDurationDays) || rentalDurationDays < 1) throw new Error("INVALID_RENTAL_DURATION");
  return new Date(acceptedAt.getTime() + rentalDurationDays * Number(SECONDS_PER_DAY) * 1000);
}
