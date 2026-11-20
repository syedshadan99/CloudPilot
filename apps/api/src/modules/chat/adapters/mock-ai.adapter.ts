import type { AiAdapter, AiAdapterInput, AiAdapterResult } from "./ai-adapter.interface.js";

/**
 * Local mock AI adapter — no external service, no credentials, no network calls.
 *
 * Uses simple keyword matching to extract VM requirements from the most recent
 * user message. Suitable for development, CI, and demos without a real AI key.
 *
 * Replace this with a real `AiAdapter` implementation when a provider is
 * approved and recorded in the architecture decision register.
 */
export class MockAiAdapter implements AiAdapter {
  async process(input: AiAdapterInput): Promise<AiAdapterResult> {
    const userMessages = input.messages.filter((m) => m.role === "user");
    const lastUserMessage = userMessages.at(-1)?.content ?? "";
    const fullText = userMessages.map((m) => m.content).join(" ").toLowerCase();

    const requirements = this.extractRequirements(fullText);
    const reply = this.buildReply(requirements, lastUserMessage);

    return { reply, requirements };
  }

  private extractRequirements(text: string) {
    return {
      cpuCores: this.extractCpu(text),
      ramGb: this.extractRam(text),
      storageGb: this.extractStorage(text),
      os: this.extractOs(text),
      durationDays: this.extractDuration(text),
      billingCycle: this.extractBilling(text),
      useCase: this.extractUseCase(text),
    };
  }

  private extractCpu(text: string): number | undefined {
    const m = text.match(/(\d+)\s*(?:cpu|core|vcpu|vcore)/i);
    if (m) return parseInt(m[1] ?? "0", 10);
    if (text.includes("nano") || text.includes("tiny")) return 1;
    if (text.includes("small")) return 2;
    if (text.includes("medium")) return 4;
    if (text.includes("large") || text.includes("powerful")) return 8;
    return undefined;
  }

  private extractRam(text: string): number | undefined {
    const m = text.match(/(\d+)\s*(?:gb|gib)?\s*(?:ram|memory)/i)
      ?? text.match(/(\d+)\s*(?:gb|gib)\s+(?:of\s+)?(?:ram|memory)/i);
    if (m) return parseInt(m[1] ?? "0", 10);
    return undefined;
  }

  private extractStorage(text: string): number | undefined {
    const m = text.match(/(\d+)\s*(?:gb|gib|tb|tib)\s+(?:storage|disk|ssd|hdd)/i)
      ?? text.match(/(?:storage|disk)\s+(?:of\s+)?(\d+)\s*(?:gb|gib|tb)/i);
    if (m) {
      const val = parseInt(m[1] ?? "0", 10);
      return text.match(/tb|tib/i) ? val * 1024 : val;
    }
    return undefined;
  }

  private extractOs(text: string): string | undefined {
    if (text.includes("ubuntu")) return "Ubuntu";
    if (text.includes("debian")) return "Debian";
    if (text.includes("centos")) return "CentOS";
    if (text.includes("fedora")) return "Fedora";
    if (text.includes("windows server")) return "Windows Server";
    if (text.includes("windows")) return "Windows";
    if (text.includes("linux")) return "Linux";
    return undefined;
  }

  private extractDuration(text: string): number | undefined {
    const months = text.match(/(\d+)\s*month/i);
    if (months) return parseInt(months[1] ?? "0", 10) * 30;
    const weeks = text.match(/(\d+)\s*week/i);
    if (weeks) return parseInt(weeks[1] ?? "0", 10) * 7;
    const days = text.match(/(\d+)\s*day/i);
    if (days) return parseInt(days[1] ?? "0", 10);
    return undefined;
  }

  private extractBilling(text: string): "hourly" | "daily" | "monthly" | undefined {
    if (text.includes("hourly") || text.includes("per hour")) return "hourly";
    if (text.includes("daily") || text.includes("per day")) return "daily";
    if (text.includes("monthly") || text.includes("per month")) return "monthly";
    return undefined;
  }

  private extractUseCase(text: string): string | undefined {
    if (text.includes("web server") || text.includes("website")) return "Web server";
    if (text.includes("database") || text.includes("postgres") || text.includes("mysql")) return "Database";
    if (text.includes("machine learning") || text.includes("ml") || text.includes("ai training")) return "Machine learning";
    if (text.includes("development") || text.includes("dev environment")) return "Development";
    if (text.includes("game server") || text.includes("gaming")) return "Game server";
    if (text.includes("ci/cd") || text.includes("build server")) return "CI/CD";
    return undefined;
  }

  private buildReply(
    reqs: ReturnType<typeof this.extractRequirements>,
    lastMessage: string,
  ): string {
    const found: string[] = [];
    if (reqs.cpuCores) found.push(`${reqs.cpuCores} CPU cores`);
    if (reqs.ramGb) found.push(`${reqs.ramGb} GB RAM`);
    if (reqs.storageGb) found.push(`${reqs.storageGb} GB storage`);
    if (reqs.os) found.push(reqs.os);
    if (reqs.durationDays) found.push(`${reqs.durationDays} days`);
    if (reqs.billingCycle) found.push(`${reqs.billingCycle} billing`);
    if (reqs.useCase) found.push(reqs.useCase);

    if (found.length === 0) {
      return (
        "Thanks for reaching out! To help you find the right VM, could you tell me:\n" +
        "- How many CPU cores do you need?\n" +
        "- How much RAM (GB)?\n" +
        "- How much storage?\n" +
        "- Which operating system?\n" +
        "- How long do you need it for?"
      );
    }

    const missing: string[] = [];
    if (!reqs.cpuCores) missing.push("CPU cores");
    if (!reqs.ramGb) missing.push("RAM");
    if (!reqs.storageGb) missing.push("storage");
    if (!reqs.os) missing.push("operating system");
    if (!reqs.durationDays) missing.push("duration");

    if (missing.length > 0) {
      return (
        `Got it! I've noted: ${found.join(", ")}.\n\n` +
        `Could you also tell me about the ${missing.join(", ")}?`
      );
    }

    return (
      `I've captured all your requirements: ${found.join(", ")}.\n\n` +
      "You can review or adjust these in the requirements panel, then proceed to get an offer."
    );
  }
}
