import { create } from 'zustand';
import { Socket } from 'socket.io-client';

interface AppState {
  user: any | null;
  isAuthenticated: boolean;
  socket: Socket | null;
  isOnline: boolean;
  chats: any[];
  setUser: (user: any) => void;
  setSocket: (socket: Socket | null) => void;
  setOnline: (online: boolean) => void;
  logout: () => void;
}

export const useStore = create<AppState>((set) => ({
  user: null, isAuthenticated: false, socket: null, isOnline: true, chats: [],
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setSocket: (socket) => set({ socket }),
  setOnline: (online) => set({ isOnline: online }),
  logout: () => set({ user: null, isAuthenticated: false, socket: null }),
}));