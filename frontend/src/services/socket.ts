import { io, Socket } from 'socket.io-client';

// Resolve socket endpoint: prefer explicit VITE_SOCKET_URL, otherwise derive from API URL
// and fall back to current origin when API URL is relative.
const rawApiUrl = import.meta.env.VITE_API_URL;
const socketUrlFromEnv = (import.meta as any).env?.VITE_SOCKET_URL as string | undefined;

const SOCKET_URL = (() => {
  if (socketUrlFromEnv) return socketUrlFromEnv;
  if (rawApiUrl) {
    // If API URL is absolute, strip the /api/v1 suffix; if relative, use window origin
    if (/^https?:\/\//i.test(rawApiUrl)) {
      return rawApiUrl.replace(/\/api\/v1\/?$/, '');
    }
    return window.location.origin;
  }
  return window.location.origin;
})();

class SocketService {
  private socket: Socket | null = null;

  connect(token: string) {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from WebSocket server');
    });

    this.socket.on('error', (error: any) => {
      console.error('Socket error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback);
  }

  emit(event: string, ...args: any[]) {
    this.socket?.emit(event, ...args);
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
