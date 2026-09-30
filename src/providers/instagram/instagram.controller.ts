import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InstagramWebhookDto } from '../../dtos/instagram/instagram-webhook.dto';
import { InstagramService } from './instagram.service';

@Controller('instagram')
export class InstagramController {
  private readonly logger = new Logger(InstagramController.name);

  constructor(
    private readonly instagramService: InstagramService,
    private readonly configService: ConfigService,
  ) {}

  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const configuredToken = this.configService.get<string>(
      'INSTAGRAM_VERIFY_TOKEN',
    );

    if (mode === 'subscribe' && verifyToken === configuredToken) {
      this.logger.log('[Instagram] Webhook challenge verified successfully');
      return challenge;
    }

    this.logger.warn(`[Instagram] Webhook verification failed (received token: ${verifyToken})`);
    throw new ForbiddenException('Invalid Instagram verification request');
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(@Body() payload: InstagramWebhookDto) {
    const entriesCount = payload.entry?.length ?? 0;
    this.logger.log(
      `[Instagram] Webhook received | Object: "${payload.object || 'unknown'}" | Entries: ${entriesCount}`,
    );

    try {
      const messageCount = await this.instagramService.handleWebhook(payload);
      const status = messageCount > 0 ? 'received' : 'ignored';
      this.logger.log(
        `[Instagram] Webhook handled with status: ${status} (processed: ${messageCount})`,
      );
      return {
        status,
        messageCount,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Instagram] Webhook processing failed: ${message}`);
      return { status: 'received', replyStatus: 'failed' };
    }
  }
}
