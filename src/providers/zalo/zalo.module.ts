import { Module } from '@nestjs/common';
import { AgentClientModule } from '../../services/agent-client/agent-client.module';
import { ZaloController } from './zalo.controller';
import { ZaloService } from './zalo.service';

@Module({
  imports: [AgentClientModule],
  controllers: [ZaloController],
  providers: [ZaloService],
})
export class ZaloModule {}
