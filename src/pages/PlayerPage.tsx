import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getCharacters, updateCharacter, type Character } from '../api/characters';
import './PlayerPage.css';

const PlayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadCharacter();
    }
  }, [id]);

  const loadCharacter = async () => {
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

  const updateCharacterStat = async (field: keyof Character, value: any) => {
    if (!character || !id) return;

    const updatedCharacter = {
      ...character,
      [field]: value,
    };
    setCharacter(updatedCharacter);
  };

  const handleSave = async () => {
    if (!character || !id) return;

    setIsSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      // Подготавливаем данные для обновления
      const updateData: any = {
        characterName: character.characterName,
        level: character.level,
        experience: character.experience,
        hp: character.hp,
        maxHp: character.maxHp,
        locationId: character.locationId,
        strength: character.strength,
        dexterity: character.dexterity,
        constitution: character.constitution,
        intelligence: character.intelligence,
        wisdom: character.wisdom,
        charisma: character.charisma,
        class: character.class,
        race: character.race,
        armorClass: character.armorClass,
        initiative: character.initiative,
        speed: character.speed,
        inventory: character.inventory,
      };

      const updated = await updateCharacter(id, updateData);
      setCharacter(updated);
      setSaveMessage('Изменения сохранены');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения персонажа');
    } finally {
      setIsSaving(false);
    }
  };

  const getModifier = (abilityScore: number): string => {
    const modifier = Math.floor((abilityScore - 10) / 2);
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
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
    <div className="player-page">
      <div className="player-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Link
              to="/characters"
              style={{ color: '#007bff', textDecoration: 'none', marginBottom: '10px', display: 'block' }}
            >
              ← Вернуться к списку персонажей
            </Link>
            <h1>Персонаж: {character.characterName || 'Безымянный'}</h1>
          </div>
          <div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: '10px 20px',
                background: isSaving ? '#6c757d' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                marginRight: '10px',
              }}
            >
              {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
            {saveMessage && (
              <span style={{ color: '#28a745', fontSize: '14px' }}>{saveMessage}</span>
            )}
          </div>
        </div>
        {error && (
          <div
            style={{
              color: 'red',
              marginTop: '10px',
              padding: '10px',
              background: '#ffebee',
              borderRadius: '4px',
            }}
          >
            {error}
          </div>
        )}
      </div>

      <div className="player-content">
        <div className="player-main-info">
          <div className="character-sheet">
            <div className="basic-info">
              <h2>Основная информация</h2>
              <div className="info-grid">
                <div className="info-item">
                  <label>Имя:</label>
                  <input
                    type="text"
                    value={character.characterName || ''}
                    onChange={(e) => updateCharacterStat('characterName', e.target.value)}
                  />
                </div>
                <div className="info-item">
                  <label>Раса:</label>
                  <input
                    type="text"
                    value={character.race || ''}
                    onChange={(e) => updateCharacterStat('race', e.target.value)}
                  />
                </div>
                <div className="info-item">
                  <label>Класс:</label>
                  <input
                    type="text"
                    value={character.class || ''}
                    onChange={(e) => updateCharacterStat('class', e.target.value)}
                  />
                </div>
                <div className="info-item">
                  <label>Уровень:</label>
                  <input
                    type="number"
                    value={character.level || 1}
                    onChange={(e) => updateCharacterStat('level', parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
            </div>

            <div className="combat-stats">
              <h2>Боевые характеристики</h2>
              <div className="stats-grid">
                <div className="stat-item">
                  <label>HP:</label>
                  <input
                    type="number"
                    value={character.hp || 0}
                    onChange={(e) => updateCharacterStat('hp', parseInt(e.target.value) || 0)}
                  />
                  <span>/ {character.maxHp || 0}</span>
                </div>
                <div className="stat-item">
                  <label>Макс. HP:</label>
                  <input
                    type="number"
                    value={character.maxHp || 0}
                    onChange={(e) => updateCharacterStat('maxHp', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="stat-item">
                  <label>КД:</label>
                  <input
                    type="number"
                    value={character.armorClass || 0}
                    onChange={(e) => updateCharacterStat('armorClass', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="stat-item">
                  <label>Инициатива:</label>
                  <input
                    type="number"
                    value={character.initiative || 0}
                    onChange={(e) => updateCharacterStat('initiative', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="stat-item">
                  <label>Скорость:</label>
                  <input
                    type="number"
                    value={character.speed || 0}
                    onChange={(e) => updateCharacterStat('speed', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            <div className="ability-scores">
              <h2>Характеристики</h2>
              <div className="abilities-grid">
                {[
                  { key: 'strength', name: 'Сила' },
                  { key: 'dexterity', name: 'Ловкость' },
                  { key: 'constitution', name: 'Телосложение' },
                  { key: 'intelligence', name: 'Интеллект' },
                  { key: 'wisdom', name: 'Мудрость' },
                  { key: 'charisma', name: 'Харизма' },
                ].map(({ key, name }) => (
                  <div key={key} className="ability-item">
                    <label>{name}:</label>
                    <input
                      type="number"
                      value={character[key as keyof Character] as number || 10}
                      onChange={(e) =>
                        updateCharacterStat(key as keyof Character, parseInt(e.target.value) || 10)
                      }
                    />
                    <span className="modifier">
                      {getModifier((character[key as keyof Character] as number) || 10)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="experience-section">
              <h2>Опыт</h2>
              <div className="exp-item">
                <label>Опыт:</label>
                <input
                  type="number"
                  value={character.experience || 0}
                  onChange={(e) => updateCharacterStat('experience', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="inventory-section">
              <h2>Инвентарь</h2>
              <div className="inventory-list">
                {character.inventory && character.inventory.length > 0 ? (
                  character.inventory.map((item, index) => (
                    <div key={index} className="inventory-item">
                      {item}
                    </div>
                  ))
                ) : (
                  <div>Инвентарь пуст</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerPage;
