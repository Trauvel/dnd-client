import { useState, useEffect } from "react";
import { useSocket } from "../store/socketContext";
import { CreateRoomForm } from "../components/Room/CreateRoomForm";
import { JoinRoomForm } from "../components/Room/JoinRoomForm";
import { RoomLobby } from "../components/Room/RoomLobby";
import { RoomHistory } from "../components/Room/RoomHistory";

type GamePageView = 'menu' | 'create' | 'join' | 'lobby';

const GamePage: React.FC = () => {
  const [view, setView] = useState<GamePageView>('menu');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const { GameState, socket, roomCode: currentRoomCode, disconnect } = useSocket();

  // Если уже в комнате, показываем лобби
  useEffect(() => {
    if (currentRoomCode && view === 'menu' && !roomCode) {
      setRoomCode(currentRoomCode);
      setView('lobby');
    }
  }, [currentRoomCode, view, roomCode]);

  const handleRoomCreated = (code: string) => {
    setRoomCode(code);
    setView('lobby');
  };

  const handleRoomJoined = (code: string) => {
    setRoomCode(code);
    setView('lobby');
  };

  const handleRoomRestored = (code: string) => {
    setRoomCode(code);
    setView('lobby');
  };

  const handleLeaveRoom = () => {
    disconnect();
    setRoomCode(null);
    setView('menu');
  };

  const move = (locationId: string) => {
    socket?.emit("playerAction", {
      action: 'player:move',
      data: {
        'playerId': socket?.id,
        'to': locationId,
      }
    });
  };

  if (view === 'create') {
    return <CreateRoomForm onRoomCreated={handleRoomCreated} onCancel={() => setView('menu')} />;
  }

  if (view === 'join') {
    return <JoinRoomForm onRoomJoined={handleRoomJoined} onCancel={() => setView('menu')} />;
  }

  if (view === 'lobby' && roomCode) {
    return <RoomLobby roomCode={roomCode} onLeave={handleLeaveRoom} />;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ color: '#333', marginBottom: '30px', textAlign: 'center' }}>Игра</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <button
          onClick={() => setView('create')}
          style={{
            padding: '15px 30px',
            fontSize: '16px',
            background: '#28a745',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Создать лобби
        </button>

        <button
          onClick={() => setView('join')}
          style={{
            padding: '15px 30px',
            fontSize: '16px',
            background: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Присоединиться к лобби
        </button>
      </div>

      {/* История игр */}
      <RoomHistory onRoomRestored={handleRoomRestored} />
    </div>
  );
};

export default GamePage;
