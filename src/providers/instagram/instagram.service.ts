import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  InstagramMessagingEventDto,
  InstagramWebhookDto,
} from '../../dtos/instagram/instagram-webhook.dto';
import { ReplyMessageService } from '../../services/reply-message/reply-message.service';

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly replyMessageService: ReplyMessageService,
  ) {}

  async handleWebhook(payload: InstagramWebhookDto): Promise<number> {
    const events = this.extractMessageEvents(payload);

    if (events.length === 0) {
      this.logger.debug(
        `[Instagram] Webhook received but no actionable message events found in payload`,
      );
      return 0;
    }

    for (const event of events) {
      const senderId = event.sender!.id!;
      const text = event.message!.text!.trim();
      const mid = event.message?.mid;

      this.logger.log(
        `[Instagram] Inbound message | User: ${senderId} | Mid: ${mid || 'N/A'} | Text: "${text}"`,
      );

      const replyText = this.replyMessageService.create(text);
      this.logger.log(
        `[Instagram] Generated reply for user ${senderId}: "${replyText}"`,
      );

      await this.sendReply(senderId, replyText);
    }

    return events.length;
  }

  private extractMessageEvents(
    payload: InstagramWebhookDto,
  ): InstagramMessagingEventDto[] {
    return (payload.entry ?? [])
      .flatMap((entry) => [
        ...(entry.messaging ?? []),
        ...(entry.standby ?? []),
      ])
      .filter(
        (event) =>
          Boolean(event.sender?.id) &&
          Boolean(event.message?.text?.trim()) &&
          !event.message?.is_echo,
      );
  }

  private async sendReply(recipientId: string, text: string): Promise<void> {
    const url =
      this.configService.get<string>('INSTAGRAM_REPLY_API_URL') ??
      this.configService.getOrThrow<string>('INSTAGRAM_REPLY_APIC_URL');
    const accessToken = this.configService.getOrThrow<string>(
      'INSTAGRAM_PAGE_ACCESS_TOKEN',
    );

    const startTime = Date.now();
    try {
      const response = await axios.post(
        url,
        {
          recipient: { id: recipientId },
          message: { text },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const duration = Date.now() - startTime;
      const sentMid = response.data?.message_id ?? 'N/A';
      this.logger.log(
        `[Instagram] Reply sent successfully to user ${recipientId} (${duration}ms) | SentMsgId: ${sentMid}`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? HttpStatus.BAD_GATEWAY;
        const response = error.response?.data ?? { message: error.message };
        this.logger.error(
          `[Instagram] API call failed for ${recipientId} (${duration}ms) [HTTP ${status}]: ${JSON.stringify(response)}`,
        );
        throw new HttpException(response, status);
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Instagram] API call failed for ${recipientId} (${duration}ms): ${message}`);
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }
}
