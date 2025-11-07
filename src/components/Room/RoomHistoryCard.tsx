import { useState } from 'react';
import { RoomSnapshot, restoreRoom, deleteRoomSnapshot, getRoomSnapshot } from '../../api/rooms';

interface RoomHistoryCardProps {
  snapshot: RoomSnapshot;
  onRestore: (roomCode: string) => void;
  onDelete: (saveId: string) => void;
}

export const RoomHistoryCard: React.FC<RoomHistoryCardProps> = ({
  snapshot,
  onRestore,
  onDelete,
}) => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleRestore = async () => {
    try {
      setIsRestoring(true);
      setError(null);
      const result = await restoreRoom(snapshot.id);
      onRestore(result.roomCode || snapshot.roomCode);
    } catch (err: any) {
      setError(err.message || 'Ошибка восстановления комнаты');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Вы уверены, что хотите удалить это сохранение?')) {
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);
      await deleteRoomSnapshot(snapshot.id);
      onDelete(snapshot.id);
    } catch (err: any) {
      setError(err.message || 'Ошибка удаления сохранения');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async () => {
    try {
      setError(null);
      const data = await getRoomSnapshot(snapshot.id);
      
      // Создаем JSON файл для скачивания
      const jsonData = {
        id: data.id,
        roomCode: data.roomCode,
        gameStarted: data.gameStarted,
        createdAt: data.createdAt,
        state: JSON.parse(data.state),
      };

      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `room-snapshot-${snapshot.roomCode}-${snapshot.id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Ошибка скачивания сохранения');
    }
  };

  return (
    <div
      style={{
        padding: '20px',
        marginBottom: '15px',
        background: '#fff',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
        <div>
          <h3 style={{ color: '#333', margin: '0 0 5px 0', fontSize: '18px' }}>
            Комната: {snapshot.roomCode}
          </h3>
          <div style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
            Дата сохранения: {formatDate(snapshot.createdAt)}
          </div>
          <div style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
            Игроков: {snapshot.players.length}
          </div>
        </div>
        <div>
          <span
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              background: snapshot.gameStarted ? '#28a745' : '#ffc107',
              color: snapshot.gameStarted ? '#fff' : '#333',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
          >
            {snapshot.gameStarted ? 'Игра начата' : 'Ожидание'}
          </span>
        </div>
      </div>

      {error && (
        <div style={{ color: '#dc3545', marginBottom: '15px', padding: '10px', background: '#f8d7da', borderRadius: '4px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={handleRestore}
          disabled={isRestoring || isDeleting}
          style={{
            padding: '8px 16px',
            background: isRestoring ? '#6c757d' : '#28a745',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isRestoring || isDeleting ? 'not-allowed' : 'pointer',
            fontSize: '14px',
          }}
        >
          {isRestoring ? 'Восстановление...' : 'Восстановить комнату'}
        </button>
        <button
          onClick={handleDownload}
          disabled={isRestoring || isDeleting}
          style={{
            padding: '8px 16px',
            background: isRestoring || isDeleting ? '#6c757d' : '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isRestoring || isDeleting ? 'not-allowed' : 'pointer',
            fontSize: '14px',
          }}
        >
          Скачать сохранение
        </button>
        <button
          onClick={handleDelete}
          disabled={isRestoring || isDeleting}
          style={{
            padding: '8px 16px',
            background: isDeleting ? '#6c757d' : '#dc3545',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isRestoring || isDeleting ? 'not-allowed' : 'pointer',
            fontSize: '14px',
          }}
        >
          {isDeleting ? 'Удаление...' : 'Удалить'}
        </button>
      </div>
    </div>
  );
};

