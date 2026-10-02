import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  InstagramMessagingEventDto,
  InstagramWebhookDto,
} from '../../dtos/instagram/instagram-webhook.dto';
import { AgentClientService } from '../../services/agent-client/agent-client.service';

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly agentClientService: AgentClientService,
  ) {}

  async handleWebhook(payload: InstagramWebhookDto): Promise<number> {
    const events = this.extractMessageEvents(payload);

    if (events.length === 0) {
      this.logger.debug(
        `[Instagram] Webhook received but no actionable message events found in payload`,
      );
      return 0;
    }

    for (const { event, channelId } of events) {
      const senderId = event.sender!.id!;
      const text = event.message!.text!.trim();
      const mid = event.message?.mid;

      this.logger.log(
        `[Instagram] Inbound message | User: ${senderId} | Mid: ${mid || 'N/A'} | Text: "${text}"`,
      );

      const threadId = `instagram:${channelId}:${senderId}`;
      const agentResponse = await this.agentClientService.chat({
        userId: senderId,
        channel: 'instagram',
        channelId,
        threadId,
        question: text,
      });
      this.logger.log(
        `[Instagram] Agent reply ready | User: ${senderId} | Thread: ${threadId} | Session: ${agentResponse.session_id}`,
      );

      await this.sendReply(senderId, agentResponse.answer);
    }

    return events.length;
  }

  private extractMessageEvents(
    payload: InstagramWebhookDto,
  ): Array<{ event: InstagramMessagingEventDto; channelId: string }> {
    return (payload.entry ?? [])
      .flatMap((entry) =>
        [...(entry.messaging ?? []), ...(entry.standby ?? [])].map(
          (event) => ({
            event,
            channelId: event.recipient?.id ?? entry.id,
          }),
        ),
      )
      .filter(
        ({ event, channelId }) =>
          Boolean(channelId) &&
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
