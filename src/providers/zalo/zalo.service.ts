import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ZaloWebhookDto } from '../../dtos/zalo/zalo-webhook.dto';
import { AgentClientService } from '../../services/agent-client/agent-client.service';

@Injectable()
export class ZaloService {
  private readonly logger = new Logger(ZaloService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly agentClientService: AgentClientService,
  ) {}

  async handleWebhook(payload: ZaloWebhookDto): Promise<number> {
    const eventName = payload.event_name ?? 'unknown';
    const recipientId = payload.message?.chat?.id ?? payload.message?.from?.id;
    const senderName = payload.message?.from?.display_name || payload.message?.from?.username || 'Unknown';
    const senderId = payload.message?.from?.id;
    const message = payload.message?.text?.trim();
    const messageId = payload.message?.message_id;

    if (!recipientId || !senderId || !message) {
      this.logger.warn(
        `[Zalo] Ignored event "${eventName}": missing chat ID, sender ID or text (recipientId=${recipientId || 'N/A'}, senderId=${senderId || 'N/A'}, text=${Boolean(message)})`,
      );
      return 0;
    }

    const channelId = this.configService.getOrThrow<string>('ZALO_CHANNEL_ID');

    this.logger.log(
      `[Zalo] Inbound message | User: "${senderName}" (id: ${senderId}, chat: ${recipientId}) | MsgId: ${messageId || 'N/A'} | Text: "${message}"`,
    );

    const threadId = `zalo:${channelId}:${senderId}`;
    const agentResponse = await this.agentClientService.chat({
      userId: senderId,
      channel: 'zalo',
      channelId,
      threadId,
      question: message,
    });
    this.logger.log(
      `[Zalo] Agent reply ready | User: ${senderId} | Thread: ${threadId} | Session: ${agentResponse.session_id}`,
    );

    await this.sendReply(recipientId, agentResponse.answer);
    return 1;
  }

  private async sendReply(recipientId: string, text: string): Promise<void> {
    const apiUrl = this.configService
      .get<string>('ZALO_BOT_API_URL', 'https://bot-api.zaloplatforms.com')
      .replace(/\/$/, '');
    const botToken = this.configService.getOrThrow<string>('ZALO_BOT_TOKEN');
    const url = `${apiUrl}/bot${botToken}/sendMessage`;

    const startTime = Date.now();
    try {
      const response = await axios.post(
        url,
        {
          chat_id: recipientId,
          text,
        },
      );

      const duration = Date.now() - startTime;
      if (!response.data?.ok) {
        const errorDesc = response.data?.description ?? 'Zalo Bot API rejected the message';
        this.logger.error(
          `[Zalo] Bot API rejected message to ${recipientId} (${duration}ms): ${errorDesc}`,
        );
        throw new HttpException(
          errorDesc,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const resultMsgId = response.data?.result?.message_id ?? 'N/A';
      this.logger.log(
        `[Zalo] Reply sent successfully to chat ${recipientId} (${duration}ms) | SentMsgId: ${resultMsgId}`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? HttpStatus.BAD_GATEWAY;
        const responseData = error.response?.data ?? { message: error.message };
        this.logger.error(
          `[Zalo] API call failed for chat ${recipientId} (${duration}ms) [HTTP ${status}]: ${JSON.stringify(responseData)}`,
        );
        throw new HttpException(responseData, status);
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Zalo] API call failed for chat ${recipientId} (${duration}ms): ${message}`);
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }
}
