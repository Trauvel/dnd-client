import { useEffect, useState } from 'react';
import { GameRoom, RoomPlayer, pauseRoom, startGame, getRoomInfo } from '../../api/rooms';
import { useSocket } from '../../store/socketContext';
import { useAuth } from '../../store/authContext';

interface RoomLobbyProps {
  roomCode: string;
  onLeave: () => void;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({ roomCode, onLeave }) => {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { connect, isConnected, socket } = useSocket();
  const { user } = useAuth();

  const isMaster = room && user && room.masterId === user.id;

  useEffect(() => {
    loadRoomInfo();
    // Подключаемся к WebSocket комнате
    if (!isConnected) {
      connect(roomCode);
    }

    // Обновляем информацию о комнате периодически
    const interval = setInterval(() => {
      loadRoomInfo();
    }, 5000); // Каждые 5 секунд

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, isConnected]);

  // Обработка событий WebSocket для обновления информации о комнате
  useEffect(() => {
    if (!socket) return;

    const handlePlayerJoined = () => {
      loadRoomInfo();
    };

    const handlePlayerLeft = () => {
      loadRoomInfo();
    };

    const handlePaused = () => {
      loadRoomInfo();
    };

    const handleResumed = () => {
      loadRoomInfo();
    };

    const handleMasterReconnected = () => {
      loadRoomInfo();
    };

    const handleRoomClosed = () => {
      setError('Комната закрыта из-за отсутствия мастера');
    };

    const handleRoomReopened = () => {
      setError(null);
      loadRoomInfo();
    };

    socket.on('room:player-joined', handlePlayerJoined);
    socket.on('room:player-left', handlePlayerLeft);
    socket.on('room:paused', handlePaused);
    socket.on('room:resumed', handleResumed);
    socket.on('room:master-reconnected', handleMasterReconnected);
    socket.on('room:closed', handleRoomClosed);
    socket.on('room:reopened', handleRoomReopened);

    return () => {
      socket.off('room:player-joined', handlePlayerJoined);
      socket.off('room:player-left', handlePlayerLeft);
      socket.off('room:paused', handlePaused);
      socket.off('room:resumed', handleResumed);
      socket.off('room:master-reconnected', handleMasterReconnected);
      socket.off('room:closed', handleRoomClosed);
      socket.off('room:reopened', handleRoomReopened);
    };
  }, [roomCode]);

  const loadRoomInfo = async () => {
    try {
      const response = await getRoomInfo(roomCode);
      setRoom(response.room);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки информации о комнате');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async (paused: boolean) => {
    if (!isMaster) return;

    try {
      await pauseRoom(roomCode, paused);
      await loadRoomInfo();
    } catch (err: any) {
      setError(err.message || 'Ошибка установки паузы');
    }
  };

  const handleStartGame = async () => {
    if (!isMaster) return;

    try {
      await startGame(roomCode);
      await loadRoomInfo();
    } catch (err: any) {
      setError(err.message || 'Ошибка начала игры');
    }
  };

  if (isLoading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Загрузка...</div>;
  }

  if (error && !room) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ color: '#dc3545', marginBottom: '15px' }}>{error}</div>
        <button onClick={onLeave}>Вернуться</button>
      </div>
    );
  }

  if (!room) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Комната не найдена</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: '#333', marginBottom: '10px' }}>Лобби: {room.code}</h2>
        <div style={{ color: '#666', fontSize: '14px' }}>
          Статус: {room.isPaused ? '⏸️ На паузе' : room.gameStarted ? '▶️ Игра идёт' : '⏳ Ожидание'}
        </div>
      </div>

      {error && (
        <div style={{ color: '#dc3545', marginBottom: '15px', padding: '10px', background: '#f8d7da', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: '#333', marginBottom: '10px' }}>Игроки ({room.players.length}{room.maxPlayers ? `/${room.maxPlayers}` : ''}):</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {room.players.map((player: RoomPlayer) => (
            <li
              key={player.userId}
              style={{
                padding: '10px',
                marginBottom: '5px',
                background: player.role === 'master' ? '#fff3cd' : '#f8f9fa',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontWeight: 'bold', color: '#333' }}>{player.username}</span>
                {player.role === 'master' && (
                  <span style={{ marginLeft: '10px', color: '#856404' }}>👑 Мастер</span>
                )}
                {!player.isConnected && (
                  <span style={{ marginLeft: '10px', color: '#6c757d' }}>(отключён)</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {isMaster && (
        <div style={{ marginBottom: '20px', padding: '15px', background: '#e7f3ff', borderRadius: '4px' }}>
          <h3 style={{ color: '#333', marginBottom: '10px' }}>Управление (только для мастера):</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {!room.gameStarted && (
              <button
                onClick={handleStartGame}
                disabled={room.players.length < 1}
                style={{
                  padding: '10px 20px',
                  background: room.players.length < 1 ? '#6c757d' : '#28a745',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: room.players.length < 1 ? 'not-allowed' : 'pointer',
                }}
              >
                Начать игру
              </button>
            )}
            {room.gameStarted && (
              <button
                onClick={() => handlePause(!room.isPaused)}
                style={{
                  padding: '10px 20px',
                  background: room.isPaused ? '#28a745' : '#ffc107',
                  color: room.isPaused ? '#fff' : '#333',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {room.isPaused ? '▶️ Возобновить' : '⏸️ Пауза'}
              </button>
            )}
          </div>
        </div>
      )}

      {!room.isActive && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          background: '#f8d7da', 
          borderRadius: '4px',
          color: '#721c24',
        }}>
          <strong>⚠️ Комната закрыта</strong>
          <p style={{ margin: '10px 0 0 0', fontSize: '14px' }}>
            Комната была закрыта из-за отсутствия мастера. Ожидайте возвращения мастера или покиньте комнату.
          </p>
        </div>
      )}

      <div>
        <button
          onClick={onLeave}
          style={{
            padding: '10px 20px',
            background: '#dc3545',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Покинуть комнату
        </button>
      </div>
    </div>
  );
};

