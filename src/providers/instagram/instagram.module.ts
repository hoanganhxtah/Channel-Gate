import { Module } from '@nestjs/common';
import { ReplyMessageModule } from '../../services/reply-message/reply-message.module';
import { InstagramController } from './instagram.controller';
import { InstagramService } from './instagram.service';

@Module({
  imports: [ReplyMessageModule],
  controllers: [InstagramController],
  providers: [InstagramService],
})
export class InstagramModule {}
