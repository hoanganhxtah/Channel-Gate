import { Module } from '@nestjs/common';
import { ReplyMessageModule } from '../../services/reply-message/reply-message.module';
import { FacebookController } from './facebook.controller';
import { FacebookService } from './facebook.service';

@Module({
  imports: [ReplyMessageModule],
  controllers: [FacebookController],
  providers: [FacebookService],
})
export class FacebookModule {}
