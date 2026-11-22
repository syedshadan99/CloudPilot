export const CUSTOMER_WORKLOADS = [
  "web hosting",
  "database server",
  "development environment",
  "game server",
  "file storage",
  "AI/ML workload",
  "testing environment",
  "custom",
] as const;

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "PKR"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
export const BILLING_CYCLES = ["hourly", "daily", "monthly"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];
export const TECHNICAL_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type TechnicalLevel = (typeof TECHNICAL_LEVELS)[number];

export const ONBOARDING_STEPS = [
  "welcome",
  "workload",
  "duration",
  "billing",
  "expertise",
  "recommendation",
  "complete",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
