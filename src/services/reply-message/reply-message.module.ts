import { Module } from '@nestjs/common';
import { ReplyMessageService } from './reply-message.service';

@Module({
  providers: [ReplyMessageService],
  exports: [ReplyMessageService],
})
export class ReplyMessageModule {}
