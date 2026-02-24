import { useEffect, useState } from 'react';
import { getRoomHistory, restoreRoom, deleteRoomSnapshot, isRoomExists, RoomSnapshot } from '../../api/rooms';

interface RoomHistoryProps {
  onRoomRestored: (roomCode: string) => void;
}

export const RoomHistory: React.FC<RoomHistoryProps> = ({ onRoomRestored }) => {
  const [snapshots, setSnapshots] = useState<RoomSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

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

  const handleRestore = async (saveId: string, roomCode: string) => {
    try {
      setRestoringId(saveId);
      setError(null);
      const result = await restoreRoom(saveId);
      onRoomRestored(result.roomCode || roomCode);
    } catch (err: any) {
      setError(err.message || 'Ошибка восстановления комнаты');
    } finally {
      setRestoringId(null);
    }
  };

  const handleDeleteGroup = async (saveIds: string[]) => {
    const msg = saveIds.length > 1
      ? `Удалить все ${saveIds.length} сохранения этой комнаты?`
      : 'Удалить это сохранение из истории?';
    if (!confirm(msg)) return;
    try {
      setDeletingIds((prev) => new Set([...prev, ...saveIds]));
      setError(null);
      for (const id of saveIds) {
        await deleteRoomSnapshot(id);
      }
      setSnapshots((prev) => prev.filter((s) => !saveIds.includes(s.id)));
    } catch (err: any) {
      setError(err.message || 'Ошибка удаления');
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        saveIds.forEach((id) => next.delete(id));
        return next;
      });
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
            {groupedByRoom.map(({ roomCode, snapshots: group }) => {
              const latest = group[0];
              const allSaveIds = group.map((s) => s.id);
              const isDeleting = allSaveIds.some((id) => deletingIds.has(id));
              return (
                <tr
                  key={roomCode}
                  style={{
                    borderBottom: '1px solid #dee2e6',
                  }}
                >
                  <td style={{ padding: '12px', color: '#333', fontWeight: 'bold' }}>
                    {latest.roomCode}
                  </td>
                  <td style={{ padding: '12px', color: '#666' }}>
                    {latest.players.length} игрок(ов)
                    {allSaveIds.length > 1 && (
                      <span style={{ marginLeft: '6px', color: '#888' }}>
                        ({allSaveIds.length} сохран.)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: latest.gameStarted ? '#28a745' : '#ffc107',
                        color: latest.gameStarted ? '#fff' : '#333',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                    >
                      {latest.gameStarted ? 'Игра начата' : 'Ожидание'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: '#666' }}>
                    {formatDate(latest.createdAt)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleRestore(latest.id, latest.roomCode)}
                        disabled={restoringId === latest.id || isDeleting}
                        style={{
                          padding: '6px 12px',
                          background: restoringId === latest.id ? '#6c757d' : '#28a745',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: restoringId === latest.id || isDeleting ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        {restoringId === latest.id ? 'Восстановление...' : 'Продолжить'}
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(allSaveIds)}
                        disabled={restoringId === latest.id || isDeleting}
                        style={{
                          padding: '6px 12px',
                          background: isDeleting ? '#6c757d' : '#dc3545',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: restoringId === latest.id || isDeleting ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        {isDeleting ? 'Удаление...' : 'Удалить'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

