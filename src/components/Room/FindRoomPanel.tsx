import { useEffect, useState } from 'react';
import { getRoomList } from '../../api/rooms';
import type { RoomListItem } from '../../api/rooms';

interface FindRoomPanelProps {
  onJoinRoom: (roomCode: string) => void;
  onCancel: () => void;
}

export const FindRoomPanel: React.FC<FindRoomPanelProps> = ({ onJoinRoom, onCancel }) => {
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRooms = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getRoomList();
      setRooms(response.rooms);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки списка комнат');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ color: '#333', marginBottom: '16px' }}>Найти комнату</h2>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
        Список комнат с мастером, к которым можно подключиться.
      </p>

      {error && (
        <div style={{ color: '#dc3545', marginBottom: '15px', padding: '10px', background: '#f8d7da', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div style={{ color: '#666', textAlign: 'center', padding: '24px' }}>Загрузка...</div>
      ) : rooms.length === 0 ? (
        <div style={{ color: '#666', textAlign: 'center', padding: '24px', background: '#f5f5f5', borderRadius: '8px' }}>
          Нет доступных комнат. Создайте свою или попросите код у мастера.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rooms.map((room) => (
            <li
              key={room.code}
              style={{
                padding: '14px 16px',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ flex: '1 1 200px' }}>
                <div style={{ fontWeight: 600, color: '#333', marginBottom: '4px' }}>
                  Комната {room.code}
                </div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  Мастер: {room.masterUsername}
                  {' · '}
                  Игроков: {room.playersCount}
                  {room.maxPlayers != null ? ` / ${room.maxPlayers}` : ''}
                  {room.isPaused && ' · На паузе'}
                  {room.gameStarted && ' · Игра идёт'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onJoinRoom(room.code)}
                style={{
                  padding: '8px 16px',
                  background: '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Подключиться
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button
          type="button"
          onClick={loadRooms}
          disabled={isLoading}
          style={{
            padding: '10px 16px',
            background: '#6c757d',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          Обновить
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '10px 16px',
            background: '#6c757d',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Назад
        </button>
      </div>
    </div>
  );
};
