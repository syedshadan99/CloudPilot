/**
 * Extracted VM requirements produced by an AI adapter or manual form.
 *
 * The AI is ONLY allowed to populate this structure by analysing conversation
 * text. It must NOT calculate prices, accept offers, issue invoices, verify
 * payments, or provision VMs.
 */
export interface VmRequirements {
  cpuCores?: number;
  ramGb?: number;
  storageGb?: number;
  os?: string;
  durationDays?: number;
  billingCycle?: "hourly" | "daily" | "monthly";
  useCase?: string;
  notes?: string;
}

/**
 * Input given to the AI adapter: the full message history for one session.
 */
export interface AiAdapterInput {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
}

/**
 * Result returned by the AI adapter after processing the conversation.
 * `reply` is the assistant response text.
 * `requirements` is the structured extraction — partial if not fully specified yet.
 */
export interface AiAdapterResult {
  reply: string;
  requirements: VmRequirements;
}

/**
 * Replaceable AI adapter interface.
 * Implement this to swap in a real AI provider without touching the service.
 */
export interface AiAdapter {
  /**
   * Process a conversation and return an assistant reply plus any extracted
   * VM requirements. Must not modify pricing, offers, invoices, or VM state.
   */
  process(input: AiAdapterInput): Promise<AiAdapterResult>;
}

export const AI_ADAPTER = Symbol("AI_ADAPTER");
