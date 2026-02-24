import React, { useState } from 'react';
import { updateCharacter, type Character } from '../../api/characters';
import { xpToLevel, getProficiencyBonus } from '../../utils/dndLevel';
import '../../pages/PlayerPage.css';

const ro = (v: unknown) => (v !== undefined && v !== null ? String(v) : '');

export interface CharacterSheetViewProps {
  character: Character;
  canEdit: boolean;
  hideInventory: boolean;
  onClose: () => void;
  onSave?: () => void;
}

export const CharacterSheetView: React.FC<CharacterSheetViewProps> = ({
  character: initialCharacter,
  canEdit,
  hideInventory,
  onClose,
  onSave,
}) => {
  const [character, setCharacter] = useState<Character>(initialCharacter);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateStat = (field: keyof Character, value: unknown) => {
    if (!canEdit) return;
    setCharacter((prev) => ({ ...prev, [field]: value }));
  };

  const getModifier = (abilityScore: number): string => {
    const modifier = Math.floor((abilityScore - 10) / 2);
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  };

  const handleSave = async () => {
    if (!canEdit || !character.id) return;
    setIsSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const updateData: any = {
        characterName: character.characterName,
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
        classArchetype: character.classArchetype ?? undefined,
        race: character.race,
        subrace: character.subrace ?? undefined,
        weight: character.weight ?? undefined,
        height: character.height ?? undefined,
        armorClass: character.armorClass,
        initiative: character.initiative,
        speed: character.speed,
        inventory: (character.inventory ?? []).filter((item) => (item.name ?? '').trim()),
        backstory: character.backstory ?? undefined,
        appearance: character.appearance ?? undefined,
        imageUrl: character.imageUrl ?? undefined,
        gold: character.gold ?? undefined,
      };
      const updated = await updateCharacter(character.id, updateData);
      setCharacter(updated);
      setSaveMessage('Изменения сохранены');
      setTimeout(() => setSaveMessage(null), 3000);
      onSave?.();
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const input = (type: 'text' | 'number', value: string | number, onChange: (v: string | number) => void, opts?: { min?: number; placeholder?: string }) => (
    <input
      type={type}
      value={value}
      onChange={(e) => (type === 'number' ? onChange(parseInt(e.target.value, 10) || 0) : onChange(e.target.value))}
      disabled={!canEdit}
      readOnly={!canEdit}
      min={opts?.min}
      placeholder={opts?.placeholder}
      style={!canEdit ? { background: '#f0f0f0', cursor: 'default' } : undefined}
    />
  );

  return (
    <div className="player-page" style={{ margin: 0, minHeight: 'auto', padding: 16 }}>
      <div className="player-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ margin: 0 }}>{character.characterName || 'Безымянный'}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {canEdit && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  padding: '8px 16px',
                  background: isSaving ? '#6c757d' : '#28a745',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                }}
              >
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            )}
            {saveMessage && <span style={{ color: '#28a745', fontSize: 14 }}>{saveMessage}</span>}
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                background: '#6c757d',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
        {error && (
          <div style={{ color: '#dc3545', marginTop: 8, fontSize: 14 }}>{error}</div>
        )}
      </div>

      <div className="player-content">
        <div className="player-main-info">
          <div className="character-sheet">
            <div className="character-portrait-section">
              <h2>Портрет</h2>
              <div className="portrait-row">
                <div className="portrait-preview">
                  {character.imageUrl ? (
                    <img src={character.imageUrl} alt="Персонаж" className="character-portrait-img" />
                  ) : (
                    <div className="portrait-placeholder">Нет изображения</div>
                  )}
                </div>
                {canEdit && (
                  <div className="portrait-actions">
                    <label className="portrait-upload-btn">
                      Загрузить изображение
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => updateStat('imageUrl', reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    <button type="button" className="portrait-clear-btn" onClick={() => updateStat('imageUrl', '')}>
                      Удалить
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="basic-info">
              <h2>Основная информация</h2>
              <div className="info-grid">
                <div className="info-item">
                  <label>Имя:</label>
                  {input('text', character.characterName || '', (v) => updateStat('characterName', v))}
                </div>
                <div className="info-item">
                  <label>Раса:</label>
                  {input('text', character.race || '', (v) => updateStat('race', v))}
                </div>
                <div className="info-item">
                  <label>Класс:</label>
                  {input('text', character.class || '', (v) => updateStat('class', v))}
                </div>
                <div className="info-item">
                  <label>Архетип класса:</label>
                  {input('text', character.classArchetype ?? '', (v) => updateStat('classArchetype', v), { placeholder: 'например Вор' })}
                </div>
                <div className="info-item">
                  <label>Подраса:</label>
                  {input('text', character.subrace ?? '', (v) => updateStat('subrace', v), { placeholder: 'например Дроу' })}
                </div>
                <div className="info-item">
                  <label>Вес:</label>
                  {input('text', character.weight ?? '', (v) => updateStat('weight', v), { placeholder: '55 кг' })}
                </div>
                <div className="info-item">
                  <label>Рост:</label>
                  {input('text', character.height ?? '', (v) => updateStat('height', v), { placeholder: '185 см' })}
                </div>
                <div className="info-item info-item-full">
                  <label>Золото:</label>
                  {input('text', character.gold ?? '', (v) => updateStat('gold', v), { placeholder: '15 или 1к20' })}
                </div>
              </div>
            </div>

            <div className="backstory-section">
              <h2>Предыстория</h2>
              <textarea
                className="character-textarea"
                value={character.backstory ?? ''}
                onChange={(e) => updateStat('backstory', e.target.value)}
                placeholder="Рассказ о прошлом персонажа..."
                rows={4}
                disabled={!canEdit}
                readOnly={!canEdit}
                style={!canEdit ? { background: '#f0f0f0' } : undefined}
              />
            </div>

            <div className="appearance-section">
              <h2>Внешность</h2>
              <textarea
                className="character-textarea"
                value={character.appearance ?? ''}
                onChange={(e) => updateStat('appearance', e.target.value)}
                placeholder="Описание внешности..."
                rows={3}
                disabled={!canEdit}
                readOnly={!canEdit}
                style={!canEdit ? { background: '#f0f0f0' } : undefined}
              />
            </div>

            <div className="combat-stats">
              <h2>Боевые характеристики</h2>
              <div className="stats-grid">
                <div className="stat-item">
                  <label>HP:</label>
                  {input('number', character.hp ?? 0, (v) => updateStat('hp', v))}
                  <span>/ {ro(character.maxHp ?? 0)}</span>
                </div>
                <div className="stat-item">
                  <label>Макс. HP:</label>
                  {input('number', character.maxHp ?? 0, (v) => updateStat('maxHp', v))}
                </div>
                <div className="stat-item">
                  <label>КД:</label>
                  {input('number', character.armorClass ?? 0, (v) => updateStat('armorClass', v))}
                </div>
                <div className="stat-item">
                  <label>Инициатива:</label>
                  {input('number', character.initiative ?? 0, (v) => updateStat('initiative', v))}
                </div>
                <div className="stat-item">
                  <label>Скорость:</label>
                  {input('number', character.speed ?? 0, (v) => updateStat('speed', v))}
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
                    {input('number', (character[key as keyof Character] as number) ?? 10, (v) => updateStat(key as keyof Character, v))}
                    <span className="modifier">
                      {getModifier((character[key as keyof Character] as number) ?? 10)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="experience-section">
              <h2>Опыт и уровень</h2>
              <div className="exp-level-row">
                <div className="exp-item">
                  <label>Опыт:</label>
                  {input('number', character.experience ?? 0, (v) => updateStat('experience', v), { min: 0 })}
                </div>
                <div className="exp-item exp-item-readonly">
                  <label>Уровень:</label>
                  <span className="exp-value">{xpToLevel(character.experience ?? 0)}</span>
                </div>
                <div className="exp-item exp-item-readonly">
                  <label>Бонус мастерства:</label>
                  <span className="exp-value">+{getProficiencyBonus(xpToLevel(character.experience ?? 0))}</span>
                </div>
              </div>
            </div>

            {!hideInventory && (
              <div className="inventory-section">
                <h2>Инвентарь</h2>
                <div className="inventory-list">
                  {(character.inventory ?? []).map((item, index) => (
                    <div key={index} className="inventory-item editable">
                      <div className="inventory-item-fields">
                        <input
                          type="text"
                          value={item.name ?? ''}
                          onChange={(e) => {
                            const next = [...(character.inventory ?? [])];
                            next[index] = { ...next[index], name: e.target.value };
                            updateStat('inventory', next);
                          }}
                          className="inventory-item-input"
                          placeholder="Название"
                          disabled={!canEdit}
                          readOnly={!canEdit}
                          style={!canEdit ? { background: '#f0f0f0' } : undefined}
                        />
                        <textarea
                          value={item.description ?? ''}
                          onChange={(e) => {
                            const next = [...(character.inventory ?? [])];
                            next[index] = { ...next[index], description: e.target.value };
                            updateStat('inventory', next);
                          }}
                          className="inventory-item-description"
                          placeholder="Описание"
                          rows={2}
                          disabled={!canEdit}
                          readOnly={!canEdit}
                          style={!canEdit ? { background: '#f0f0f0' } : undefined}
                        />
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          className="inventory-remove-btn"
                          onClick={() => updateStat('inventory', (character.inventory ?? []).filter((_, i) => i !== index))}
                          title="Удалить"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {canEdit && (
                    <button
                      type="button"
                      className="inventory-add-btn"
                      onClick={() => updateStat('inventory', [...(character.inventory ?? []), { name: '', description: '' }])}
                    >
                      + Добавить предмет
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
