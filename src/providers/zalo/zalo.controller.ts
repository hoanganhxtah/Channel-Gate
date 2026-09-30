import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZaloWebhookDto } from '../../dtos/zalo/zalo-webhook.dto';
import { ZaloService } from './zalo.service';

@Controller('zalo')
export class ZaloController {
  private readonly logger = new Logger(ZaloController.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly configService: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(
    @Body() payload: ZaloWebhookDto,
    @Headers('x-bot-api-secret-token') secretToken?: string,
  ) {
    const eventName = payload.event_name ?? 'unknown';
    const sender = payload.message?.from?.display_name || payload.message?.from?.id || 'Unknown';
    this.logger.log(
      `[Zalo] Webhook received | Event: "${eventName}" | Sender: "${sender}" | MsgId: ${payload.message?.message_id || 'N/A'}`,
    );
    // this.verifySecretToken(secretToken);

    try {
      const messageCount = await this.zaloService.handleWebhook(payload);
      const status = messageCount > 0 ? 'received' : 'ignored';
      this.logger.log(`[Zalo] Webhook handled with status: ${status} (processed: ${messageCount})`);
      return {
        status,
        messageCount,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Zalo] Webhook handling failed: ${message}`);
      return { status: 'received', replyStatus: 'failed' };
    }
  }

  private verifySecretToken(receivedToken?: string): void {
    const configuredToken =
      this.configService.get<string>('ZALO_BOT_SECRET_TOKEN') ??
      this.configService.get<string>('ZALO_WEBHOOK_SECRET');

    if (!configuredToken) {
      throw new Error('ZALO_BOT_SECRET_TOKEN is not configured');
    }

    if (receivedToken !== configuredToken) {
      this.logger.warn('[Zalo] Rejected webhook with invalid secret token');
      throw new ForbiddenException('Invalid Zalo webhook secret token');
    }
  }
}
