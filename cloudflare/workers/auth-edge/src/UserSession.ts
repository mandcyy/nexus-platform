/**
 * Nexus Platform — UserSession Durable Object
 * Manages WebSocket connections per user across all devices.
 */

interface DeviceSession {
  deviceId: string;
  socket: WebSocket;
  connectedAt: number;
}

export class UserSession {
  private devices: Map<string, DeviceSession> = new Map();

  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      const url = new URL(request.url);
      const deviceId = url.searchParams.get('deviceId') || 'unknown';

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.devices.set(deviceId, { deviceId, socket: server, connectedAt: Date.now() });

      server.accept();

      server.addEventListener('message', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string);

          // Route to appropriate chat room
          if (data.type === 'chat:join') {
            // Forward to ChatRoom DO
            this.sendToChatRoom(data.chatId, data, deviceId);
          }
        } catch (err) {
          console.error('Session message error:', err);
        }
      });

      server.addEventListener('close', () => {
        this.devices.delete(deviceId);
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('WebSocket only', { status: 400 });
  }

  private async sendToChatRoom(chatId: string, data: any, deviceId: string) {
    // Route messages to the appropriate ChatRoom DO
    // This is where the user session acts as a proxy to chat rooms
  }

  getDeviceCount(): number {
    return this.devices.size;
  }
}