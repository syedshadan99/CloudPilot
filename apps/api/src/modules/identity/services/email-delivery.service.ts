import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../../../config/index.js";

export interface EmailMessage {
  kind: "verification" | "password_reset";
  recipient: string;
  token: string;
  expiresAt: Date;
}

export interface EmailDelivery {
  sendVerification(message: EmailMessage): Promise<void>;
  sendPasswordReset(message: EmailMessage): Promise<void>;
}

export const EMAIL_DELIVERY = Symbol("EMAIL_DELIVERY");

/**
 * Development capture boundary. Raw tokens stay in process memory for tests
 * and are never returned by HTTP handlers or logged. A real provider must be
 * supplied before production startup (validated by configuration).
 */
@Injectable()
export class DevelopmentEmailDelivery implements EmailDelivery {
  private readonly messages: EmailMessage[] = [];

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async sendVerification(message: EmailMessage): Promise<void> {
    this.capture(message);
  }

  async sendPasswordReset(message: EmailMessage): Promise<void> {
    this.capture(message);
  }

  getLastMessageForTests(kind?: EmailMessage["kind"]): EmailMessage | undefined {
    return [...this.messages].reverse().find((message) => !kind || message.kind === kind);
  }

  private capture(message: EmailMessage): void {
    if (this.config.emailDeliveryMode === "disabled") {
      throw new ServiceUnavailableException("Email delivery is not configured");
    }
    this.messages.push(message);
    if (this.messages.length > 20) this.messages.shift();
  }
}
