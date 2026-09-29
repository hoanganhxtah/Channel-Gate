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
    const recipientId = payload.message?.chat?.id ?? payload.message?.from?.id;
    const message = payload.message?.text?.trim();

    if (!recipientId || !message) {
      this.logger.warn(
        `Ignored Zalo webhook event ${payload.event_name ?? 'unknown'}: no text message or chat id`,
      );
      return 0;
    }

    await this.sendReply(
      recipientId,
      this.replyMessageService.create(message),
    );
    return 1;
  }

  private async sendReply(recipientId: string, text: string): Promise<void> {
    const apiUrl = this.configService
      .get<string>('ZALO_BOT_API_URL', 'https://bot-api.zaloplatforms.com')
      .replace(/\/$/, '');
    const botToken = this.configService.getOrThrow<string>('ZALO_BOT_TOKEN');
    const url = `${apiUrl}/bot${botToken}/sendMessage`;

    try {
      const response = await axios.post(
        url,
        {
          chat_id: recipientId,
          text,
        },
      );

      if (!response.data?.ok) {
        throw new HttpException(
          response.data?.description ?? 'Zalo Bot API rejected the message',
          HttpStatus.BAD_GATEWAY,
        );
      }

      this.logger.log(`Zalo reply sent to ${recipientId}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? HttpStatus.BAD_GATEWAY;
        const response = error.response?.data ?? { message: error.message };
        this.logger.error(
          `Zalo reply failed for ${recipientId}: ${JSON.stringify(response)}`,
        );
        throw new HttpException(response, status);
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Zalo reply failed for ${recipientId}: ${message}`);
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }
}
