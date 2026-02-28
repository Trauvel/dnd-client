import { useCallback, useEffect, useRef, useState } from 'react';
import { API_CONFIG } from '../config';

export interface SpeechLogEntry {
  playerId: string;
  text: string;
  tsServer: number;
  type: 'final';
}

function getWsUrl(): string {
  const u = API_CONFIG.SPEECH_WS;
  if (!u) return '';
  return u.startsWith('ws') ? u : `ws://${u.replace(/^https?:\/\//, '')}`;
}

export function useSpeechLog(roomId: string, enabled: boolean) {
  const [entries, setEntries] = useState<SpeechLogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!roomId || !enabled) return;

    const url = getWsUrl();
    if (!url) return;

    cancelledRef.current = false;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (cancelledRef.current) {
        ws.close();
        return;
      }
      setIsConnected(true);
      ws.send(
        JSON.stringify({
          v: 1,
          roomId,
          playerId: '',
          type: 'subscribe',
        })
      );
    };

    ws.onmessage = (event: MessageEvent) => {
      if (cancelledRef.current) return;
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === 'final' && data.text) {
          setEntries((prev) =>
            prev.concat({
              playerId: data.playerId ?? '',
              text: String(data.text).trim(),
              tsServer: Number(data.tsServer) || Date.now(),
              type: 'final',
            })
          );
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      if (!cancelledRef.current) setIsConnected(false);
    };
    ws.onerror = () => {
      if (!cancelledRef.current) setIsConnected(false);
    };

    return () => {
      cancelledRef.current = true;
      wsRef.current = null;
      setIsConnected(false);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close();
      }
    };
  }, [roomId, enabled]);

  const clear = useCallback(() => setEntries([]), []);

  return { entries, isConnected, clear, isAvailable: !!getWsUrl() };
}
