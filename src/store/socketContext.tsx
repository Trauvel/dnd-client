import { createContext, useContext, useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import type { GameState } from "../api/socket";
import type { Player } from "../api/player";
import { API_CONFIG } from "../config";
import { getToken } from "../utils/auth";
import { useAuth } from "./authContext";
import { useNotifications } from "../components/Notifications/NotificationSystem";

interface SocketContextType {
  socket: Socket | null;
  GameState: GameState | null;
  roomCode: string | null;
  isConnected: boolean;
  connect: (roomCode?: string) => void;
  disconnect: () => void;
  updatePlayer: (playerData: Partial<Player>) => void;
  sendAction: (action: string, data: any) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [GameState, setState] = useState<GameState | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const { token } = useAuth();
  const { addNotification } = useNotifications();

  const connect = (roomCode?: string) => {
    // Отключаемся от предыдущего соединения, если есть
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const tokenValue = token || getToken();
    if (!tokenValue) {
      console.error("No token available for WebSocket connection");
      setIsConnected(false);
      return;
    }

    // Подключаемся к game-server
    const socket = io(API_CONFIG.GAME_SERVER_WS, {
      auth: {
        token: tokenValue,
        roomCode: roomCode,
      },
      query: {
        roomCode: roomCode,
      },
    });

    socketRef.current = socket;
    setRoomCode(roomCode || null);

    socket.on("connect", () => {
      console.log("Socket connected", roomCode ? `to room ${roomCode}` : "");
      setIsConnected(true);
    });

    socket.on("state:changed", (data: GameState) => {
      setState(data);
    });

    // События комнаты
    socket.on("room:joined", (data: { room: any }) => {
      console.log("Room joined:", data);
      setRoomCode(data.room.code);
      addNotification({
        type: 'success',
        title: 'Присоединение к комнате',
        message: `Вы присоединились к комнате ${data.room.code}`,
        duration: 3000,
      });
    });

    socket.on("room:player-joined", (data: { userId: string; username: string; role: string }) => {
      console.log("Player joined room:", data);
      addNotification({
        type: 'info',
        title: 'Новый игрок',
        message: `${data.username} присоединился к комнате`,
        duration: 3000,
      });
    });

    socket.on("room:player-left", (data: { userId: string; username: string }) => {
      console.log("Player left room:", data);
      addNotification({
        type: 'warning',
        title: 'Игрок вышел',
        message: `${data.username} покинул комнату`,
        duration: 3000,
      });
    });

    socket.on("room:paused", (data: { reason?: string }) => {
      console.log("Room paused:", data);
      addNotification({
        type: 'warning',
        title: 'Игра на паузе',
        message: data.reason || 'Игра поставлена на паузу',
        duration: 5000,
      });
    });

    socket.on("room:resumed", (data: { master: string }) => {
      console.log("Room resumed:", data);
      addNotification({
        type: 'success',
        title: 'Игра возобновлена',
        message: `Игра возобновлена мастером ${data.master}`,
        duration: 3000,
      });
    });

    socket.on("room:master-disconnected", (data: { master: string }) => {
      console.log("Master disconnected:", data);
      addNotification({
        type: 'warning',
        title: 'Мастер отключился',
        message: `Мастер ${data.master} отключился. Игра поставлена на паузу.`,
        duration: 5000,
      });
    });

    socket.on("room:master-reconnected", (data: { master: string; message?: string }) => {
      console.log("Master reconnected:", data);
      addNotification({
        type: 'success',
        title: 'Мастер вернулся',
        message: data.message || `Мастер ${data.master} вернулся в комнату`,
        duration: 3000,
      });
    });

    socket.on("room:master-connected", (data: { master: string }) => {
      console.log("Master connected:", data);
      addNotification({
        type: 'info',
        title: 'Мастер подключился',
        message: `Мастер ${data.master} подключился к комнате`,
        duration: 3000,
      });
    });

    socket.on("room:closed", (data: { reason?: string; message?: string }) => {
      console.log("Room closed:", data);
      addNotification({
        type: 'error',
        title: 'Комната закрыта',
        message: data.message || 'Комната была закрыта',
        duration: 0, // Не исчезает автоматически
      });
    });

    socket.on("room:reopened", (data: { master: string; message?: string }) => {
      console.log("Room reopened:", data);
      addNotification({
        type: 'success',
        title: 'Комната активирована',
        message: data.message || `Комната активирована мастером ${data.master}`,
        duration: 3000,
      });
    });

    socket.on("room:error", (data: { error: string }) => {
      console.error("Room error:", data);
      addNotification({
        type: 'error',
        title: 'Ошибка комнаты',
        message: data.error,
        duration: 5000,
      });
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setRoomCode(null);
    }
  };

  const updatePlayer = (playerData: Partial<Player>) => {
    if (socketRef.current) {
      socketRef.current.emit("playerAction", {
        action: 'player:update',
        data: playerData
      });
    }
  };

  const sendAction = (action: string, data: any) => {
    if (socketRef.current) {
      socketRef.current.emit("playerAction", {
        action,
        data
      });
    }
  };

  // Отключаемся при размонтировании
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ 
      socket: socketRef.current, 
      GameState, 
      roomCode,
      isConnected,
      connect, 
      disconnect,
      updatePlayer,
      sendAction 
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used inside SocketProvider");
  return ctx;
};
