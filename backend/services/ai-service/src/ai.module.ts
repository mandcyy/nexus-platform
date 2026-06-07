import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ModerationService } from './moderation.service';
import { TranslationService } from './translation.service';

@Module({
  controllers: [AiController],
  providers: [AiService, ModerationService, TranslationService],
})
export class AiModule {}