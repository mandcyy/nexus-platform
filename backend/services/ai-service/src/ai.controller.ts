import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private ai: AiService) {}

  @Post('summarize')
  async summarize(@Body() dto: { messages: string[] }) {
    return { summary: await this.ai.summarizeChat(dto.messages) };
  }

  @Post('reply-suggestions')
  async replySuggestions(@Body() dto: { context: string[]; tone?: string }) {
    return { suggestions: await this.ai.generateReplySuggestions(dto.context, dto.tone) };
  }

  @Post('grammar-check')
  async grammarCheck(@Body() dto: { text: string }) {
    return this.ai.grammarCheck(dto.text);
  }

  @Post('generate-image')
  async generateImage(@Body() dto: { prompt: string }) {
    return this.ai.generateImage(dto.prompt);
  }

  @Post('generate-sticker')
  async generateSticker(@Body() dto: { description: string }) {
    return this.ai.generateSticker(dto.description);
  }

  @Post('detect-spam')
  async detectSpam(@Body() dto: { message: string }) {
    return this.ai.detectSpam(dto.message);
  }

  @Post('detect-toxicity')
  async detectToxicity(@Body() dto: { message: string }) {
    return this.ai.detectToxicity(dto.message);
  }
}