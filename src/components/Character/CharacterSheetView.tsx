import React, { useState, useEffect } from 'react';
import { updateCharacter, type Character } from '../../api/characters';
import { searchUsers, type SearchUserItem } from '../../api/auth';
import { getReferenceEntriesBySlug, type ReferenceEntry } from '../../api/referenceBooks';
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
import './CharacterSheet.css';

const FILENAME_UNSAFE = new RegExp('[<>:"\\\\|?*]', 'g');

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
  const [refOptions, setRefOptions] = useState<{
    races: ReferenceEntry[];
    subraces: ReferenceEntry[];
    classes: ReferenceEntry[];
    subclasses: ReferenceEntry[];
    backgrounds: ReferenceEntry[];
    alignments: ReferenceEntry[];
    weapons: ReferenceEntry[];
    items: ReferenceEntry[];
    attacks: ReferenceEntry[];
  }>({ races: [], subraces: [], classes: [], subclasses: [], backgrounds: [], alignments: [], weapons: [], items: [], attacks: [] });
  const [weaponSelectValue, setWeaponSelectValue] = useState('');
  const [itemSelectValue, setItemSelectValue] = useState('');
  const [attackSelectValue, setAttackSelectValue] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [races, subraces, classes, subclasses, backgrounds, alignments, weapons, itemsRes, equipmentRes, gearRes, attacksRes, spellsRes] = await Promise.all([
          getReferenceEntriesBySlug('races'),
          getReferenceEntriesBySlug('subraces'),
          getReferenceEntriesBySlug('classes'),
          getReferenceEntriesBySlug('subclasses'),
          getReferenceEntriesBySlug('backgrounds'),
          getReferenceEntriesBySlug('alignments'),
          getReferenceEntriesBySlug('weapons'),
          getReferenceEntriesBySlug('items'),
          getReferenceEntriesBySlug('equipment'),
          getReferenceEntriesBySlug('gear'),
          getReferenceEntriesBySlug('attacks'),
          getReferenceEntriesBySlug('spells'),
        ]);
        const items = [...itemsRes, ...equipmentRes, ...gearRes].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        const attacks = [...attacksRes, ...spellsRes].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        setRefOptions({ races, subraces, classes, subclasses, backgrounds, alignments, weapons: [...weapons].sort((a, b) => a.name.localeCompare(b.name, 'ru')), items, attacks });
      } catch {
        setRefOptions({ races: [], subraces: [], classes: [], subclasses: [], backgrounds: [], alignments: [], weapons: [], items: [], attacks: [] });
      }
    };
    load();
  }, []);

  const sheetData: CharacterSheetData = getSheetData(character);
  const damageFromRefToType = (damageStr: string): WeaponDamageType | undefined => {
    if (!damageStr || typeof damageStr !== 'string') return undefined;
    const s = damageStr.toLowerCase();
    if (s.includes('рубящ')) return 'slashing';
    if (s.includes('колющ')) return 'piercing';
    if (s.includes('дробящ')) return 'bludgeoning';
    return undefined;
  };
  const addWeaponFromRef = (entry: ReferenceEntry) => {
    const damage = (entry.data?.damage as string) ?? '';
    const damageType = damageFromRefToType(damage);
    updateSheetData({
      weapons: [...(sheetData.weapons ?? []), normalizeWeapon({ name: entry.name, damage, damageType })],
    });
    setWeaponSelectValue('');
  };
  const addItemFromRef = (entry: ReferenceEntry) => {
    const desc = typeof entry.data?.description === 'string' ? entry.data.description : (entry.data?.description != null ? String(entry.data.description) : '');
    updateStat('inventory', [...(character.inventory ?? []), { name: entry.name, description: desc }]);
    setItemSelectValue('');
  };
  const addAttackFromRef = (entry: ReferenceEntry) => {
    const attackBonus = (entry.data?.attackBonus ?? entry.data?.attack_bonus) as string | undefined;
    const damageType = (entry.data?.damageType ?? entry.data?.damage_type ?? entry.data?.damage) as string | undefined;
    updateSheetData({ attacks: [...(sheetData.attacks ?? []), { name: entry.name, attackBonus: attackBonus ?? '', damageType: damageType ?? '' }] });
    setAttackSelectValue('');
  };
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
    const safeName = (character.characterName || 'character').replace(FILENAME_UNSAFE, '').slice(0, 80).trim() || 'character';
    a.download = `${safeName}.json`;
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
      className="cs-input"
      value={value}
      onChange={(e) => (type === 'number' ? onChange(parseInt(e.target.value, 10) || 0) : onChange(e.target.value))}
      disabled={!canEdit}
      readOnly={!canEdit}
      min={opts?.min}
      placeholder={opts?.placeholder}
      style={!canEdit ? { background: '#eee', cursor: 'default' } : undefined}
    />
  );
  const sheetStyle = { width: '100%', boxSizing: 'border-box' as const };
  const labelStyle = {};
  const refSelect = (value: string, onChange: (v: string) => void, options: ReferenceEntry[], disabled: boolean) => (
    <select className="cs-select" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} style={!canEdit ? { background: '#eee', cursor: 'default' } : undefined}>
      <option value="">—</option>
      {options.map((e) => (
        <option key={e.id} value={e.name}>{e.name}</option>
      ))}
    </select>
  );

  return (
    <div className="cs-root">
      <div className="cs-header">
        <h1 className="cs-title">{character.characterName || 'Безымянный'}</h1>
        <div className="cs-actions">
          {canEdit && (
            <button type="button" onClick={handleSave} disabled={isSaving} className="cs-btn cs-btn-primary">
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          )}
          {saveMessage && <span style={{ color: '#2d6a3e', fontSize: 12 }}>{saveMessage}</span>}
          {canEdit && isOwner && (
            <button type="button" onClick={() => setSharePanelOpen((v) => !v)} className="cs-btn cs-btn-secondary">
              Поделиться
            </button>
          )}
          <button type="button" onClick={handleExportJson} className="cs-btn cs-btn-secondary">Экспорт JSON</button>
          <button type="button" onClick={onClose} className="cs-btn cs-btn-ghost">Закрыть</button>
        </div>
        {error && <div style={{ color: '#c53030', marginTop: 4, fontSize: 12, width: '100%' }}>{error}</div>}
      </div>

      {canEdit && isOwner && sharePanelOpen && (
        <div className="cs-share-panel">
          <h2 className="cs-section-title">Доступ к карточке</h2>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--cs-text-muted)' }}>
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
          <div className="cs-row">
            <input
              type="text"
              className="cs-input"
              value={editorSearchQuery}
              onChange={(e) => setEditorSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), doEditorSearch())}
              placeholder="Имя пользователя (мин. 2 символа)"
              style={{ width: 180 }}
            />
            <button type="button" className="cs-btn cs-btn-primary" onClick={doEditorSearch} disabled={editorSearching || editorSearchQuery.trim().length < 2}>
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

      <div className="cs-section">
        <h2 className="cs-section-title">Портрет</h2>
        <div className="cs-portrait-wrap">
          <div className="cs-portrait-box">
            {character.imageUrl ? (
              <img src={character.imageUrl} alt="Персонаж" className="cs-portrait-img" />
            ) : (
              <div className="cs-portrait-placeholder">Нет изображения</div>
            )}
          </div>
          {canEdit && (
            <div className="cs-portrait-btns">
              <label className="cs-btn cs-btn-primary" style={{ margin: 0 }}>
                Загрузить
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = () => updateStat('imageUrl', reader.result as string); reader.readAsDataURL(file); } }} />
              </label>
              <button type="button" className="cs-btn cs-btn-ghost" onClick={() => updateStat('imageUrl', '')}>Удалить</button>
            </div>
          )}
        </div>
      </div>

      <div className="cs-section">
        <div className="cs-grid-header">
          <div><label className="cs-label">Имя персонажа</label>{input('text', character.characterName || '', (v) => updateStat('characterName', v))}</div>
          <div><label className="cs-label">Класс и уровень</label><span className="cs-row">{refSelect(character.class ?? '', (v) => updateStat('class', v), refOptions.classes, !canEdit)}<span className="cs-inline-num">{level}</span></span></div>
          <div><label className="cs-label">Имя игрока</label><input type="text" className="cs-input" placeholder="—" readOnly style={{ background: '#eee' }} /></div>
          <div><label className="cs-label">Опыт</label>{input('number', character.experience ?? 0, (v) => updateStat('experience', v), { min: 0 })}</div>
          <div><label className="cs-label">Раса</label>{refSelect(character.race ?? '', (v) => updateStat('race', v), refOptions.races, !canEdit)}</div>
          <div><label className="cs-label">Архетип класса</label>{refSelect(character.classArchetype ?? '', (v) => updateStat('classArchetype', v), refOptions.subclasses, !canEdit)}</div>
          <div><label className="cs-label">Мировоззрение</label>{refSelect(sheetData.alignment ?? '', (v) => updateSheetData({ alignment: v }), refOptions.alignments, !canEdit)}</div>
          <div><label className="cs-label">Подраса</label>{refSelect(character.subrace ?? '', (v) => updateStat('subrace', v), refOptions.subraces, !canEdit)}</div>
          <div><label className="cs-label">Вес (кг)</label><input type="number" className="cs-input" min={WEIGHT_KG.min} max={WEIGHT_KG.max} value={parseWeight(character.weight) ?? ''} onChange={(e) => { const v = e.target.value; const n = v === '' ? null : parseInt(v, 10); updateStat('weight', n != null && !Number.isNaN(n) ? String(n) : ''); }} disabled={!canEdit} readOnly={!canEdit} placeholder="55" style={!canEdit ? { background: '#eee', cursor: 'default' } : undefined} /></div>
          <div><label className="cs-label">Рост (см)</label><input type="number" className="cs-input" min={HEIGHT_CM.min} max={HEIGHT_CM.max} value={parseHeight(character.height) ?? ''} onChange={(e) => { const v = e.target.value; const n = v === '' ? null : parseInt(v, 10); updateStat('height', n != null && !Number.isNaN(n) ? String(n) : ''); }} disabled={!canEdit} readOnly={!canEdit} placeholder="185" style={!canEdit ? { background: '#eee', cursor: 'default' } : undefined} /></div>
        </div>
        <div style={{ marginBottom: 6 }}><label className="cs-label">Предыстория</label>{refSelect(sheetData.background ?? '', (v) => updateSheetData({ background: v }), refOptions.backgrounds, !canEdit)}</div>
        <div style={{ marginBottom: 6 }}><label className="cs-label">Предистория (рассказ)</label><textarea className="cs-textarea cs-textarea-sm" value={character.backstory ?? ''} onChange={(e) => updateStat('backstory', e.target.value)} disabled={!canEdit} rows={2} placeholder="Рассказ о прошлом персонажа..." /></div>
        <div><label className="cs-label">Внешность</label><textarea className="cs-textarea cs-textarea-xs" value={character.appearance ?? ''} onChange={(e) => updateStat('appearance', e.target.value)} disabled={!canEdit} rows={1} placeholder="Описание внешности..." /></div>
      </div>

      <div className="cs-grid-cols">
        <div className="cs-col">
          <div className="cs-row">
            <label className="cs-label">Вдохновение</label>
            <input type="checkbox" checked={!!sheetData.inspiration} onChange={(e) => updateSheetData({ inspiration: e.target.checked })} disabled={!canEdit} />
            <label className="cs-label">Бонус мастерства</label>
            <span className="cs-inline-num">+{profBonus}</span>
          </div>
          <div className="cs-abilities">
            {[
              { key: 'strength' as AbilityKey, name: 'Сила' },
              { key: 'dexterity' as AbilityKey, name: 'Ловкость' },
              { key: 'constitution' as AbilityKey, name: 'Тел.' },
              { key: 'intelligence' as AbilityKey, name: 'Инт.' },
              { key: 'wisdom' as AbilityKey, name: 'Мудрость' },
              { key: 'charisma' as AbilityKey, name: 'Хар.' },
            ].map(({ key, name }) => (
              <div key={key} className="cs-ability">
                <label className="cs-label">{name}</label>
                {input('number', (character[key] as number) ?? 10, (v) => updateStat(key, v))}
                <span className="cs-ability-mod">{getModifier((character[key] as number) ?? 10)}</span>
              </div>
            ))}
          </div>
          <h3 className="cs-section-title">Спасброски</h3>
          {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map((abil, i) => {
            const names = ['Сила', 'Ловкость', 'Тел.', 'Инт.', 'Мудрость', 'Хар.'];
            const prof = (sheetData.savingThrowProficiencies ?? []).includes(abil);
            const score = (character[abil as AbilityKey] as number) ?? 10;
            const mod = Math.floor((score - 10) / 2) + (prof ? profBonus : 0);
            return (
              <div key={abil} className="cs-list-row">
                <input type="checkbox" checked={prof} onChange={(e) => updateSheetData({ savingThrowProficiencies: e.target.checked ? [...(sheetData.savingThrowProficiencies ?? []), abil] : (sheetData.savingThrowProficiencies ?? []).filter(x => x !== abil) })} disabled={!canEdit} />
                <span style={{ width: 56, fontSize: 11 }}>{names[i]}</span>
                <span className="cs-num" style={{ display: 'inline-block' }}>{mod >= 0 ? '+' : ''}{mod}</span>
              </div>
            );
          })}
          <h3 className="cs-section-title">Навыки</h3>
          {DND_SKILLS.map((sk) => {
            const prof = (sheetData.skillProficiencies ?? []).includes(sk.key);
            const score = (character[sk.ability] as number) ?? 10;
            const mod = Math.floor((score - 10) / 2) + (prof ? profBonus : 0);
            return (
              <div key={sk.key} className="cs-list-row">
                <input type="checkbox" checked={prof} onChange={(e) => updateSheetData({ skillProficiencies: e.target.checked ? [...(sheetData.skillProficiencies ?? []), sk.key] : (sheetData.skillProficiencies ?? []).filter(x => x !== sk.key) })} disabled={!canEdit} />
                <span style={{ flex: 1, fontSize: 11 }}>{sk.name}</span>
                <span className="cs-num" style={{ display: 'inline-block' }}>{mod >= 0 ? '+' : ''}{mod}</span>
              </div>
            );
          })}
          <div><label className="cs-label">Пассивная мудрость (Внимательность)</label>{input('number', sheetData.passivePerception ?? 10, (v) => updateSheetData({ passivePerception: typeof v === 'number' ? v : parseInt(String(v), 10) || 10 }))}</div>
          <div><label className="cs-label">Владение</label><textarea className="cs-textarea cs-textarea-xs" value={sheetData.proficiencies ?? sheetData.proficienciesAndLanguages ?? ''} onChange={(e) => updateSheetData({ proficiencies: e.target.value })} disabled={!canEdit} rows={2} placeholder="Инструменты, оружие и т.д." /></div>
          <div><label className="cs-label">Языки</label><textarea className="cs-textarea cs-textarea-xs" value={sheetData.languages ?? ''} onChange={(e) => updateSheetData({ languages: e.target.value })} disabled={!canEdit} rows={1} placeholder="Языки персонажа" /></div>
        </div>

        <div className="cs-col">
          <div className="cs-combat-row">
            <div><label className="cs-label">КД</label>{input('number', character.armorClass ?? 10, (v) => updateStat('armorClass', v))}</div>
            <div><label className="cs-label">Инициатива</label>{input('number', character.initiative ?? 0, (v) => updateStat('initiative', v))}</div>
            <div><label className="cs-label">Скорость</label>{input('number', character.speed ?? 30, (v) => updateStat('speed', v))}</div>
          </div>
          <div className="cs-hp-row">
            <div><label className="cs-label">Макс. хиты</label>{input('number', character.maxHp ?? 10, (v) => updateStat('maxHp', v))}</div>
            <div><label className="cs-label">Хиты</label>{input('number', character.hp ?? 10, (v) => updateStat('hp', v))}</div>
            <div><label className="cs-label">Врем. хиты</label>{input('number', sheetData.tempHp ?? 0, (v) => updateSheetData({ tempHp: typeof v === 'number' ? v : 0 }))}</div>
          </div>
          <div className="cs-row">
            <div><label className="cs-label">Кость хитов</label><input type="text" className="cs-input" value={sheetData.hitDiceTotal ?? ''} onChange={(e) => updateSheetData({ hitDiceTotal: e.target.value })} disabled={!canEdit} placeholder="1к8" style={{ maxWidth: 56 }} /></div>
            <div><label className="cs-label">Потрачено</label>{input('number', sheetData.hitDiceUsed ?? 0, (v) => updateSheetData({ hitDiceUsed: typeof v === 'number' ? v : 0 }))}</div>
          </div>
          <div><label className="cs-label">Спасброски от смерти</label>
            <div className="cs-row" style={{ marginTop: 4 }}>
              <span style={{ fontSize: 10 }}>Успехи:</span>
              {[0, 1, 2].map((i) => (
                <input key={`s${i}`} type="checkbox" checked={(sheetData.deathSaveSuccesses ?? 0) > i} onChange={() => { const n = (sheetData.deathSaveSuccesses ?? 0) === i + 1 ? i : i + 1; updateSheetData({ deathSaveSuccesses: n }); }} disabled={!canEdit} />
              ))}
              <span style={{ fontSize: 10, marginLeft: 6 }}>Провалы:</span>
              {[0, 1, 2].map((i) => (
                <input key={`f${i}`} type="checkbox" checked={(sheetData.deathSaveFailures ?? 0) > i} onChange={() => { const n = (sheetData.deathSaveFailures ?? 0) === i + 1 ? i : i + 1; updateSheetData({ deathSaveFailures: n }); }} disabled={!canEdit} />
              ))}
            </div>
          </div>
          <h3 className="cs-section-title">Атаки и заклинания</h3>
            <table className="cs-attacks-table">
              <thead><tr><th>Название</th><th>Бонус</th><th>Урон/вид</th></tr></thead>
              <tbody>
                {(sheetData.attacks ?? []).map((at, i) => (
                  <tr key={i}>
                    <td><input type="text" className="cs-input" value={at.name} onChange={(e) => { const a = [...(sheetData.attacks ?? [])]; a[i] = { ...a[i], name: e.target.value }; updateSheetData({ attacks: a }); }} disabled={!canEdit} /></td>
                    <td><input type="text" className="cs-input" value={at.attackBonus} onChange={(e) => { const a = [...(sheetData.attacks ?? [])]; a[i] = { ...a[i], attackBonus: e.target.value }; updateSheetData({ attacks: a }); }} disabled={!canEdit} style={{ width: 48 }} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}><input type="text" className="cs-input" value={at.damageType} onChange={(e) => { const a = [...(sheetData.attacks ?? [])]; a[i] = { ...a[i], damageType: e.target.value }; updateSheetData({ attacks: a }); }} disabled={!canEdit} />{canEdit && <button type="button" className="cs-btn cs-btn-ghost" onClick={() => updateSheetData({ attacks: (sheetData.attacks ?? []).filter((_, j) => j !== i) })} style={{ padding: '2px 6px' }}>×</button>}</td>
                  </tr>
                ))}
                {canEdit && (
                  <>
                    <tr><td colSpan={3}><button type="button" className="cs-btn cs-btn-ghost" onClick={() => updateSheetData({ attacks: [...(sheetData.attacks ?? []), { name: '', attackBonus: '', damageType: '' }] })}>+ Атака</button></td></tr>
                    {refOptions.attacks.length > 0 && (
                      <tr><td colSpan={3} style={{ paddingTop: 4 }}>
                        <span style={{ fontSize: 10, color: 'var(--cs-text-muted)', marginRight: 6 }}>из справочника:</span>
                        <select className="cs-select" value={attackSelectValue} onChange={(e) => { const v = e.target.value; setAttackSelectValue(v); if (v) { const entry = refOptions.attacks.find((x) => x.name === v); if (entry) addAttackFromRef(entry); } }} style={{ width: 160, display: 'inline-block' }}>
                          <option value="">— атака или заклинание</option>
                          {refOptions.attacks.map((e) => (<option key={e.id} value={e.name}>{e.name}</option>))}
                        </select>
                      </td></tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          <div><h3 className="cs-section-title">Состояния</h3>
            <div className="cs-conditions">
              {CONDITION_OPTIONS.map((opt) => {
                const checked = (sheetData.conditions ?? []).includes(opt.key);
                return (
                  <label key={opt.key}>
                    <input type="checkbox" checked={checked} onChange={(e) => { const next = e.target.checked ? [...(sheetData.conditions ?? []), opt.key] : (sheetData.conditions ?? []).filter((c) => c !== opt.key); updateSheetData({ conditions: next }); }} disabled={!canEdit} />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </div>
          <h3 className="cs-section-title">Слоты заклинаний</h3>
            <div className="cs-spell-slots">
              {([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((lv) => {
                const slot = (sheetData.spellSlots ?? []).find((s) => s.level === lv) ?? { level: lv, total: 0, used: 0 };
                const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][lv - 1];
                return (
                  <div key={lv} className="cs-spell-slot">
                    <span style={{ fontSize: 10, minWidth: 18 }}>{roman}</span>
                    <input type="number" min={0} className="cs-input" value={slot.total} onChange={(e) => { const v = parseInt(e.target.value, 10) || 0; const slots = [...(sheetData.spellSlots ?? [])]; const i = slots.findIndex((s) => s.level === lv); if (i >= 0) slots[i] = { ...slots[i], total: v }; else slots.push({ level: lv, total: v, used: 0 }); slots.sort((a, b) => a.level - b.level); updateSheetData({ spellSlots: slots }); }} disabled={!canEdit} title="Всего" />
                    <span style={{ fontSize: 10 }}>{'/'}</span>
                    <input type="number" min={0} className="cs-input" value={slot.used} onChange={(e) => { const v = Math.max(0, parseInt(e.target.value, 10) || 0); const slots = [...(sheetData.spellSlots ?? [])]; const i = slots.findIndex((s) => s.level === lv); const entry = i >= 0 ? slots[i] : { level: lv, total: 0, used: 0 }; const nextSlots = i >= 0 ? slots : [...slots, entry]; const j = nextSlots.findIndex((s) => s.level === lv); nextSlots[j] = { ...nextSlots[j], used: Math.min(v, nextSlots[j].total) }; nextSlots.sort((a, b) => a.level - b.level); updateSheetData({ spellSlots: nextSlots }); }} disabled={!canEdit} title="Потрачено" />
                  </div>
                );
              })}
            </div>
          <div><label className="cs-label">Валюта (ММ, СМ, ЗМ, ПМ, МД)</label>
            <div className="cs-currency">
              {(['copper', 'silver', 'electrum', 'gold', 'platinum'] as const).map((c) => (
                <input key={c} type="number" min={0} className="cs-input" value={sheetData.currency?.[c] ?? 0} onChange={(e) => updateSheetData({ currency: { ...(sheetData.currency ?? {}), [c]: parseInt(e.target.value, 10) || 0 } })} disabled={!canEdit} />
              ))}
            </div>
          </div>
          <div><label className="cs-label">Снаряжение</label><textarea className="cs-textarea cs-textarea-sm" value={sheetData.equipment ?? ''} onChange={(e) => updateSheetData({ equipment: e.target.value })} disabled={!canEdit} rows={3} /></div>
          <h3 className="cs-section-title">Оружие</h3>
            {(sheetData.weapons ?? []).map((w, index) => (
              <div key={index} className="cs-item-card">
                <div className="cs-item-row">
                  <input type="text" className="cs-input" value={w.name} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), name: e.target.value }; updateSheetData({ weapons: next }); }} disabled={!canEdit} placeholder="Оружие" />
                  <input type="text" className="cs-input" value={w.damage} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), damage: e.target.value }; updateSheetData({ weapons: next }); }} disabled={!canEdit} placeholder="1к8" />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, cursor: canEdit ? 'pointer' : 'default' }}>
                    <input type="checkbox" checked={w.proficient ?? false} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), proficient: e.target.checked }; updateSheetData({ weapons: next }); }} disabled={!canEdit} />
                    Влад.
                  </label>
                  <select className="cs-select" value={w.ability ?? 'strength'} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), ability: e.target.value as AbilityKey }; updateSheetData({ weapons: next }); }} disabled={!canEdit} style={{ width: 56 }}>
                    {ABILITY_KEYS.map((key) => (<option key={key} value={key}>{ABILITY_LABELS[key]}</option>))}
                  </select>
                  <select className="cs-select" value={w.damageType ?? ''} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), damageType: (e.target.value || undefined) as WeaponDamageType | undefined }; updateSheetData({ weapons: next }); }} disabled={!canEdit} style={{ width: 72 }} title="Тип урона">
                    <option value="">— тип</option>
                    {WEAPON_DAMAGE_TYPES.map((key) => (<option key={key} value={key}>{WEAPON_DAMAGE_TYPE_LABELS[key]}</option>))}
                  </select>
                  <input type="text" className="cs-input" value={w.attackModifier ?? ''} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), attackModifier: e.target.value || undefined }; updateSheetData({ weapons: next }); }} disabled={!canEdit} placeholder="Бонус" style={{ width: 52 }} />
                  {canEdit && <button type="button" className="cs-btn cs-btn-ghost" onClick={() => updateSheetData({ weapons: (sheetData.weapons ?? []).filter((_, i) => i !== index) })} style={{ padding: '2px 6px' }}>×</button>}
                </div>
              </div>
            ))}
            <div className="cs-row" style={{ marginTop: 4 }}>
            {canEdit && <button type="button" className="cs-btn cs-btn-ghost" onClick={() => updateSheetData({ weapons: [...(sheetData.weapons ?? []), normalizeWeapon({ name: '', damage: '' })] })}>+ Оружие</button>}
            {canEdit && refOptions.weapons.length > 0 && (
              <>
                <span style={{ fontSize: 10, color: 'var(--cs-text-muted)' }}>из справ.:</span>
                <select className="cs-select" value={weaponSelectValue} onChange={(e) => { const v = e.target.value; setWeaponSelectValue(v); if (v) { const entry = refOptions.weapons.find((x) => x.name === v); if (entry) addWeaponFromRef(entry); } }} style={{ width: 140 }}>
                  <option value="">— выбрать оружие</option>
                  {refOptions.weapons.map((e) => (<option key={e.id} value={e.name}>{e.name}</option>))}
                </select>
              </>
            )}
          </div>
          {!hideInventory && (
            <div><h3 className="cs-section-title">Инвентарь (предметы)</h3>
              {(character.inventory ?? []).map((item, index) => (
                <div key={index} className="cs-item-card">
                  <div className="cs-item-row">
                    <input type="text" className="cs-input" value={item.name ?? ''} onChange={(e) => { const next = [...(character.inventory ?? [])]; next[index] = { ...next[index], name: e.target.value }; updateStat('inventory', next); }} disabled={!canEdit} placeholder="Название" />
                    {canEdit && <button type="button" className="cs-btn cs-btn-ghost" onClick={() => updateStat('inventory', (character.inventory ?? []).filter((_, i) => i !== index))} style={{ padding: '2px 6px' }}>×</button>}
                  </div>
                  <textarea className="cs-textarea cs-textarea-xs" value={item.description ?? ''} onChange={(e) => { const next = [...(character.inventory ?? [])]; next[index] = { ...next[index], description: e.target.value }; updateStat('inventory', next); }} disabled={!canEdit} placeholder="Описание" rows={1} style={{ marginTop: 4 }} />
                </div>
              ))}
              <div className="cs-row" style={{ marginTop: 4 }}>
              {canEdit && <button type="button" className="cs-btn cs-btn-ghost" onClick={() => updateStat('inventory', [...(character.inventory ?? []), { name: '', description: '' }])}>+ Предмет</button>}
              {canEdit && refOptions.items.length > 0 && (
                <>
                  <span style={{ fontSize: 10, color: 'var(--cs-text-muted)' }}>из справ.:</span>
                  <select className="cs-select" value={itemSelectValue} onChange={(e) => { const v = e.target.value; setItemSelectValue(v); if (v) { const entry = refOptions.items.find((x) => x.name === v); if (entry) addItemFromRef(entry); } }} style={{ width: 140 }}>
                    <option value="">— выбрать предмет</option>
                    {refOptions.items.map((e) => (<option key={e.id} value={e.name}>{e.name}</option>))}
                  </select>
                </>
              )}
            </div>
            </div>
          )}
        </div>

        <div className="cs-col">
          <div><label className="cs-label">Черты характера</label><textarea className="cs-textarea cs-textarea-xs" value={sheetData.traits ?? ''} onChange={(e) => updateSheetData({ traits: e.target.value })} disabled={!canEdit} rows={2} /></div>
          <div><label className="cs-label">Идеалы</label><textarea className="cs-textarea cs-textarea-xs" value={sheetData.ideals ?? ''} onChange={(e) => updateSheetData({ ideals: e.target.value })} disabled={!canEdit} rows={2} /></div>
          <div><label className="cs-label">Привязанности</label><textarea className="cs-textarea cs-textarea-xs" value={sheetData.bonds ?? ''} onChange={(e) => updateSheetData({ bonds: e.target.value })} disabled={!canEdit} rows={2} /></div>
          <div><label className="cs-label">Слабости</label><textarea className="cs-textarea cs-textarea-xs" value={sheetData.flaws ?? ''} onChange={(e) => updateSheetData({ flaws: e.target.value })} disabled={!canEdit} rows={2} /></div>
          <div><label className="cs-label">Умения и особенности</label><textarea className="cs-textarea cs-textarea-sm" value={sheetData.featuresTraits ?? ''} onChange={(e) => updateSheetData({ featuresTraits: e.target.value })} disabled={!canEdit} rows={4} /></div>
        </div>
      </div>
    </div>
  );
};
