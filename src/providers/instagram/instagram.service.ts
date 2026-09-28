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

    for (const event of events) {
      await this.sendReply(
        event.sender!.id!,
        this.replyMessageService.create(event.message!.text!.trim()),
      );
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

    try {
      await axios.post(
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
      this.logger.log(`Instagram reply sent to ${recipientId}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? HttpStatus.BAD_GATEWAY;
        const response = error.response?.data ?? { message: error.message };
        this.logger.error(
          `Instagram reply failed for ${recipientId}: ${JSON.stringify(response)}`,
        );
        throw new HttpException(response, status);
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Instagram reply failed for ${recipientId}: ${message}`);
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }
}
