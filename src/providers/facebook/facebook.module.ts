import { Module } from '@nestjs/common';
import { AgentClientModule } from '../../services/agent-client/agent-client.module';
import { FacebookController } from './facebook.controller';
import { FacebookService } from './facebook.service';

@Module({
  imports: [AgentClientModule],
  controllers: [FacebookController],
  providers: [FacebookService],
})
export class FacebookModule {}
