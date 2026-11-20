import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { ChatController } from "./chat.controller.js";
import { ChatService } from "./chat.service.js";
import { ChatRepository } from "./chat.repository.js";
import { AI_ADAPTER } from "./adapters/index.js";
import { MockAiAdapter } from "./adapters/mock-ai.adapter.js";

@Module({
  imports: [DatabaseModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatRepository,
    {
      provide: AI_ADAPTER,
      useClass: MockAiAdapter,
    },
  ],
})
export class ChatModule {}
