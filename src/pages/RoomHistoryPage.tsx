import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRoomHistory, RoomSnapshot } from '../api/rooms';
import { RoomHistoryCard } from '../components/Room/RoomHistoryCard';
import { useSocket } from '../store/socketContext';

const RoomHistoryPage: React.FC = () => {
  const [snapshots, setSnapshots] = useState<RoomSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { connect } = useSocket();

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

  const handleRestore = (roomCode: string) => {
    // Подключаемся к восстановленной комнате
    connect(roomCode);
    // Переходим на страницу игры
    navigate('/');
  };

  const handleDelete = (saveId: string) => {
    // Удаляем сохранение из списка
    setSnapshots(snapshots.filter(s => s.id !== saveId));
  };

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
          {snapshots.map((snapshot) => (
            <RoomHistoryCard
              key={snapshot.id}
              snapshot={snapshot}
              onRestore={handleRestore}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default RoomHistoryPage;

