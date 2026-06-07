import {
  Controller, Post, Get, Delete, Body, Param,
  UseGuards, Request, HttpCode, HttpStatus, Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 600000 } })
  async register(@Body() dto: any) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: any) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') token: string) {
    return this.authService.refreshToken(token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Request() req: any, @Body() dto: any) {
    return this.authService.logout(
      req.user.sessionId, dto.allDevices, req.user.id
    );
  }

  @Get('check-username')
  async checkUsername(@Query('username') username: string) {
    const available = await this.authService.checkAvailability('username', username);
    return { available };
  }

  @Get('check-email')
  async checkEmail(@Query('email') email: string) {
    const available = await this.authService.checkAvailability('email', email);
    return { available };
  }

  @Get('check-phone')
  async checkPhone(@Query('phone') phone: string) {
    const available = await this.authService.checkAvailability('phone', phone);
    return { available };
  }

  @Post('send-otp')
  @Throttle({ auth: { limit: 1, ttl: 60000 } })
  async sendOtp(@Body() dto: any) {
    return this.authService.sendOtp(dto.destination, dto.method);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: any) {
    return this.authService.verifyOtp(dto.destination, dto.code, dto.deviceInfo);
  }

  @Get('devices')
  @UseGuards(JwtAuthGuard)
  async getDevices(@Request() req: any) {
    return this.authService.getUserDevices(req.user.id);
  }

  @Delete('devices/:deviceId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeDevice(@Request() req: any, @Param('deviceId') deviceId: string) {
    return this.authService.revokeDevice(req.user.id, deviceId);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async getSessions(@Request() req: any) {
    return this.authService.getSessions(req.user.id);
  }
}