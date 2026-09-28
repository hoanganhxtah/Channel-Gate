import { Module } from '@nestjs/common';
import { ReplyMessageModule } from '../../services/reply-message/reply-message.module';
import { ZaloController } from './zalo.controller';
import { ZaloService } from './zalo.service';

@Module({
  imports: [ReplyMessageModule],
  controllers: [ZaloController],
  providers: [ZaloService],
})
export class ZaloModule {}
