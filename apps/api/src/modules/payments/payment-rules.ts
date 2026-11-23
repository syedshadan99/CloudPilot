import { parseMoney } from "../pricing/services/money.js";

export interface SimulatedPaymentDecision {
  status: "verified" | "failed";
  failureReason: string | null;
}

/**
 * The first-release simulator only settles one exact full payment. The request
 * never supplies a verification flag; this function compares persisted invoice
 * state with the submitted amount and currency using bigint money arithmetic.
 */
export function evaluateSimulatedPayment(amountText: string, expectedAmountText: string, paymentCurrency: string, invoiceCurrency: string): SimulatedPaymentDecision {
  const amount = parseMoney(amountText);
  const expected = parseMoney(expectedAmountText);
  if (paymentCurrency !== invoiceCurrency) return { status: "failed", failureReason: "Payment currency does not match the invoice" };
  if (amount < expected) return { status: "failed", failureReason: "Payment does not cover the full amount due" };
  if (amount > expected) return { status: "failed", failureReason: "Overpayment is not supported" };
  return { status: "verified", failureReason: null };
}
