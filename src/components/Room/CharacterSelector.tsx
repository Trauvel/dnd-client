import { useState, useEffect } from 'react';
import { getCharacters, Character } from '../../api/characters';

interface GetCharactersResponse {
  characters: Character[];
}

interface CharacterSelectorProps {
  onSelect: (characterId: string | null) => void;
  selectedCharacterId?: string | null;
  allowNone?: boolean;
}

export const CharacterSelector: React.FC<CharacterSelectorProps> = ({
  onSelect,
  selectedCharacterId,
  allowNone = true,
}) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const charactersList = await getCharacters();
      setCharacters(charactersList);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки персонажей');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div style={{ color: '#666', fontSize: '14px' }}>Загрузка персонажей...</div>;
  }

  if (error) {
    return (
      <div style={{ color: '#dc3545', fontSize: '14px', marginBottom: '10px' }}>
        {error}
      </div>
    );
  }

  if (characters.length === 0) {
    return (
      <div style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
        У вас нет созданных персонажей
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '15px' }}>
      <label style={{ display: 'block', marginBottom: '5px', color: '#333' }}>
        Выберите персонажа:
      </label>
      <select
        value={selectedCharacterId || ''}
        onChange={(e) => onSelect(e.target.value || null)}
        style={{
          width: '100%',
          padding: '8px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          color: '#333',
        }}
      >
        {allowNone && (
          <option value="">Подключиться без персонажа</option>
        )}
        {characters.map((character) => (
          <option key={character.id} value={character.id}>
            {character.name} (Уровень {character.level}, {character.class || 'Без класса'})
          </option>
        ))}
      </select>
    </div>
  );
};

