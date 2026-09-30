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
        const senderId = event.sender?.id;
        const pageId = event.recipient?.id;
        const messageText = event.message?.text?.trim();
        const mid = event.message?.mid;
        const isEcho = event.message?.is_echo;

        if (isEcho) {
          this.logger.debug(`[Facebook] Ignored echo message (mid: ${mid})`);
          continue;
        }

        if (!senderId || !messageText) {
          this.logger.warn(
            `[Facebook] Ignored non-text or empty event (senderId: ${senderId || 'N/A'}, mid: ${mid || 'N/A'})`,
          );
          continue;
        }

        this.logger.log(
          `[Facebook] Inbound message | User: ${senderId} -> Page: ${pageId || 'N/A'} | Mid: ${mid || 'N/A'} | Text: "${messageText}"`,
        );

        const replyText = this.replyMessageService.create(messageText);
        this.logger.log(
          `[Facebook] Generated reply for user ${senderId}: "${replyText}"`,
        );

        await this.sendReply(senderId, replyText);
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
    const url = `${graphUrl}/me/messages`;

    const startTime = Date.now();
    try {
      const response = await axios.post(
        url,
        {
          recipient: { id: recipientId },
          message: { text },
        },
        {
          params: { access_token: accessToken },
        },
      );
      const duration = Date.now() - startTime;
      const sentMid = response.data?.message_id ?? 'N/A';
      this.logger.log(
        `[Facebook] Reply sent successfully to user ${recipientId} (${duration}ms) | SentMsgId: ${sentMid}`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.throwChannelError('Facebook', recipientId, error, duration);
    }
  }

  private throwChannelError(
    channel: string,
    recipientId: string,
    error: unknown,
    duration?: number,
  ): never {
    const timing = duration !== undefined ? ` (${duration}ms)` : '';
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? HttpStatus.BAD_GATEWAY;
      const response = error.response?.data ?? { message: error.message };
      this.logger.error(
        `[${channel}] API call failed for ${recipientId}${timing} [HTTP ${status}]: ${JSON.stringify(response)}`,
      );
      throw new HttpException(response, status);
    }

    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`[${channel}] API call failed for ${recipientId}${timing}: ${message}`);
    throw new HttpException(message, HttpStatus.BAD_GATEWAY);
  }
}
