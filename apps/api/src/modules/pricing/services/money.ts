export const MONEY_SCALE = 10_000n;

export function parseMoney(value: string | number | bigint): bigint {
  const text = String(value).trim();
  if (!/^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/.test(text)) throw new Error("INVALID_DECIMAL");
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * MONEY_SCALE + BigInt((fraction + "0000").slice(0, 4));
}

export function formatMoney(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const whole = absolute / MONEY_SCALE;
  const fraction = String(absolute % MONEY_SCALE).padStart(4, "0");
  return `${sign}${whole}.${fraction}`;
}

export function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("INVALID_DIVISOR");
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

export function multiplyMoneyByInteger(value: bigint, quantity: number | bigint): bigint {
  return value * BigInt(quantity);
}

export function applyPercent(value: bigint, percentBasisPoints: bigint): bigint {
  return divideHalfUp(value * percentBasisPoints, 10_000n);
}

export function periodCount(billingCycle: "hourly" | "daily" | "monthly", rentalDurationDays: number): number {
  if (!Number.isInteger(rentalDurationDays) || rentalDurationDays < 1 || rentalDurationDays > 3650) throw new Error("INVALID_DURATION");
  if (billingCycle === "hourly") return rentalDurationDays * 24;
  if (billingCycle === "daily") return rentalDurationDays;
  if (rentalDurationDays % 30 !== 0) throw new Error("MONTHLY_DURATION_MUST_BE_MULTIPLE_OF_30_DAYS");
  return rentalDurationDays / 30;
}
