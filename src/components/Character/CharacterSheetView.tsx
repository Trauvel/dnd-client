import React, { useState } from 'react';
import { updateCharacter, type Character } from '../../api/characters';
import { searchUsers, type SearchUserItem } from '../../api/auth';
import { useAuth } from '../../store/authContext';
import { xpToLevel, getProficiencyBonus } from '../../utils/dndLevel';
import {
  type CharacterSheetData,
  DEFAULT_SHEET_DATA,
  DND_SKILLS,
  type AbilityKey,
  ABILITY_KEYS,
  ABILITY_LABELS,
  WEAPON_DAMAGE_TYPES,
  WEAPON_DAMAGE_TYPE_LABELS,
  type WeaponDamageType,
  CONDITION_OPTIONS,
} from '../../types/characterSheet';
import { parseHeight, parseWeight, heightToApi, weightToApi, HEIGHT_CM, WEIGHT_KG } from '../../utils/characterValidators';
import '../../pages/PlayerPage.css';

function normalizeWeapon(
  w: { name: string; damage: string; attackModifier?: string; proficient?: boolean; ability?: AbilityKey; damageType?: WeaponDamageType }
): { name: string; damage: string; attackModifier?: string; proficient: boolean; ability: AbilityKey; damageType?: WeaponDamageType } {
  return {
    name: w.name ?? '',
    damage: w.damage ?? '',
    attackModifier: w.attackModifier,
    proficient: w.proficient ?? false,
    ability: (w.ability && ABILITY_KEYS.includes(w.ability) ? w.ability : 'strength') as AbilityKey,
    damageType: w.damageType && WEAPON_DAMAGE_TYPES.includes(w.damageType) ? w.damageType : undefined,
  };
}

function getSheetData(character: Character): CharacterSheetData {
  const raw = character.characterData;
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SHEET_DATA };
  const data = { ...DEFAULT_SHEET_DATA, ...raw };
  if (data.weapons == null && (raw.weapon != null || raw.attackModifier != null || raw.damage != null)) {
    data.weapons = [normalizeWeapon({ name: raw.weapon ?? '', attackModifier: raw.attackModifier ?? '', damage: raw.damage ?? '' })];
  }
  if (data.weapons) {
    data.weapons = data.weapons.map(normalizeWeapon);
  }
  return data;
}

export interface CharacterSheetViewProps {
  character: Character;
  canEdit: boolean;
  hideInventory: boolean;
  onClose: () => void;
  onSave?: () => void;
  /** Код комнаты — для сохранения мастера от имени игрока */
  roomCode?: string;
}

