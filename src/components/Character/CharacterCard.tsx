import { Link } from 'react-router-dom';
import type { Character } from '../../api/characters';

interface CharacterCardProps {
  character: Character;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ character }) => {
  const getModifier = (abilityScore: number): string => {
    const modifier = Math.floor((abilityScore - 10) / 2);
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  };

  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '15px',
        background: '#fff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        color: '#333',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#333' }}>
            {character.characterName || 'Безымянный персонаж'}
          </h3>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '15px', color: '#333' }}>
            <div>
              <strong>Уровень:</strong> {character.level}
            </div>
            <div>
              <strong>Класс:</strong> {character.class || 'Не выбран'}
            </div>
            <div>
              <strong>Раса:</strong> {character.race || 'Не выбрана'}
            </div>
            <div>
              <strong>HP:</strong> {character.hp}/{character.maxHp}
            </div>
            {character.isActive && (
              <span
                style={{
                  background: '#28a745',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
              >
                Активен
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', color: '#333' }}>
            <div>
              <strong>Сила:</strong> {character.strength} ({getModifier(character.strength)})
            </div>
            <div>
              <strong>Ловкость:</strong> {character.dexterity} ({getModifier(character.dexterity)})
            </div>
            <div>
              <strong>Телосложение:</strong> {character.constitution} (
              {getModifier(character.constitution)})
            </div>
            <div>
              <strong>Интеллект:</strong> {character.intelligence} (
              {getModifier(character.intelligence)})
            </div>
            <div>
              <strong>Мудрость:</strong> {character.wisdom} ({getModifier(character.wisdom)})
            </div>
            <div>
              <strong>Харизма:</strong> {character.charisma} ({getModifier(character.charisma)})
            </div>
          </div>
        </div>
        <div style={{ marginLeft: '20px' }}>
          <Link
            to={`/characters/${character.id}`}
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              background: '#007bff',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              marginBottom: '8px',
            }}
          >
            Редактировать
          </Link>
        </div>
      </div>
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        Создан: {new Date(character.createdAt).toLocaleDateString('ru-RU')}
        {character.updatedAt !== character.createdAt && (
          <> • Обновлён: {new Date(character.updatedAt).toLocaleDateString('ru-RU')}</>
        )}
      </div>
    </div>
  );
};

export default CharacterCard;

