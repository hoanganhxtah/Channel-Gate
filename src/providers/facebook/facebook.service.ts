import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { FacebookWebhookDto } from '../../dtos/facebook/facebook-webhook.dto';
import { ReplyMessageService } from '../../services/reply-message/reply-message.service';

@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly replyMessageService: ReplyMessageService,
  ) {}

  async handleWebhook(payload: FacebookWebhookDto): Promise<number> {
    let messageCount = 0;

    for (const entry of payload.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        const recipientId = event.sender?.id;
        const message = event.message?.text?.trim();

        if (!recipientId || !message || event.message?.is_echo) {
          continue;
        }

        await this.sendReply(
          recipientId,
          this.replyMessageService.create(message),
        );
        messageCount += 1;
      }
    }

    return messageCount;
  }

  private async sendReply(recipientId: string, text: string): Promise<void> {
    const graphUrl = this.configService
      .getOrThrow<string>('FB_GRAPH_URL')
      .replace(/\/$/, '');
    const accessToken = this.configService.getOrThrow<string>(
      'FACEBOOK_PAGE_ACCESS_TOKEN',
    );

    try {
      await axios.post(
        `${graphUrl}/me/messages`,
        {
          recipient: { id: recipientId },
          message: { text },
        },
        {
          params: { access_token: accessToken },
        },
      );
      this.logger.log(`Facebook reply sent to ${recipientId}`);
    } catch (error) {
      this.throwChannelError('Facebook', recipientId, error);
    }
  }

  private throwChannelError(
    channel: string,
    recipientId: string,
    error: unknown,
  ): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? HttpStatus.BAD_GATEWAY;
      const response = error.response?.data ?? { message: error.message };
      this.logger.error(
        `${channel} reply failed for ${recipientId}: ${JSON.stringify(response)}`,
      );
      throw new HttpException(response, status);
    }

    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`${channel} reply failed for ${recipientId}: ${message}`);
    throw new HttpException(message, HttpStatus.BAD_GATEWAY);
  }
}