export const CharacterSheetView: React.FC<CharacterSheetViewProps> = ({
  character: initialCharacter,
  canEdit,
  hideInventory,
  onClose,
  onSave,
  roomCode,
}) => {
  const { user } = useAuth();
  const currentUserId = user?.id;
  const [character, setCharacter] = useState<Character>(initialCharacter);
  const isOwner = character.userId === currentUserId;
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editorSearchQuery, setEditorSearchQuery] = useState('');
  const [editorSearchResults, setEditorSearchResults] = useState<SearchUserItem[]>([]);
  const [editorSearching, setEditorSearching] = useState(false);
  const [sharePanelOpen, setSharePanelOpen] = useState(false);

  const sheetData: CharacterSheetData = getSheetData(character);
  const editorIds = character.editorUserIds ?? [];
  const editorNames = character.editorUserNames ?? {};

  const doEditorSearch = async () => {
    const q = editorSearchQuery.trim();
    if (q.length < 2) return;
    setEditorSearching(true);
    setEditorSearchResults([]);
    try {
      const users = await searchUsers(q);
      setEditorSearchResults(users);
    } catch {
      setEditorSearchResults([]);
    } finally {
      setEditorSearching(false);
    }
  };

  const updateStat = (field: keyof Character, value: unknown) => {
    if (!canEdit) return;
    setCharacter((prev) => ({ ...prev, [field]: value }));
  };

  const updateSheetData = (patch: Partial<CharacterSheetData>) => {
    if (!canEdit) return;
    setCharacter((prev) => ({
      ...prev,
      characterData: { ...getSheetData(prev), ...patch },
    }));
  };

  const getModifier = (abilityScore: number): string => {
    const modifier = Math.floor((abilityScore - 10) / 2);
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  };

  const handleExportJson = () => {
    const json = JSON.stringify(character, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(character.characterName || 'character').replace(/[<>:"/\\|?*]/g, '').slice(0, 80).trim() || 'character'}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
        weight: weightToApi(character.weight) ?? character.weight ?? undefined,
        height: heightToApi(character.height) ?? character.height ?? undefined,
        armorClass: character.armorClass,
        initiative: character.initiative,
        speed: character.speed,
        inventory: (character.inventory ?? []).filter((item) => (item.name ?? '').trim()),
        backstory: character.backstory ?? undefined,
        appearance: character.appearance ?? undefined,
        imageUrl: character.imageUrl ?? undefined,
        gold: character.gold ?? undefined,
        languages: character.languages ?? undefined,
        skills: character.skills ?? undefined,
        characterData: character.characterData ?? undefined,
      };
      if (isOwner && character.editorUserIds !== undefined) {
        updateData.editorUserIds = character.editorUserIds;
      }
      const updated = await updateCharacter(character.id, updateData, roomCode);
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

  const level = xpToLevel(character.experience ?? 0);
  const profBonus = getProficiencyBonus(level);
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
  const sheetStyle = { border: '1px solid #333', padding: '4px 8px', borderRadius: 2, fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
  const labelStyle = { fontWeight: 600, fontSize: 11, textTransform: 'uppercase' as const, marginBottom: 2 };

  return (
    <div className="player-page character-sheet-page" style={{ margin: 0, minHeight: 'auto', padding: 16, width: '100%', background: '#fff', color: '#000' }}>
      <div className="player-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>{character.characterName || 'Безымянный'}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {canEdit && (
            <button onClick={handleSave} disabled={isSaving} style={{ padding: '8px 16px', background: isSaving ? '#6c757d' : '#28a745', color: '#fff', border: 'none', borderRadius: 6, cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: 14 }}>
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          )}
          {saveMessage && <span style={{ color: '#28a745', fontSize: 14 }}>{saveMessage}</span>}
          {canEdit && isOwner && (
            <button
              type="button"
              onClick={() => setSharePanelOpen((v) => !v)}
              style={{
                padding: '8px 16px',
                background: sharePanelOpen ? '#5a6268' : '#6c757d',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Поделиться
            </button>
          )}
          <button type="button" onClick={handleExportJson} style={{ padding: '8px 16px', background: '#0d6efd', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>Экспорт JSON</button>
          <button onClick={onClose} style={{ padding: '8px 16px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>Закрыть</button>
        </div>
        {error && <div style={{ color: '#dc3545', marginTop: 8, fontSize: 14 }}>{error}</div>}
      </div>

      {/* Доступ к карточке — открывается по кнопке «Поделиться» */}
      {canEdit && isOwner && sharePanelOpen && (
        <div style={{ marginBottom: 16, padding: 12, border: '1px solid #dee2e6', borderRadius: 8, background: '#f8f9fa' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Доступ к карточке</h2>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#666' }}>
            Пользователи с доступом могут редактировать карточку вне игры (например, мастер).
          </p>
          <ul style={{ margin: '0 0 10px', paddingLeft: 20 }}>
            {editorIds.map((id) => (
              <li key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span>{editorNames[id] || id}</span>
                <button
                  type="button"
                  onClick={() => {
                    setCharacter((prev) => ({
                      ...prev,
                      editorUserIds: (prev.editorUserIds ?? []).filter((x) => x !== id),
                      editorUserNames: (() => {
                        const next = { ...(prev.editorUserNames ?? {}) };
                        delete next[id];
                        return next;
                      })(),
                    }));
                  }}
                  style={{ padding: '2px 8px', fontSize: 12, border: '1px solid #dc3545', color: '#dc3545', background: '#fff', borderRadius: 4, cursor: 'pointer' }}
                >
                  Удалить
                </button>
              </li>
            ))}
            {editorIds.length === 0 && <li style={{ color: '#999', fontSize: 12 }}>Никого не добавлено</li>}
          </ul>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={editorSearchQuery}
              onChange={(e) => setEditorSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), doEditorSearch())}
              placeholder="Имя пользователя (минимум 2 символа)"
              style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 4, width: 220 }}
            />
            <button
              type="button"
              onClick={doEditorSearch}
              disabled={editorSearching || editorSearchQuery.trim().length < 2}
              style={{ padding: '6px 12px', background: '#0d6efd', color: '#fff', border: 'none', borderRadius: 4, cursor: editorSearching ? 'not-allowed' : 'pointer', fontSize: 13 }}
            >
              {editorSearching ? 'Поиск...' : 'Найти'}
            </button>
          </div>
          {editorSearchResults.length > 0 && (
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              {editorSearchResults.map((u) => {
                const already = editorIds.includes(u.id) || u.id === currentUserId;
                return (
                  <li key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span>{u.username}</span>
                    {already ? (
                      <span style={{ fontSize: 12, color: '#999' }}>{u.id === currentUserId ? 'Вы' : 'Уже добавлен'}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setCharacter((prev) => ({
                            ...prev,
                            editorUserIds: [...(prev.editorUserIds ?? []), u.id],
                            editorUserNames: { ...(prev.editorUserNames ?? {}), [u.id]: u.username },
                          }));
                          setEditorSearchResults([]);
                          setEditorSearchQuery('');
                        }}
                        style={{ padding: '2px 8px', fontSize: 12, background: '#28a745', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Добавить
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Портрет */}
      <div className="character-portrait-section" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Портрет</h2>
        <div className="portrait-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div className="portrait-preview" style={{ width: 120, height: 120, border: '1px solid #333', borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#f5f5f5' }}>
            {character.imageUrl ? (
              <img src={character.imageUrl} alt="Персонаж" className="character-portrait-img" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div className="portrait-placeholder" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#666' }}>Нет изображения</div>
            )}
          </div>
          {canEdit && (
            <div className="portrait-actions" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label className="portrait-upload-btn" style={{ padding: '6px 12px', background: '#0d6efd', color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
                Загрузить
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = () => updateStat('imageUrl', reader.result as string); reader.readAsDataURL(file); } }} />
              </label>
              <button type="button" className="portrait-clear-btn" onClick={() => updateStat('imageUrl', '')} style={{ padding: '6px 12px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Удалить</button>
            </div>
          )}
        </div>
      </div>

      {/* Шапка как на листе */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div><label style={labelStyle}>Имя персонажа</label><br />{input('text', character.characterName || '', (v) => updateStat('characterName', v))}</div>
        <div><label style={labelStyle}>Класс и уровень</label><br /><span style={{ display: 'flex', gap: 4 }}>{input('text', character.class ?? '', (v) => updateStat('class', v))}<span style={{ ...sheetStyle, width: 40, textAlign: 'center', lineHeight: '28px' }}>{level}</span></span></div>
        <div><label style={labelStyle}>Имя игрока</label><br /><input type="text" placeholder="—" readOnly style={{ ...sheetStyle, background: '#f5f5f5' }} /></div>
        <div><label style={labelStyle}>Опыт</label><br />{input('number', character.experience ?? 0, (v) => updateStat('experience', v), { min: 0 })}</div>
        <div><label style={labelStyle}>Раса</label><br />{input('text', character.race ?? '', (v) => updateStat('race', v))}</div>
        <div><label style={labelStyle}>Архетип класса</label><br />{input('text', character.classArchetype ?? '', (v) => updateStat('classArchetype', v), { placeholder: 'например Вор' })}</div>
        <div><label style={labelStyle}>Мировоззрение</label><br /><input type="text" value={sheetData.alignment ?? ''} onChange={(e) => updateSheetData({ alignment: e.target.value })} disabled={!canEdit} style={sheetStyle} /></div>
        <div><label style={labelStyle}>Подраса</label><br />{input('text', character.subrace ?? '', (v) => updateStat('subrace', v), { placeholder: 'например Дроу' })}</div>
        <div><label style={labelStyle}>Вес (кг)</label><br /><input type="number" min={WEIGHT_KG.min} max={WEIGHT_KG.max} value={parseWeight(character.weight) ?? ''} onChange={(e) => { const v = e.target.value; const n = v === '' ? null : parseInt(v, 10); updateStat('weight', n != null && !Number.isNaN(n) ? String(n) : ''); }} disabled={!canEdit} readOnly={!canEdit} placeholder="55" style={!canEdit ? { background: '#f0f0f0', cursor: 'default' } : undefined} /></div>
        <div><label style={labelStyle}>Рост (см)</label><br /><input type="number" min={HEIGHT_CM.min} max={HEIGHT_CM.max} value={parseHeight(character.height) ?? ''} onChange={(e) => { const v = e.target.value; const n = v === '' ? null : parseInt(v, 10); updateStat('height', n != null && !Number.isNaN(n) ? String(n) : ''); }} disabled={!canEdit} readOnly={!canEdit} placeholder="185" style={!canEdit ? { background: '#f0f0f0', cursor: 'default' } : undefined} /></div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Предистория</label>
        <textarea value={character.backstory ?? ''} onChange={(e) => updateStat('backstory', e.target.value)} disabled={!canEdit} rows={3} style={{ ...sheetStyle, resize: 'vertical', width: '100%', marginTop: 4 }} placeholder="Рассказ о прошлом персонажа..." />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Внешность</label>
        <textarea value={character.appearance ?? ''} onChange={(e) => updateStat('appearance', e.target.value)} disabled={!canEdit} rows={2} style={{ ...sheetStyle, resize: 'vertical', width: '100%', marginTop: 4 }} placeholder="Описание внешности..." />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(280px, 1.2fr) minmax(200px, 1fr)', gap: 16, alignItems: 'start' }}>
        {/* Левая колонка: характеристики, спасброски, навыки */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={labelStyle}>Вдохновение</label>
            <input type="checkbox" checked={!!sheetData.inspiration} onChange={(e) => updateSheetData({ inspiration: e.target.checked })} disabled={!canEdit} />
            <label style={labelStyle}>Бонус мастерства</label>
            <span style={{ ...sheetStyle, width: 36, textAlign: 'center' }}>+{profBonus}</span>
          </div>
          {[
            { key: 'strength' as AbilityKey, name: 'Сила' },
            { key: 'dexterity' as AbilityKey, name: 'Ловкость' },
            { key: 'constitution' as AbilityKey, name: 'Телосложение' },
            { key: 'intelligence' as AbilityKey, name: 'Интеллект' },
            { key: 'wisdom' as AbilityKey, name: 'Мудрость' },
            { key: 'charisma' as AbilityKey, name: 'Харизма' },
          ].map(({ key, name }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: '0 0 80px' }}>
                <label style={labelStyle}>{name}</label>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {input('number', (character[key] as number) ?? 10, (v) => updateStat(key, v))}
                  <span style={{ fontSize: 12 }}>{getModifier((character[key] as number) ?? 10)}</span>
                </div>
              </div>
            </div>
          ))}
          <div><h3 style={{ margin: '8px 0 4px', fontSize: 12 }}>Спасброски</h3>
            {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map((abil, i) => {
              const names = ['Сила', 'Ловкость', 'Тел.', 'Инт.', 'Мудрость', 'Хар.'];
              const prof = (sheetData.savingThrowProficiencies ?? []).includes(abil);
              const score = (character[abil as AbilityKey] as number) ?? 10;
              const mod = Math.floor((score - 10) / 2) + (prof ? profBonus : 0);
              return (
                <div key={abil} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <input type="checkbox" checked={prof} onChange={(e) => updateSheetData({ savingThrowProficiencies: e.target.checked ? [...(sheetData.savingThrowProficiencies ?? []), abil] : (sheetData.savingThrowProficiencies ?? []).filter(x => x !== abil) })} disabled={!canEdit} />
                  <span style={{ width: 70, fontSize: 12 }}>{names[i]}</span>
                  <span style={{ ...sheetStyle, width: 40, textAlign: 'center' }}>{mod >= 0 ? '+' : ''}{mod}</span>
                </div>
              );
            })}
          </div>
          <div><h3 style={{ margin: '8px 0 4px', fontSize: 12 }}>Навыки</h3>
            {DND_SKILLS.map((sk) => {
              const prof = (sheetData.skillProficiencies ?? []).includes(sk.key);
              const score = (character[sk.ability] as number) ?? 10;
              const mod = Math.floor((score - 10) / 2) + (prof ? profBonus : 0);
              return (
                <div key={sk.key} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <input type="checkbox" checked={prof} onChange={(e) => updateSheetData({ skillProficiencies: e.target.checked ? [...(sheetData.skillProficiencies ?? []), sk.key] : (sheetData.skillProficiencies ?? []).filter(x => x !== sk.key) })} disabled={!canEdit} />
                  <span style={{ flex: 1, fontSize: 11 }}>{sk.name}</span>
                  <span style={{ ...sheetStyle, width: 36, textAlign: 'center' }}>{mod >= 0 ? '+' : ''}{mod}</span>
                </div>
              );
            })}
          </div>
          <div><label style={labelStyle}>Пассивная мудрость (Внимательность)</label>{input('number', sheetData.passivePerception ?? 10, (v) => updateSheetData({ passivePerception: typeof v === 'number' ? v : parseInt(String(v), 10) || 10 }))}</div>
          <div><label style={labelStyle}>Прочие владения и языки</label><textarea value={sheetData.proficienciesAndLanguages ?? ''} onChange={(e) => updateSheetData({ proficienciesAndLanguages: e.target.value })} disabled={!canEdit} rows={4} style={{ ...sheetStyle, resize: 'vertical' }} /></div>
        </div>

        {/* Центр: КД, инициатива, HP, кости хитов, смерть, атаки, снаряжение */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div><label style={labelStyle}>КД</label>{input('number', character.armorClass ?? 10, (v) => updateStat('armorClass', v))}</div>
            <div><label style={labelStyle}>Инициатива</label>{input('number', character.initiative ?? 0, (v) => updateStat('initiative', v))}</div>
            <div><label style={labelStyle}>Скорость</label>{input('number', character.speed ?? 30, (v) => updateStat('speed', v))}</div>
          </div>
          <div><label style={labelStyle}>Максимум хитов</label>{input('number', character.maxHp ?? 10, (v) => updateStat('maxHp', v))}</div>
          <div><label style={labelStyle}>Текущие хиты</label>{input('number', character.hp ?? 10, (v) => updateStat('hp', v))}</div>
          <div><label style={labelStyle}>Временные хиты</label>{input('number', sheetData.tempHp ?? 0, (v) => updateSheetData({ tempHp: typeof v === 'number' ? v : 0 }))}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={labelStyle}>Кость хитов (итого)</label><input type="text" value={sheetData.hitDiceTotal ?? ''} onChange={(e) => updateSheetData({ hitDiceTotal: e.target.value })} disabled={!canEdit} placeholder="1к8" style={sheetStyle} /></div>
            <div><label style={labelStyle}>Потрачено</label>{input('number', sheetData.hitDiceUsed ?? 0, (v) => updateSheetData({ hitDiceUsed: typeof v === 'number' ? v : 0 }))}</div>
          </div>
          <div><label style={labelStyle}>Спасброски от смерти</label>
            <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11 }}>Успехи:</span>
              {[0, 1, 2].map((i) => (
                <input key={`s${i}`} type="checkbox" checked={(sheetData.deathSaveSuccesses ?? 0) > i} onChange={() => { const n = (sheetData.deathSaveSuccesses ?? 0) === i + 1 ? i : i + 1; updateSheetData({ deathSaveSuccesses: n }); }} disabled={!canEdit} />
              ))}
              <span style={{ fontSize: 11, marginLeft: 8 }}>Провалы:</span>
              {[0, 1, 2].map((i) => (
                <input key={`f${i}`} type="checkbox" checked={(sheetData.deathSaveFailures ?? 0) > i} onChange={() => { const n = (sheetData.deathSaveFailures ?? 0) === i + 1 ? i : i + 1; updateSheetData({ deathSaveFailures: n }); }} disabled={!canEdit} />
              ))}
            </div>
          </div>
          <div><h3 style={{ margin: '8px 0 4px', fontSize: 12 }}>Атаки и заклинания</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr><th style={{ textAlign: 'left', borderBottom: '1px solid #333' }}>Название</th><th style={{ textAlign: 'left', borderBottom: '1px solid #333' }}>Бонус атаки</th><th style={{ textAlign: 'left', borderBottom: '1px solid #333' }}>Урон/вид</th></tr></thead>
              <tbody>
                {(sheetData.attacks ?? []).map((at, i) => (
                  <tr key={i}>
                    <td><input type="text" value={at.name} onChange={(e) => { const a = [...(sheetData.attacks ?? [])]; a[i] = { ...a[i], name: e.target.value }; updateSheetData({ attacks: a }); }} disabled={!canEdit} style={{ ...sheetStyle, border: 'none', padding: 2 }} /></td>
                    <td><input type="text" value={at.attackBonus} onChange={(e) => { const a = [...(sheetData.attacks ?? [])]; a[i] = { ...a[i], attackBonus: e.target.value }; updateSheetData({ attacks: a }); }} disabled={!canEdit} style={{ ...sheetStyle, border: 'none', padding: 2, width: 60 }} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}><input type="text" value={at.damageType} onChange={(e) => { const a = [...(sheetData.attacks ?? [])]; a[i] = { ...a[i], damageType: e.target.value }; updateSheetData({ attacks: a }); }} disabled={!canEdit} style={{ ...sheetStyle, border: 'none', padding: 2 }} />{canEdit && <button type="button" onClick={() => updateSheetData({ attacks: (sheetData.attacks ?? []).filter((_, j) => j !== i) })} style={{ marginLeft: 4 }}>×</button>}</td>
                  </tr>
                ))}
                {canEdit && (
                  <tr><td colSpan={3}>
                    <button type="button" onClick={() => updateSheetData({ attacks: [...(sheetData.attacks ?? []), { name: '', attackBonus: '', damageType: '' }] })} style={{ fontSize: 12 }}>+ Атака</button>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div><h3 style={{ margin: '8px 0 4px', fontSize: 12 }}>Состояния</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {CONDITION_OPTIONS.map((opt) => {
                const checked = (sheetData.conditions ?? []).includes(opt.key);
                return (
                  <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: canEdit ? 'pointer' : 'default' }}>
                    <input type="checkbox" checked={checked} onChange={(e) => { const next = e.target.checked ? [...(sheetData.conditions ?? []), opt.key] : (sheetData.conditions ?? []).filter((c) => c !== opt.key); updateSheetData({ conditions: next }); }} disabled={!canEdit} />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </div>
          <div><h3 style={{ margin: '8px 0 4px', fontSize: 12 }}>Слоты заклинаний</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              {([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((lv) => {
                const slot = (sheetData.spellSlots ?? []).find((s) => s.level === lv) ?? { level: lv, total: 0, used: 0 };
                const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][lv - 1];
                return (
                  <div key={lv} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, minWidth: 20 }}>{roman}</span>
                    <input type="number" min={0} value={slot.total} onChange={(e) => { const v = parseInt(e.target.value, 10) || 0; const slots = [...(sheetData.spellSlots ?? [])]; const i = slots.findIndex((s) => s.level === lv); if (i >= 0) slots[i] = { ...slots[i], total: v }; else slots.push({ level: lv, total: v, used: 0 }); slots.sort((a, b) => a.level - b.level); updateSheetData({ spellSlots: slots }); }} disabled={!canEdit} style={{ ...sheetStyle, width: 40 }} title="Всего" />
                    <span style={{ fontSize: 12 }}>/</span>
                    <input type="number" min={0} value={slot.used} onChange={(e) => { const v = Math.max(0, parseInt(e.target.value, 10) || 0); const slots = [...(sheetData.spellSlots ?? [])]; const i = slots.findIndex((s) => s.level === lv); const entry = i >= 0 ? slots[i] : { level: lv, total: 0, used: 0 }; const nextSlots = i >= 0 ? slots : [...slots, entry]; const j = nextSlots.findIndex((s) => s.level === lv); nextSlots[j] = { ...nextSlots[j], used: Math.min(v, nextSlots[j].total) }; nextSlots.sort((a, b) => a.level - b.level); updateSheetData({ spellSlots: nextSlots }); }} disabled={!canEdit} style={{ ...sheetStyle, width: 40 }} title="Потрачено" />
                  </div>
                );
              })}
            </div>
          </div>
          <div><label style={labelStyle}>Валюта (ММ, СМ, ЗМ, ПМ, МД)</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(['copper', 'silver', 'electrum', 'gold', 'platinum'] as const).map((c) => (
                <input key={c} type="number" min={0} value={sheetData.currency?.[c] ?? 0} onChange={(e) => updateSheetData({ currency: { ...(sheetData.currency ?? {}), [c]: parseInt(e.target.value, 10) || 0 } })} disabled={!canEdit} style={{ ...sheetStyle, width: 52 }} />
              ))}
            </div>
          </div>
          <div><label style={labelStyle}>Снаряжение</label><textarea value={sheetData.equipment ?? ''} onChange={(e) => updateSheetData({ equipment: e.target.value })} disabled={!canEdit} rows={6} style={{ ...sheetStyle, resize: 'vertical' }} /></div>
          <div><h3 style={{ margin: '8px 0 4px', fontSize: 12 }}>Оружие</h3>
            {(sheetData.weapons ?? []).map((w, index) => (
              <div key={index} style={{ marginBottom: 8, padding: 8, border: '1px solid #dee2e6', borderRadius: 4 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                  <input type="text" value={w.name} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), name: e.target.value }; updateSheetData({ weapons: next }); }} disabled={!canEdit} placeholder="Оружие" style={{ ...sheetStyle, flex: 1, minWidth: 100 }} />
                  <input type="text" value={w.damage} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), damage: e.target.value }; updateSheetData({ weapons: next }); }} disabled={!canEdit} placeholder="Кубики урона (1к8, 2к6)" style={{ ...sheetStyle, width: 140 }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: canEdit ? 'pointer' : 'default' }}>
                    <input type="checkbox" checked={w.proficient ?? false} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), proficient: e.target.checked }; updateSheetData({ weapons: next }); }} disabled={!canEdit} />
                    Владение
                  </label>
                  <select value={w.ability ?? 'strength'} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), ability: e.target.value as AbilityKey }; updateSheetData({ weapons: next }); }} disabled={!canEdit} style={{ ...sheetStyle, width: 72 }}>
                    {ABILITY_KEYS.map((key) => (
                      <option key={key} value={key}>{ABILITY_LABELS[key]}</option>
                    ))}
                  </select>
                  <select value={w.damageType ?? ''} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), damageType: (e.target.value || undefined) as WeaponDamageType | undefined }; updateSheetData({ weapons: next }); }} disabled={!canEdit} style={{ ...sheetStyle, width: 100 }} title="Тип урона для устойчивости/уязвимости">
                    <option value="">— тип</option>
                    {WEAPON_DAMAGE_TYPES.map((key) => (
                      <option key={key} value={key}>{WEAPON_DAMAGE_TYPE_LABELS[key]}</option>
                    ))}
                  </select>
                  <input type="text" value={w.attackModifier ?? ''} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), attackModifier: e.target.value || undefined }; updateSheetData({ weapons: next }); }} disabled={!canEdit} placeholder="Бонус атаки (опц.)" style={{ ...sheetStyle, width: 110 }} title="Оставьте пустым — будет считаться по характеристике и владению" />
                  {canEdit && <button type="button" onClick={() => updateSheetData({ weapons: (sheetData.weapons ?? []).filter((_, i) => i !== index) })}>×</button>}
                </div>
              </div>
            ))}
            {canEdit && <button type="button" onClick={() => updateSheetData({ weapons: [...(sheetData.weapons ?? []), normalizeWeapon({ name: '', damage: '' })] })}>+ Оружие</button>}
          </div>
          {!hideInventory && (
            <div><h3 style={{ margin: '8px 0 4px', fontSize: 12 }}>Инвентарь (предметы)</h3>
              {(character.inventory ?? []).map((item, index) => (
                <div key={index} style={{ marginBottom: 8, padding: 8, border: '1px solid #dee2e6', borderRadius: 4 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    <input type="text" value={item.name ?? ''} onChange={(e) => { const next = [...(character.inventory ?? [])]; next[index] = { ...next[index], name: e.target.value }; updateStat('inventory', next); }} disabled={!canEdit} placeholder="Название" style={{ ...sheetStyle, flex: 1 }} />
                    {canEdit && <button type="button" onClick={() => updateStat('inventory', (character.inventory ?? []).filter((_, i) => i !== index))}>×</button>}
                  </div>
                  <textarea value={item.description ?? ''} onChange={(e) => { const next = [...(character.inventory ?? [])]; next[index] = { ...next[index], description: e.target.value }; updateStat('inventory', next); }} disabled={!canEdit} placeholder="Описание" rows={2} style={{ ...sheetStyle, width: '100%', resize: 'vertical', marginTop: 4 }} />
                </div>
              ))}
              {canEdit && <button type="button" onClick={() => updateStat('inventory', [...(character.inventory ?? []), { name: '', description: '' }])}>+ Предмет</button>}
            </div>
          )}
        </div>

        {/* Правая колонка: черты, идеалы, привязанности, слабости, умения */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={labelStyle}>Черты характера</label><textarea value={sheetData.traits ?? ''} onChange={(e) => updateSheetData({ traits: e.target.value })} disabled={!canEdit} rows={3} style={{ ...sheetStyle, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>Идеалы</label><textarea value={sheetData.ideals ?? ''} onChange={(e) => updateSheetData({ ideals: e.target.value })} disabled={!canEdit} rows={3} style={{ ...sheetStyle, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>Привязанности</label><textarea value={sheetData.bonds ?? ''} onChange={(e) => updateSheetData({ bonds: e.target.value })} disabled={!canEdit} rows={3} style={{ ...sheetStyle, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>Слабости</label><textarea value={sheetData.flaws ?? ''} onChange={(e) => updateSheetData({ flaws: e.target.value })} disabled={!canEdit} rows={3} style={{ ...sheetStyle, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>Умения и особенности</label><textarea value={sheetData.featuresTraits ?? ''} onChange={(e) => updateSheetData({ featuresTraits: e.target.value })} disabled={!canEdit} rows={8} style={{ ...sheetStyle, resize: 'vertical' }} /></div>
        </div>
      </div>
    </div>
  );
};
