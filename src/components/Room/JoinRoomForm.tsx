import { useState, useEffect } from 'react';
import { joinRoom, getRoomInfo } from '../../api/rooms';
import { CharacterSelector } from './CharacterSelector';

interface JoinRoomFormProps {
  onRoomJoined: (roomCode: string) => void;
  onCancel: () => void;
}

export const JoinRoomForm: React.FC<JoinRoomFormProps> = ({ onRoomJoined, onCancel }) => {
  const [code, setCode] = useState('');
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [showCharacterSelector, setShowCharacterSelector] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingRoom, setIsCheckingRoom] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Проверяем комнату при вводе кода
  useEffect(() => {
    const checkRoom = async () => {
      if (code.trim().length === 6) {
        setIsCheckingRoom(true);
        setError(null);
        try {
          const response = await getRoomInfo(code.trim());
          setShowCharacterSelector(response.room.characterSelection === 'predefined');
        } catch (err: any) {
          setShowCharacterSelector(false);
          // Не показываем ошибку, если комната просто не найдена
        } finally {
          setIsCheckingRoom(false);
        }
      } else {
        setShowCharacterSelector(false);
      }
    };

    const timeoutId = setTimeout(checkRoom, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!code.trim()) {
      setError('Введите код комнаты');
      setIsLoading(false);
      return;
    }

    try {
      const response = await joinRoom({ 
        code: code.trim(),
        characterId: characterId || undefined,
      });
      onRoomJoined(response.room.code);
    } catch (err: any) {
      setError(err.message || 'Ошибка присоединения к комнате');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto' }}>
      <h2 style={{ color: '#333', marginBottom: '20px' }}>Присоединиться к лобби</h2>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#333' }}>
            Код комнаты:
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ARE32Q"
            maxLength={6}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              textTransform: 'uppercase',
              fontSize: '18px',
              letterSpacing: '2px',
              textAlign: 'center',
            }}
          />
          {isCheckingRoom && (
            <div style={{ color: '#666', fontSize: '12px', marginTop: '5px', textAlign: 'center' }}>
              Проверка комнаты...
            </div>
          )}
        </div>

        {showCharacterSelector && (
          <CharacterSelector
            onSelect={setCharacterId}
            selectedCharacterId={characterId}
            allowNone={true}
          />
        )}

        {error && (
          <div style={{ color: '#dc3545', marginBottom: '15px', padding: '10px', background: '#f8d7da', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="submit"
            disabled={isLoading || !code.trim()}
            style={{
              flex: 1,
              padding: '10px',
              background: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading || !code.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Присоединение...' : 'Присоединиться'}
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

