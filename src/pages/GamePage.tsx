import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useSocket } from "../store/socketContext";
import { CreateRoomForm } from "../components/Room/CreateRoomForm";
import { JoinRoomForm } from "../components/Room/JoinRoomForm";
import { RoomLobby } from "../components/Room/RoomLobby";
import { RoomHistory } from "../components/Room/RoomHistory";

type GamePageView = 'menu' | 'create' | 'join' | 'lobby';

const GamePage: React.FC = () => {
  const { roomCode: urlRoomCode } = useParams<{ roomCode?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState<GamePageView>('menu');
  const { roomCode: currentRoomCode, disconnect } = useSocket();

  // Код комнаты из URL (fallback из pathname, если useParams ещё не обновился при навигации)
  const roomCodeFromUrl = urlRoomCode ?? (location.pathname.match(/^\/room\/([^/]+)$/)?.[1] ?? null);

  // В комнате по URL — показываем лобби (после перезагрузки остаёмся в игре)
  if (roomCodeFromUrl) {
    return (
      <RoomLobby
        roomCode={roomCodeFromUrl}
        onLeave={() => {
          disconnect();
          navigate('/');
        }}
      />
    );
  }

  // Если уже в комнате по сокету, но открыт меню — переходим в комнату по URL
  useEffect(() => {
    if (currentRoomCode && view === 'menu') {
      navigate(`/room/${currentRoomCode}`, { replace: true });
    }
  }, [currentRoomCode, view, navigate]);

  const handleRoomCreated = (code: string) => {
    navigate(`/room/${code}`);
  };

  const handleRoomJoined = (code: string) => {
    navigate(`/room/${code}`);
  };

  const handleRoomRestored = (code: string) => {
    navigate(`/room/${code}`);
  };

  if (view === 'create') {
    return <CreateRoomForm onRoomCreated={handleRoomCreated} onCancel={() => setView('menu')} />;
  }

  if (view === 'join') {
    return <JoinRoomForm onRoomJoined={handleRoomJoined} onCancel={() => setView('menu')} />;
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
