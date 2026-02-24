import { useEffect, useState } from 'react';
import { createRoom } from '../../api/rooms';
import type { RoomSettings } from '../../api/rooms';
import { getScenarios, deleteScenario, type Scenario } from '../../api/scenarios';

interface CreateRoomFormProps {
  onRoomCreated: (roomCode: string) => void;
  onCancel: () => void;
}

export const CreateRoomForm: React.FC<CreateRoomFormProps> = ({ onRoomCreated, onCancel }) => {
  const [maxPlayers, setMaxPlayers] = useState<number | undefined>(undefined);
  const [characterSelection, setCharacterSelection] = useState<'predefined' | 'in-room'>('predefined');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      try {
        const list = await getScenarios();
        setScenarios(list);
      } catch (err) {
        // молча игнорируем ошибку загрузки сценариев при создании комнаты
      }
    };
    load();
  }, []);

  const handleDeleteScenario = async (id: string, title: string) => {
    if (!window.confirm(`Удалить сценарий «${title}»?`)) return;
    try {
      await deleteScenario(id);
      const list = await getScenarios();
      setScenarios(list);
      if (scenarioId === id) setScenarioId('');
    } catch (err: any) {
      setError(err.message || 'Ошибка удаления сценария');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const settings: RoomSettings = {
        maxPlayers: maxPlayers && maxPlayers > 0 ? maxPlayers : undefined,
        characterSelection,
        scenarioId: scenarioId || undefined,
      };

      const response = await createRoom(settings);
      onRoomCreated(response.room.code);
    } catch (err: any) {
      setError(err.message || 'Ошибка создания комнаты');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto' }}>
      <h2 style={{ color: '#333', marginBottom: '20px' }}>Создать лобби</h2>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#333' }}>
            Максимальное количество игроков (опционально):
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={maxPlayers || ''}
            onChange={(e) => setMaxPlayers(e.target.value ? parseInt(e.target.value) : undefined)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#333' }}>
            Сценарий (опционально):
          </label>
          <select
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          >
            <option value="">Без сценария</option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          {scenarios.length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '13px', color: '#666' }}>
              <div style={{ marginBottom: '4px' }}>Удалить сценарий:</div>
              {scenarios.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteScenario(s.id, s.title)}
                    style={{
                      padding: '2px 8px',
                      fontSize: '12px',
                      background: '#dc3545',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    title={`Удалить «${s.title}»`}
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#333' }}>
            Выбор персонажа:
          </label>
          <select
            value={characterSelection}
            onChange={(e) => setCharacterSelection(e.target.value as 'predefined' | 'in-room')}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          >
            <option value="predefined">Из созданных</option>
            <option value="in-room">В комнате</option>
          </select>
        </div>

        {error && (
          <div style={{ color: '#dc3545', marginBottom: '15px', padding: '10px', background: '#f8d7da', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="submit"
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px',
              background: '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Создание...' : 'Создать'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px',
              background: '#6c757d',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};

