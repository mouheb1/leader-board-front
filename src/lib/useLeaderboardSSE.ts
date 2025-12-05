import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import type { LeaderboardTeam } from '@/types';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

interface UseLeaderboardSocketOptions {
  enabled?: boolean;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: string) => void;
}

/**
 * Hook that establishes a Socket.IO connection to receive real-time leaderboard updates.
 * Automatically updates React Query cache when new data arrives.
 */
export function useLeaderboardSSE(options: UseLeaderboardSocketOptions = {}) {
  const { enabled = true, onConnectionChange, onError } = options;
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;

    // Don't create duplicate connections
    if (socketRef.current?.connected) {
      return;
    }

    console.log('[useLeaderboardSocket] Connecting to Socket.IO...', SOCKET_URL);

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[useLeaderboardSocket] Connected');
      onConnectionChange?.(true);
    });

    socket.on('leaderboard:update', (leaderboard: LeaderboardTeam[]) => {
      console.log('[useLeaderboardSocket] Leaderboard updated:', leaderboard.length, 'teams');
      queryClient.setQueryData(['leaderboard'], leaderboard);
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    });

    socket.on('disconnect', (reason) => {
      console.log('[useLeaderboardSocket] Disconnected:', reason);
      onConnectionChange?.(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[useLeaderboardSocket] Connection error:', error);
      onError?.('Connection failed. Retrying...');
    });
  }, [enabled, queryClient, onConnectionChange, onError]);

  useEffect(() => {
    connect();

    return () => {
      console.log('[useLeaderboardSocket] Cleaning up connection');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect]);

  return {
    reconnect: connect,
  };
}
