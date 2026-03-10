import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useSocket } from "../store/socketContext";
import { CreateRoomForm } from "../components/Room/CreateRoomForm";
import { JoinRoomForm } from "../components/Room/JoinRoomForm";
import { FindRoomPanel } from "../components/Room/FindRoomPanel";
import { RoomLobby } from "../components/Room/RoomLobby";
import { RoomHistory } from "../components/Room/RoomHistory";
import "./GamePage.css";

type GamePageView = 'menu' | 'create' | 'join' | 'find' | 'lobby';

const GamePage: React.FC = () => {
  const { roomCode: urlRoomCode } = useParams<{ roomCode?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState<GamePageView>('menu');
  const [joinInitialCode, setJoinInitialCode] = useState<string>('');
  const { roomCode: currentRoomCode, disconnect } = useSocket();
  const justLeftRoomRef = useRef(false);
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);

  // Код комнаты из URL (fallback из pathname, если useParams ещё не обновился при навигации)
  const roomCodeFromUrl = urlRoomCode ?? (location.pathname.match(/^\/room\/([^/]+)$/)?.[1] ?? null);

  // Если уже в комнате по сокету, но открыт меню — переходим в комнату по URL. Не редиректить сразу после выхода из комнаты.
  useEffect(() => {
    if (!currentRoomCode) justLeftRoomRef.current = false;
    if (currentRoomCode && view === 'menu' && !justLeftRoomRef.current) {
      navigate(`/room/${currentRoomCode}`, { replace: true });
    }
  }, [currentRoomCode, view, navigate]);

  // После выхода из комнаты: дожидаемся перехода на главную, затем отключаем сокет и обновляем список сохранённых игр.
  useEffect(() => {
    if (location.pathname === '/' && justLeftRoomRef.current) {
      justLeftRoomRef.current = false;
      disconnect();
      setHistoryRefreshTrigger((t) => t + 1);
    }
  }, [location.pathname, disconnect]);

  // В комнате по URL — показываем лобби (после перезагрузки остаёмся в игре). Пустой код не рендерим.
  if (roomCodeFromUrl && roomCodeFromUrl.trim() !== '') {
    return (
      <RoomLobby
        roomCode={roomCodeFromUrl}
        onLeave={() => {
          justLeftRoomRef.current = true;
          setView('menu');
          navigate('/', { replace: true });
        }}
      />
    );
  }

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
    return (
      <JoinRoomForm
        initialCode={joinInitialCode}
        onRoomJoined={handleRoomJoined}
        onCancel={() => { setView('menu'); setJoinInitialCode(''); }}
      />
    );
  }

  if (view === 'find') {
    return (
      <FindRoomPanel
        onJoinRoom={(code) => { setJoinInitialCode(code); setView('join'); }}
        onCancel={() => setView('menu')}
      />
    );
  }

  return (
    <div className="game-page">
      <div className="game-page-content">
        <h1 className="game-page-title">Игра</h1>
        <div className="game-page-buttons">
          <button
            type="button"
            className="game-page-btn game-page-btn-create"
            onClick={() => setView('create')}
          >
            Создать лобби
          </button>
          <button
            type="button"
            className="game-page-btn game-page-btn-join"
            onClick={() => { setJoinInitialCode(''); setView('join'); }}
          >
            Присоединиться к лобби
          </button>
          <button
            type="button"
            className="game-page-btn game-page-btn-find"
            onClick={() => setView('find')}
          >
            Найти комнату
          </button>
        </div>
      </div>
      <div className="game-page-history">
        <RoomHistory onRoomRestored={handleRoomRestored} refreshTrigger={historyRefreshTrigger} />
      </div>
    </div>
  );
};

export default GamePage;
