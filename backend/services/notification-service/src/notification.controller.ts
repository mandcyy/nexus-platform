import { Controller, Get } from '@nestjs/common';

@Controller('notifications')
export class NotificationController {
  @Get('health')
  health() { return { status: 'ok' }; }
}