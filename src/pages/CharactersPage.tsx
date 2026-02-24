import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCharacters, type Character } from '../api/characters';
import CharacterCard from '../components/Character/CharacterCard';
import { CreateCharacterSheet } from '../components/Character/CreateCharacterSheet';

const CharactersPage: React.FC = () => {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

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

  const handleCreated = (character: Character) => {
    loadCharacters();
    setShowCreateForm(false);
    navigate(`/characters/${character.id}`);
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
        <div style={{ marginBottom: '20px', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
          <CreateCharacterSheet
            onCancel={() => { setShowCreateForm(false); setError(null); }}
            onCreated={handleCreated}
          />
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

