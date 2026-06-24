import { Module } from '@nestjs/common';
import { ConfluentService } from './confluent.service';
import { ConfluentController } from './confluent.controller';

@Module({
  controllers: [ConfluentController],
  providers: [ConfluentService],
  exports: [ConfluentService],
})
export class ConfluentModule {}
