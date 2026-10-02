import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { randomUUID } from 'crypto';
import {
  AgentChatInput,
  AgentChatRequest,
  AgentChatResponse,
} from './dtos/agent-chat.dto';

@Injectable()
export class AgentClientService {
  private readonly logger = new Logger(AgentClientService.name);

  constructor(private readonly configService: ConfigService) {}

  async chat(input: AgentChatInput): Promise<AgentChatResponse> {
    const baseUrl = this.configService
      .get<string>('AGENT_SERVICE_URL', 'http://localhost:8001')
      .replace(/\/$/, '');
    const configuredTimeout = Number(
      this.configService.get<string>('AGENT_SERVICE_TIMEOUT_MS', '60000'),
    );
    const timeout = Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : 60000;
    const request: AgentChatRequest = {
      user_id: input.userId,
      channel: input.channel,
      channel_id: input.channelId,
      thread_id: input.threadId,
      session_id: randomUUID(),
      question: input.question,
    };

    const startedAt = Date.now();

    try {
      const response = await axios.post<AgentChatResponse>(
        `${baseUrl}/agent`,
        request,
        { timeout },
      );

      if (!response.data?.answer?.trim()) {
        throw new HttpException(
          'Agent service returned an empty answer',
          HttpStatus.BAD_GATEWAY,
        );
      }

      this.logger.log(
        `[Agent] Response received | channel=${request.channel} | ` +
          `userId=${request.user_id} | threadId=${request.thread_id} | ` +
          `sessionId=${request.session_id} | duration=${Date.now() - startedAt}ms`,
      );

      return response.data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? HttpStatus.BAD_GATEWAY;
        const detail = error.response?.data ?? error.message;
        this.logger.error(
          `[Agent] Request failed | channel=${request.channel} | ` +
            `userId=${request.user_id} | threadId=${request.thread_id} | ` +
            `sessionId=${request.session_id} | duration=${Date.now() - startedAt}ms | ` +
            `detail=${JSON.stringify(detail)}`,
        );
        throw new HttpException(detail, status);
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[Agent] Request failed | sessionId=${request.session_id} | ${message}`,
      );
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }
}
