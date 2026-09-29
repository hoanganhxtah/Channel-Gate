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
    
    this.logger.log(`Zalo webhook received: ${JSON.stringify(payload)}`);
    // this.verifySecretToken(secretToken);

    try {
      const messageCount = await this.zaloService.handleWebhook(payload);
      return {
        status: messageCount > 0 ? 'received' : 'ignored',
        messageCount,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Zalo reply failed: ${message}`);
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
      this.logger.warn('Rejected Zalo webhook with invalid secret token');
      throw new ForbiddenException('Invalid Zalo webhook secret token');
    }
  }
}
