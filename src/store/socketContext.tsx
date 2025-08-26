import { createContext, useContext, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { GameState } from "../api/socket";
import type { Player } from "../api/player";

interface SocketContextType {
  socket: Socket | null;
  GameState: GameState | null;
  connect: (name: string) => void;
  updatePlayer: (playerData: Partial<Player>) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [GameState, setState] = useState<GameState | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const connect = (name: string) => {
    const socket = io("http://localhost:3000");
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected");
      socket.emit("playerAction", {
        action: 'player:join',
        data: {
          name: name,
        }
      });
    });

    socket.on("state:changed", (data: GameState) => {
      setState(data);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });
  };

  const updatePlayer = (playerData: Partial<Player>) => {
    if (socketRef.current) {
      socketRef.current.emit("playerAction", {
        action: 'player:update',
        data: playerData
      });
    }
  };

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, GameState, connect, updatePlayer }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used inside SocketProvider");
  return ctx;
};
