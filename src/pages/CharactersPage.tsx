import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCharacters, createCharacter, type Character } from '../api/characters';
import CharacterCard from '../components/Character/CharacterCard';

const CharactersPage: React.FC = () => {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCharacters();
      setCharacters(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки персонажей');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCharacterName.trim()) {
      setError('Введите имя персонажа');
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const newCharacter = await createCharacter({ characterName: newCharacterName.trim() });
      // Обновляем список персонажей
      await loadCharacters();
      setNewCharacterName('');
      setShowCreateForm(false);
      setIsCreating(false);
      // Переходим на страницу редактирования нового персонажа
      navigate(`/characters/${newCharacter.id}`);
    } catch (err: any) {
      setError(err.message || 'Ошибка создания персонажа');
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Загрузка персонажей...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Мои персонажи</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            padding: '10px 20px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          {showCreateForm ? 'Отмена' : '+ Создать персонажа'}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '15px',
            background: '#ffebee',
            color: '#c62828',
            borderRadius: '4px',
            marginBottom: '20px',
          }}
        >
          {error}
        </div>
      )}

      {showCreateForm && (
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px',
            background: '#f9f9f9',
          }}
        >
          <h2 style={{ marginTop: 0, color: '#333' }}>Создать нового персонажа</h2>
          <form onSubmit={handleCreateCharacter}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>
                Имя персонажа:
              </label>
              <input
                type="text"
                value={newCharacterName}
                onChange={(e) => setNewCharacterName(e.target.value)}
                placeholder="Введите имя персонажа"
                disabled={isCreating}
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  padding: '8px',
                  fontSize: '16px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                disabled={isCreating}
                style={{
                  padding: '10px 20px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isCreating ? 'not-allowed' : 'pointer',
                  opacity: isCreating ? 0.6 : 1,
                  fontSize: '16px',
                }}
              >
                {isCreating ? 'Создание...' : 'Создать'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewCharacterName('');
                  setError(null);
                }}
                disabled={isCreating}
                style={{
                  padding: '10px 20px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isCreating ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                }}
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {characters.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px',
            background: '#f9f9f9',
            borderRadius: '8px',
            border: '1px solid #ddd',
          }}
        >
          <p style={{ fontSize: '18px', color: '#666', marginBottom: '20px' }}>
            У вас пока нет персонажей
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            style={{
              padding: '10px 20px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            Создать первого персонажа
          </button>
        </div>
      ) : (
        <div>
          {characters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CharactersPage;

