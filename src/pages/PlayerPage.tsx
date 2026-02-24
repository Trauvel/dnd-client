import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getCharacters, type Character } from '../api/characters';
import { CharacterSheetView } from '../components/Character/CharacterSheetView';
import './PlayerPage.css';

const PlayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadCharacter();
    } else {
      setIsLoading(false);
    }
  }, [id]);

  const loadCharacter = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const characters = await getCharacters();
      const found = characters.find((c) => c.id === id);
      if (found) {
        setCharacter(found);
      } else {
        setError('Персонаж не найден');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки персонажа');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="player-page" style={{ padding: '40px', textAlign: 'center' }}>
        <div>Загрузка персонажа...</div>
      </div>
    );
  }

  if (error && !character) {
    return (
      <div className="player-page" style={{ padding: '40px' }}>
        <div style={{ color: 'red', marginBottom: '20px' }}>{error}</div>
        <Link to="/characters" style={{ color: '#007bff', textDecoration: 'none' }}>
          ← Вернуться к списку персонажей
        </Link>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="player-page" style={{ padding: '40px' }}>
        <div>Персонаж не найден</div>
        <Link to="/characters" style={{ color: '#007bff', textDecoration: 'none' }}>
          ← Вернуться к списку персонажей
        </Link>
      </div>
    );
  }

  return (
    <div className="player-page" style={{ padding: 0 }}>
      <div style={{ padding: '12px 16px', background: '#fff', borderBottom: '1px solid #dee2e6' }}>
        <Link to="/characters" style={{ color: '#007bff', textDecoration: 'none', fontSize: 14 }}>
          ← Вернуться к списку персонажей
        </Link>
      </div>
      <CharacterSheetView
        character={character}
        canEdit={true}
        hideInventory={false}
        onClose={() => navigate('/characters')}
        onSave={loadCharacter}
      />
    </div>
  );
};

export default PlayerPage;
