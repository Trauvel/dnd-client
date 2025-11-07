import { useEffect, useState } from 'react';
import { getRoomHistory, restoreRoom, RoomSnapshot } from '../../api/rooms';
import { useSocket } from '../../store/socketContext';

interface RoomHistoryProps {
  onRoomRestored: (roomCode: string) => void;
}

export const RoomHistory: React.FC<RoomHistoryProps> = ({ onRoomRestored }) => {
  const [snapshots, setSnapshots] = useState<RoomSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getRoomHistory();
      setSnapshots(response.snapshots);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки истории');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (saveId: string, roomCode: string) => {
    try {
      setRestoringId(saveId);
      setError(null);
      
      // Восстанавливаем комнату
      const result = await restoreRoom(saveId);
      
      // Присоединяемся к восстановленной комнате
      onRoomRestored(result.roomCode || roomCode);
    } catch (err: any) {
      setError(err.message || 'Ошибка восстановления комнаты');
    } finally {
      setRestoringId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        Загрузка истории игр...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ color: '#dc3545', marginBottom: '10px' }}>{error}</div>
        <button
          onClick={loadHistory}
          style={{
            padding: '8px 16px',
            background: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Обновить
        </button>
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        У вас пока нет сохраненных игр
      </div>
    );
  }

  return (
    <div style={{ marginTop: '30px' }}>
      <h2 style={{ color: '#333', marginBottom: '15px' }}>История игр</h2>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            background: '#fff',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              <th
                style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '2px solid #dee2e6',
                  color: '#333',
                  fontWeight: 'bold',
                }}
              >
                Код комнаты
              </th>
              <th
                style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '2px solid #dee2e6',
                  color: '#333',
                  fontWeight: 'bold',
                }}
              >
                Игроки
              </th>
              <th
                style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '2px solid #dee2e6',
                  color: '#333',
                  fontWeight: 'bold',
                }}
              >
                Статус
              </th>
              <th
                style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '2px solid #dee2e6',
                  color: '#333',
                  fontWeight: 'bold',
                }}
              >
                Дата сохранения
              </th>
              <th
                style={{
                  padding: '12px',
                  textAlign: 'center',
                  borderBottom: '2px solid #dee2e6',
                  color: '#333',
                  fontWeight: 'bold',
                }}
              >
                Действия
              </th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((snapshot) => (
              <tr
                key={snapshot.id}
                style={{
                  borderBottom: '1px solid #dee2e6',
                  '&:hover': { background: '#f8f9fa' },
                }}
              >
                <td style={{ padding: '12px', color: '#333', fontWeight: 'bold' }}>
                  {snapshot.roomCode}
                </td>
                <td style={{ padding: '12px', color: '#666' }}>
                  {snapshot.players.length} игрок(ов)
                </td>
                <td style={{ padding: '12px' }}>
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: snapshot.gameStarted ? '#28a745' : '#ffc107',
                      color: snapshot.gameStarted ? '#fff' : '#333',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}
                  >
                    {snapshot.gameStarted ? 'Игра начата' : 'Ожидание'}
                  </span>
                </td>
                <td style={{ padding: '12px', color: '#666' }}>
                  {formatDate(snapshot.createdAt)}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button
                    onClick={() => handleRestore(snapshot.id, snapshot.roomCode)}
                    disabled={restoringId === snapshot.id}
                    style={{
                      padding: '6px 12px',
                      background: restoringId === snapshot.id ? '#6c757d' : '#28a745',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: restoringId === snapshot.id ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    {restoringId === snapshot.id ? 'Восстановление...' : 'Продолжить'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

