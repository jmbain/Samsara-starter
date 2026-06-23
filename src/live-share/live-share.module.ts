import { Module } from '@nestjs/common';
import { LiveShareController } from './live-share.controller';
import { LiveShareService } from './live-share.service';

@Module({
  controllers: [LiveShareController],
  providers: [LiveShareService],
})
export class LiveShareModule {}
