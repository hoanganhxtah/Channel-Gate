import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ZaloWebhookDto } from '../../dtos/zalo/zalo-webhook.dto';
import { ZaloService } from './zalo.service';

@Controller('zalo')
export class ZaloController {
  private readonly logger = new Logger(ZaloController.name);

  constructor(private readonly zaloService: ZaloService) {}

  @Get('webhook')
  checkWebhook() {
    return { status: 'ok' };
  }

  @Get(['webhook/zalo_verifier:token.html', 'zalo_verifier:token.html'])
  serveVerifier(@Param('token') token: string, @Res() response: Response): void {
    const safeToken = token.replace(/[&<>"']/g, '');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta property="zalo-platform-site-verification" content="${safeToken}" />
</head>
<body>Zalo domain verification</body>
</html>`;

    response.type('html').send(html);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(@Body() payload: ZaloWebhookDto) {
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
}
