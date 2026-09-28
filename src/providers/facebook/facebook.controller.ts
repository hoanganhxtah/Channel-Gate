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
      return challenge;
    }

    throw new ForbiddenException('Invalid Facebook verification request');
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(@Body() payload: FacebookWebhookDto) {
    try {
      const messageCount = await this.facebookService.handleWebhook(payload);
      return {
        status: messageCount > 0 ? 'received' : 'ignored',
        messageCount,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Facebook reply failed: ${message}`);
      return { status: 'received', replyStatus: 'failed' };
    }
  }
}
