import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get('global')
  async globalSearch(@Query('q') query: string) {
    const [messages, users, groups] = await Promise.all([
      this.searchService.searchMessages(query).catch(() => []),
      this.searchService.searchUsers(query).catch(() => []),
      this.searchService.searchGroups(query).catch(() => []),
    ]);
    return { messages, users, groups };
  }

  @Get('messages')
  async searchMessages(@Query('q') query: string, @Query('chatId') chatId?: string) {
    return this.searchService.searchMessages(query, chatId);
  }

  @Get('users')
  async searchUsers(@Query('q') query: string) {
    return this.searchService.searchUsers(query);
  }

  @Get('groups')
  async searchGroups(@Query('q') query: string) {
    return this.searchService.searchGroups(query);
  }
}