import { Controller, Get, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req: any) {
    return this.userService.findById(req.user.id);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Request() req: any, @Body() dto: any) {
    return this.userService.updateProfile(req.user.id, dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getUser(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async search(@Query('q') query: string, @Query('limit') limit?: number) {
    return this.userService.search(query, limit);
  }
}