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
import { FacebookWebhookDto } from '../../dtos/facebook/facebook-webhook.dto';
import { FacebookService } from './facebook.service';

@Controller('facebook')
export class FacebookController {
  private readonly logger = new Logger(FacebookController.name);

  constructor(
    private readonly facebookService: FacebookService,
    private readonly configService: ConfigService,
  ) {}

  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const configuredToken = this.configService.get<string>(
      'FACEBOOK_VERIFY_TOKEN',
    );

    if (mode === 'subscribe' && verifyToken === configuredToken) {
      this.logger.log('[Facebook] Webhook challenge verified successfully');
      return challenge;
    }

    this.logger.warn(`[Facebook] Webhook verification failed (received token: ${verifyToken})`);
    throw new ForbiddenException('Invalid Facebook verification request');
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(@Body() payload: FacebookWebhookDto) {
    const entriesCount = payload.entry?.length ?? 0;
    this.logger.log(
      `[Facebook] Webhook received | Object: "${payload.object || 'unknown'}" | Entries: ${entriesCount}`,
    );

    try {
      const messageCount = await this.facebookService.handleWebhook(payload);
      const status = messageCount > 0 ? 'received' : 'ignored';
      this.logger.log(
        `[Facebook] Webhook handled with status: ${status} (processed: ${messageCount})`,
      );
      return {
        status,
        messageCount,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Facebook] Webhook processing failed: ${message}`);
      return { status: 'received', replyStatus: 'failed' };
    }
  }
}
