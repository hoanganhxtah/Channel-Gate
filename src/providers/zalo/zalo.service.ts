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
    const recipientId = payload.sender?.id;
    const message = payload.message?.text?.trim();

    if (!recipientId || !message) {
      return 0;
    }

    await this.sendReply(
      recipientId,
      this.replyMessageService.create(message),
    );
    return 1;
  }

  private async sendReply(recipientId: string, text: string): Promise<void> {
    const url =
      this.configService.get<string>('ZALO_REPLY_API_URL') ??
      this.configService.getOrThrow<string>('ZALO_REPLY_APIC_URL');
    const accessToken = this.configService.getOrThrow<string>(
      'ZALO_ACCESS_TOKEN',
    );

    try {
      await axios.post(
        url,
        {
          recipient: { user_id: recipientId },
          message: { text },
        },
        {
          headers: {
            access_token: accessToken,
            'Content-Type': 'application/json',
          },
        },
      );
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
