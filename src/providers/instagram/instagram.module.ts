import { Module } from '@nestjs/common';
import { AgentClientModule } from '../../services/agent-client/agent-client.module';
import { InstagramController } from './instagram.controller';
import { InstagramService } from './instagram.service';

@Module({
  imports: [AgentClientModule],
  controllers: [InstagramController],
  providers: [InstagramService],
})
export class InstagramModule {}
