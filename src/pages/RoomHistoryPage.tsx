import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRoomHistory, RoomSnapshot, isRoomExists, deleteRoomSnapshot } from '../api/rooms';
import { RoomHistoryCard } from '../components/Room/RoomHistoryCard';

const RoomHistoryPage: React.FC = () => {
  const [snapshots, setSnapshots] = useState<RoomSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getRoomHistory();
      const list = response.snapshots;
      const roomCodes = [...new Set(list.map((s) => s.roomCode))];
      const invalidRooms: string[] = [];
      for (const code of roomCodes) {
        try {
          const exists = await isRoomExists(code);
          if (!exists) invalidRooms.push(code);
        } catch {
          // при ошибке проверки оставляем комнату в списке
        }
      }
      const toDelete = list.filter((s) => invalidRooms.includes(s.roomCode));
      for (const s of toDelete) {
        try {
          await deleteRoomSnapshot(s.id);
        } catch {
          // игнорируем ошибки удаления
        }
      }
      setSnapshots(list.filter((s) => !invalidRooms.includes(s.roomCode)));
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки истории');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = (roomCode: string) => {
    navigate(`/room/${roomCode}`);
  };

  const handleDelete = (saveIds: string[]) => {
    setSnapshots((prev) => prev.filter((s) => !saveIds.includes(s.id)));
  };

  const groupedByRoom = (() => {
    const map = new Map<string, RoomSnapshot[]>();
    for (const s of snapshots) {
      const list = map.get(s.roomCode) ?? [];
      list.push(s);
      map.set(s.roomCode, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return Array.from(map.entries()).map(([roomCode, list]) => ({ roomCode, snapshots: list }));
  })();

  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: '#666', fontSize: '18px' }}>Загрузка истории игр...</div>
      </div>
    );
  }

  if (error && snapshots.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: '#dc3545', marginBottom: '20px', fontSize: '18px' }}>{error}</div>
        <button
          onClick={loadHistory}
          style={{
            padding: '10px 20px',
            background: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          Обновить
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ color: '#333', margin: 0 }}>История игр</h1>
        <button
          onClick={loadHistory}
          style={{
            padding: '8px 16px',
            background: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Обновить
        </button>
      </div>

      {error && (
        <div style={{ color: '#dc3545', marginBottom: '20px', padding: '15px', background: '#f8d7da', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {snapshots.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>У вас пока нет сохраненных игр</div>
          <div style={{ fontSize: '14px' }}>
            Сохранения создаются автоматически при паузе игры или каждые 5 минут во время игры
          </div>
        </div>
      ) : (
        <div>
          {groupedByRoom.map(({ roomCode, snapshots: group }) => {
            const latest = group[0];
            const allSaveIds = group.map((s) => s.id);
            return (
              <RoomHistoryCard
                key={roomCode}
                snapshot={latest}
                allSaveIds={allSaveIds}
                onRestore={handleRestore}
                onDelete={handleDelete}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RoomHistoryPage;

