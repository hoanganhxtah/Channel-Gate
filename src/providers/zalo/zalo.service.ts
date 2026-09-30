import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ZaloWebhookDto } from '../../dtos/zalo/zalo-webhook.dto';
import { ReplyMessageService } from '../../services/reply-message/reply-message.service';

@Injectable()
export class ZaloService {
  private readonly logger = new Logger(ZaloService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly replyMessageService: ReplyMessageService,
  ) {}

  async handleWebhook(payload: ZaloWebhookDto): Promise<number> {
    const eventName = payload.event_name ?? 'unknown';
    const recipientId = payload.message?.chat?.id ?? payload.message?.from?.id;
    const senderName = payload.message?.from?.display_name || payload.message?.from?.username || 'Unknown';
    const senderId = payload.message?.from?.id;
    const message = payload.message?.text?.trim();
    const messageId = payload.message?.message_id;

    if (!recipientId || !message) {
      this.logger.warn(
        `[Zalo] Ignored event "${eventName}": missing chat ID or text (recipientId=${recipientId || 'N/A'}, text=${Boolean(message)})`,
      );
      return 0;
    }

    this.logger.log(
      `[Zalo] Inbound message | User: "${senderName}" (id: ${senderId}, chat: ${recipientId}) | MsgId: ${messageId || 'N/A'} | Text: "${message}"`,
    );

    const replyText = this.replyMessageService.create(message);
    this.logger.log(
      `[Zalo] Generated reply for user ${recipientId}: "${replyText}"`,
    );

    await this.sendReply(recipientId, replyText);
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
