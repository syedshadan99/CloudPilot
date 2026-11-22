import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ChatRepository } from "./chat.repository.js";
import type { CreateSessionDto, CreateMessageDto, UpdateRequirementsDto } from "./dto/chat.dto.js";
import { AI_ADAPTER, type AiAdapter } from "./adapters/index.js";

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly repo: ChatRepository,
    @Inject(AI_ADAPTER) private readonly ai: AiAdapter,
  ) {}

  // ── Sessions ─────────────────────────────────────────────────────────────

  async createSession(dto: CreateSessionDto) {
    return this.repo.createSession(dto);
  }

  async listSessions(customerId: string) {
    return this.repo.listSessions(customerId);
  }

  async getSession(id: string, customerId?: string) {
    const session = await this.repo.findSession(id);
    if (!session) throw new NotFoundException(`Chat session ${id} not found`);
    if (customerId && session.customer_id !== customerId) throw new NotFoundException(`Chat session ${id} not found`);

    const messages = await this.repo.listMessages(id);
    const requirements = await this.repo.findRequirements(id);

    return { session, messages, requirements: requirements ?? null };
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  async sendMessage(sessionId: string, dto: CreateMessageDto, customerId?: string) {
    // Verify session exists
    const session = await this.repo.findSession(sessionId);
    if (!session) throw new NotFoundException(`Chat session ${sessionId} not found`);
    if (customerId && session.customer_id !== customerId) throw new NotFoundException(`Chat session ${sessionId} not found`);

    // Persist user message
    const userMessage = await this.repo.addMessage(sessionId, "user", dto.content);

    // Fetch full history to give the adapter context
    const history = await this.repo.listMessages(sessionId);

    // Attempt AI extraction — degrade gracefully on failure
    let assistantContent = this.fallbackReply();
    let extractedReqs = {};
    let requirementsSource: "ai" | "manual" = "ai";

    try {
      const result = await this.ai.process({
        messages: history.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
      });

      assistantContent = result.reply;
      extractedReqs = result.requirements;

      // Persist extracted requirements if anything was extracted
      const hasExtracted = Object.values(extractedReqs).some((v) => v !== undefined);
      if (hasExtracted) {
        await this.repo.upsertRequirements(sessionId, extractedReqs, "ai");
      }
    } catch (err) {
      this.logger.warn(
        `AI adapter failed for session ${sessionId}: ${(err as Error).message}. Falling back.`,
      );
    }

    // Persist assistant reply
    const assistantMessage = await this.repo.addMessage(
      sessionId,
      "assistant",
      assistantContent,
    );

    const requirements = await this.repo.findRequirements(sessionId);

    return {
      userMessage,
      assistantMessage,
      requirements: requirements ?? null,
    };
  }

  // ── Requirements ─────────────────────────────────────────────────────────

  async getRequirements(sessionId: string, customerId?: string) {
    const session = await this.repo.findSession(sessionId);
    if (!session) throw new NotFoundException(`Chat session ${sessionId} not found`);
    if (customerId && session.customer_id !== customerId) throw new NotFoundException(`Chat session ${sessionId} not found`);

    const requirements = await this.repo.findRequirements(sessionId);
    return requirements ?? null;
  }

  async updateRequirements(sessionId: string, dto: UpdateRequirementsDto, customerId?: string) {
    const session = await this.repo.findSession(sessionId);
    if (!session) throw new NotFoundException(`Chat session ${sessionId} not found`);
    if (customerId && session.customer_id !== customerId) throw new NotFoundException(`Chat session ${sessionId} not found`);

    const reqs = {
      cpuCores: dto.cpuCores,
      ramGb: dto.ramGb,
      storageGb: dto.storageGb,
      os: dto.os,
      durationDays: dto.durationDays,
      billingCycle: dto.billingCycle,
      useCase: dto.useCase,
      notes: dto.notes,
    };

    // Manual update always wins and marks source as 'manual'
    return this.repo.upsertRequirements(sessionId, reqs, "manual");
  }

  private fallbackReply(): string {
    return (
      "I'm having trouble processing your message right now. " +
      "Please try again, or use the form below to enter your VM requirements manually."
    );
  }
}
