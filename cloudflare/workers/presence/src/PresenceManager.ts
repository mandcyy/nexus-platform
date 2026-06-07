/**
 * Nexus Platform — Presence Durable Object
 * Tracks online/offline status per user.
 * Lightweight, ephemeral state.
 */

export class PresenceManager {
  private status: string = 'OFFLINE';
  private lastSeen: number = Date.now();

  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/get-presence') {
      return new Response(JSON.stringify({
        status: this.status,
        lastSeen: this.lastSeen,
      }));
    }

    if (request.method === 'POST' && path === '/set-status') {
      const { status } = await request.json!();
      this.status = status;
      if (status === 'OFFLINE') {
        this.lastSeen = Date.now();
      }
      return new Response(JSON.stringify({ success: true }));
    }

    return new Response('Not Found', { status: 404 });
  }
}