import React, { useState, useEffect } from 'react';
import { createCharacter, updateCharacter, type Character, type InventoryItem } from '../../api/characters';
import { getReferenceEntriesBySlug, type ReferenceEntry } from '../../api/referenceBooks';
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

export interface CreateDraft {
  characterName: string;
  class: string;
  classArchetype: string;
  race: string;
  subrace: string;
  weight: string;
  height: string;
  backstory: string;
  appearance: string;
  imageUrl: string;
  experience: number;
  hp: number;
  maxHp: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  armorClass: number;
  initiative: number;
  speed: number;
  inventory: InventoryItem[];
  characterData: CharacterSheetData;
}

const defaultDraft: CreateDraft = {
  characterName: '',
  class: '',
  classArchetype: '',
  race: '',
  subrace: '',
  weight: '',
  height: '',
  backstory: '',
  appearance: '',
  imageUrl: '',
  experience: 0,
  hp: 10,
  maxHp: 10,
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
  armorClass: 10,
  initiative: 0,
  speed: 30,
  inventory: [],
  characterData: { ...DEFAULT_SHEET_DATA },
};

export interface CreateCharacterSheetProps {
  onCancel: () => void;
  onCreated: (character: Character) => void;
}

export const CreateCharacterSheet: React.FC<CreateCharacterSheetProps> = ({ onCancel, onCreated }) => {
  const [draft, setDraft] = useState<CreateDraft>(defaultDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const sheetData = draft.characterData;
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
    updateSheet({
      weapons: [...(sheetData.weapons ?? []), normalizeWeapon({ name: entry.name, damage, damageType })],
    });
    setWeaponSelectValue('');
  };
  const addItemFromRef = (entry: ReferenceEntry) => {
    const desc = typeof entry.data?.description === 'string' ? entry.data.description : (entry.data?.description != null ? String(entry.data.description) : '');
    setDraft((p) => ({ ...p, inventory: [...p.inventory, { name: entry.name, description: desc }] }));
    setItemSelectValue('');
  };
  const addAttackFromRef = (entry: ReferenceEntry) => {
    const attackBonus = (entry.data?.attackBonus ?? entry.data?.attack_bonus) as string | undefined;
    const damageType = (entry.data?.damageType ?? entry.data?.damage_type ?? entry.data?.damage) as string | undefined;
    updateSheet({ attacks: [...(sheetData.attacks ?? []), { name: entry.name, attackBonus: attackBonus ?? '', damageType: damageType ?? '' }] });
    setAttackSelectValue('');
  };
  const select = (value: string, onChange: (v: string) => void, options: ReferenceEntry[], placeholder: string) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={sheetStyle}>
      <option value="">{placeholder}</option>
      {options.map((e) => (
        <option key={e.id} value={e.name}>{e.name}</option>
      ))}
    </select>
  );
  const updateSheet = (patch: Partial<CharacterSheetData>) =>
    setDraft((prev) => ({ ...prev, characterData: { ...prev.characterData, ...patch } }));

  const getModifier = (n: number) => (Math.floor((n - 10) / 2) >= 0 ? `+${Math.floor((n - 10) / 2)}` : `${Math.floor((n - 10) / 2)}`);
  const level = xpToLevel(draft.experience);
  const profBonus = getProficiencyBonus(level);

  const sheetStyle = { border: '1px solid #333', padding: '4px 8px', borderRadius: 2, fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
  const labelStyle = { fontWeight: 600, fontSize: 11, textTransform: 'uppercase' as const, marginBottom: 2 };

  const input = (type: 'text' | 'number', value: string | number, onChange: (v: string | number) => void, opts?: { min?: number; placeholder?: string }) => (
    <input
      type={type}
      value={value}
      onChange={(e) => (type === 'number' ? onChange(parseInt(e.target.value, 10) || 0) : onChange(e.target.value))}
      min={opts?.min}
      placeholder={opts?.placeholder}
      style={sheetStyle}
    />
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = draft.characterName.trim() || 'Безымянный';
    setIsSubmitting(true);
    setError(null);
    try {
      const newChar = await createCharacter({ characterName: name });
      const updateData = {
        characterName: name,
        class: draft.class || undefined,
        classArchetype: draft.classArchetype || undefined,
        race: draft.race || undefined,
        subrace: draft.subrace || undefined,
        weight: draft.weight || undefined,
        height: draft.height || undefined,
        backstory: draft.backstory || undefined,
        appearance: draft.appearance || undefined,
        imageUrl: draft.imageUrl || undefined,
        experience: draft.experience,
        hp: draft.hp,
        maxHp: draft.maxHp,
        strength: draft.strength,
        dexterity: draft.dexterity,
        constitution: draft.constitution,
        intelligence: draft.intelligence,
        wisdom: draft.wisdom,
        charisma: draft.charisma,
        armorClass: draft.armorClass,
        initiative: draft.initiative,
        speed: draft.speed,
        inventory: draft.inventory.filter((i) => (i.name ?? '').trim()),
        characterData: draft.characterData,
      };
      const updated = await updateCharacter(newChar.id, updateData);
      onCreated(updated);
    } catch (err: any) {
      setError(err.message || 'Ошибка создания персонажа');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="character-sheet-page" style={{ padding: 16, width: '100%', background: '#fff', color: '#000' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Новый персонаж</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onCancel} style={{ padding: '8px 16px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>Отмена</button>
          <button type="submit" form="create-sheet-form" disabled={isSubmitting} style={{ padding: '8px 16px', background: isSubmitting ? '#6c757d' : '#28a745', color: '#fff', border: 'none', borderRadius: 6, cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: 14 }}>{isSubmitting ? 'Создание...' : 'Создать'}</button>
        </div>
        {error && <div style={{ color: '#dc3545', fontSize: 14, width: '100%' }}>{error}</div>}
      </div>

      <form id="create-sheet-form" onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Портрет</h2>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 120, height: 120, border: '1px solid #333', borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#f5f5f5' }}>
              {draft.imageUrl ? (
                <img src={draft.imageUrl} alt="Персонаж" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#666' }}>Нет изображения</div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ padding: '6px 12px', background: '#0d6efd', color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
                Загрузить
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = () => setDraft((p) => ({ ...p, imageUrl: reader.result as string })); reader.readAsDataURL(file); } }} />
              </label>
              <button type="button" onClick={() => setDraft((p) => ({ ...p, imageUrl: '' }))} style={{ padding: '6px 12px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Удалить</button>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><label style={labelStyle}>Имя персонажа</label><br />{input('text', draft.characterName, (v) => setDraft((p) => ({ ...p, characterName: String(v) })), { placeholder: 'Обязательно' })}</div>
          <div><label style={labelStyle}>Класс и уровень</label><br /><span style={{ display: 'flex', gap: 4 }}>{select(draft.class, (v) => setDraft((p) => ({ ...p, class: v })), refOptions.classes, '—')}<span style={{ ...sheetStyle, width: 40, textAlign: 'center', lineHeight: '28px' }}>{level}</span></span></div>
          <div><label style={labelStyle}>Имя игрока</label><br /><input type="text" placeholder="—" readOnly style={{ ...sheetStyle, background: '#f5f5f5' }} /></div>
          <div><label style={labelStyle}>Опыт</label><br />{input('number', draft.experience, (v) => setDraft((p) => ({ ...p, experience: typeof v === 'number' ? v : 0 })), { min: 0 })}</div>
          <div><label style={labelStyle}>Раса</label><br />{select(draft.race, (v) => setDraft((p) => ({ ...p, race: v })), refOptions.races, '—')}</div>
          <div><label style={labelStyle}>Архетип класса</label><br />{select(draft.classArchetype, (v) => setDraft((p) => ({ ...p, classArchetype: v })), refOptions.subclasses, '—')}</div>
          <div><label style={labelStyle}>Мировоззрение</label><br />{select(sheetData.alignment ?? '', (v) => updateSheet({ alignment: v }), refOptions.alignments, '—')}</div>
          <div><label style={labelStyle}>Подраса</label><br />{select(draft.subrace, (v) => setDraft((p) => ({ ...p, subrace: v })), refOptions.subraces, '—')}</div>
          <div><label style={labelStyle}>Вес</label><br />{input('text', draft.weight, (v) => setDraft((p) => ({ ...p, weight: String(v) })), { placeholder: '55 кг' })}</div>
          <div><label style={labelStyle}>Рост</label><br />{input('text', draft.height, (v) => setDraft((p) => ({ ...p, height: String(v) })), { placeholder: '185 см' })}</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Предыстория</label>
          {select(sheetData.background ?? '', (v) => updateSheet({ background: v }), refOptions.backgrounds, '—')}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Предистория (рассказ)</label>
          <textarea value={draft.backstory} onChange={(e) => setDraft((p) => ({ ...p, backstory: e.target.value }))} rows={3} style={{ ...sheetStyle, resize: 'vertical', width: '100%', marginTop: 4 }} placeholder="Рассказ о прошлом персонажа..." />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Внешность</label>
          <textarea value={draft.appearance} onChange={(e) => setDraft((p) => ({ ...p, appearance: e.target.value }))} rows={2} style={{ ...sheetStyle, resize: 'vertical', width: '100%', marginTop: 4 }} placeholder="Описание внешности..." />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(280px, 1.2fr) minmax(200px, 1fr)', gap: 16, alignItems: 'start' }}>
          {/* Левая колонка */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={labelStyle}>Вдохновение</label>
              <input type="checkbox" checked={!!sheetData.inspiration} onChange={(e) => updateSheet({ inspiration: e.target.checked })} />
              <label style={labelStyle}>Бонус мастерства</label>
              <span style={{ ...sheetStyle, width: 36, textAlign: 'center' }}>+{profBonus}</span>
            </div>
            {(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const).map((key) => {
              const names: Record<AbilityKey, string> = { strength: 'Сила', dexterity: 'Ловкость', constitution: 'Телосложение', intelligence: 'Интеллект', wisdom: 'Мудрость', charisma: 'Харизма' };
              const v = draft[key];
              return (
                <div key={key} style={{ flex: '0 0 80px' }}>
                  <label style={labelStyle}>{names[key]}</label>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {input('number', v, (val) => setDraft((p) => ({ ...p, [key]: typeof val === 'number' ? val : 10 })))}
                    <span style={{ fontSize: 12 }}>{getModifier(v)}</span>
                  </div>
                </div>
              );
            })}
            <div><h3 style={{ margin: '8px 0 4px', fontSize: 12 }}>Спасброски</h3>
              {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map((abil, i) => {
                const names = ['Сила', 'Ловкость', 'Тел.', 'Инт.', 'Мудрость', 'Хар.'];
                const prof = (sheetData.savingThrowProficiencies ?? []).includes(abil);
                const score = draft[abil as AbilityKey];
                const mod = Math.floor((score - 10) / 2) + (prof ? profBonus : 0);
                return (
                  <div key={abil} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <input type="checkbox" checked={prof} onChange={(e) => updateSheet({ savingThrowProficiencies: e.target.checked ? [...(sheetData.savingThrowProficiencies ?? []), abil] : (sheetData.savingThrowProficiencies ?? []).filter((x) => x !== abil) })} />
                    <span style={{ width: 70, fontSize: 12 }}>{names[i]}</span>
                    <span style={{ ...sheetStyle, width: 40, textAlign: 'center' }}>{mod >= 0 ? '+' : ''}{mod}</span>
                  </div>
                );
              })}
            </div>
            <div><h3 style={{ margin: '8px 0 4px', fontSize: 12 }}>Навыки</h3>
              {DND_SKILLS.map((sk) => {
                const prof = (sheetData.skillProficiencies ?? []).includes(sk.key);
                const score = draft[sk.ability];
                const mod = Math.floor((score - 10) / 2) + (prof ? profBonus : 0);
                return (
                  <div key={sk.key} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <input type="checkbox" checked={prof} onChange={(e) => updateSheet({ skillProficiencies: e.target.checked ? [...(sheetData.skillProficiencies ?? []), sk.key] : (sheetData.skillProficiencies ?? []).filter((x) => x !== sk.key) })} />
                    <span style={{ flex: 1, fontSize: 11 }}>{sk.name}</span>
                    <span style={{ ...sheetStyle, width: 36, textAlign: 'center' }}>{mod >= 0 ? '+' : ''}{mod}</span>
                  </div>
                );
              })}
            </div>
            <div><label style={labelStyle}>Пассивная мудрость (Внимательность)</label>{input('number', sheetData.passivePerception ?? 10, (v) => updateSheet({ passivePerception: typeof v === 'number' ? v : 10 }))}</div>
            <div><label style={labelStyle}>Владение</label><textarea value={sheetData.proficiencies ?? sheetData.proficienciesAndLanguages ?? ''} onChange={(e) => updateSheet({ proficiencies: e.target.value })} rows={3} style={{ ...sheetStyle, resize: 'vertical' }} placeholder="Инструменты, оружие и т.д." /></div>
            <div><label style={labelStyle}>Языки</label><textarea value={sheetData.languages ?? ''} onChange={(e) => updateSheet({ languages: e.target.value })} rows={2} style={{ ...sheetStyle, resize: 'vertical' }} placeholder="Языки персонажа" /></div>
          </div>

          {/* Центр */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div><label style={labelStyle}>КД</label>{input('number', draft.armorClass, (v) => setDraft((p) => ({ ...p, armorClass: typeof v === 'number' ? v : 10 })))}</div>
              <div><label style={labelStyle}>Инициатива</label>{input('number', draft.initiative, (v) => setDraft((p) => ({ ...p, initiative: typeof v === 'number' ? v : 0 })))}</div>
              <div><label style={labelStyle}>Скорость</label>{input('number', draft.speed, (v) => setDraft((p) => ({ ...p, speed: typeof v === 'number' ? v : 30 })))}</div>
            </div>
            <div><label style={labelStyle}>Максимум хитов</label>{input('number', draft.maxHp, (v) => setDraft((p) => ({ ...p, maxHp: typeof v === 'number' ? v : 10 })))}</div>
            <div><label style={labelStyle}>Текущие хиты</label>{input('number', draft.hp, (v) => setDraft((p) => ({ ...p, hp: typeof v === 'number' ? v : 10 })))}</div>
            <div><label style={labelStyle}>Временные хиты</label>{input('number', sheetData.tempHp ?? 0, (v) => updateSheet({ tempHp: typeof v === 'number' ? v : 0 }))}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label style={labelStyle}>Кость хитов (итого)</label><input type="text" value={sheetData.hitDiceTotal ?? ''} onChange={(e) => updateSheet({ hitDiceTotal: e.target.value })} placeholder="1к8" style={sheetStyle} /></div>
              <div><label style={labelStyle}>Потрачено</label>{input('number', sheetData.hitDiceUsed ?? 0, (v) => updateSheet({ hitDiceUsed: typeof v === 'number' ? v : 0 }))}</div>
            </div>
            <div><label style={labelStyle}>Спасброски от смерти</label>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11 }}>Успехи:</span>
                {[0, 1, 2].map((i) => (
                  <input key={`s${i}`} type="checkbox" checked={(sheetData.deathSaveSuccesses ?? 0) > i} onChange={() => updateSheet({ deathSaveSuccesses: (sheetData.deathSaveSuccesses ?? 0) === i + 1 ? i : i + 1 })} />
                ))}
                <span style={{ fontSize: 11, marginLeft: 8 }}>Провалы:</span>
                {[0, 1, 2].map((i) => (
                  <input key={`f${i}`} type="checkbox" checked={(sheetData.deathSaveFailures ?? 0) > i} onChange={() => updateSheet({ deathSaveFailures: (sheetData.deathSaveFailures ?? 0) === i + 1 ? i : i + 1 })} />
                ))}
              </div>
            </div>
            <div><h3 style={{ margin: '8px 0 4px', fontSize: 12 }}>Атаки и заклинания</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr><th style={{ textAlign: 'left', borderBottom: '1px solid #333' }}>Название</th><th style={{ textAlign: 'left', borderBottom: '1px solid #333' }}>Бонус атаки</th><th style={{ textAlign: 'left', borderBottom: '1px solid #333' }}>Урон/вид</th></tr></thead>
                <tbody>
                  {(sheetData.attacks ?? []).map((at, i) => (
                    <tr key={i}>
                      <td><input type="text" value={at.name} onChange={(e) => { const a = [...(sheetData.attacks ?? [])]; a[i] = { ...a[i], name: e.target.value }; updateSheet({ attacks: a }); }} style={{ ...sheetStyle, border: 'none', padding: 2 }} /></td>
                      <td><input type="text" value={at.attackBonus} onChange={(e) => { const a = [...(sheetData.attacks ?? [])]; a[i] = { ...a[i], attackBonus: e.target.value }; updateSheet({ attacks: a }); }} style={{ ...sheetStyle, border: 'none', padding: 2, width: 60 }} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}><input type="text" value={at.damageType} onChange={(e) => { const a = [...(sheetData.attacks ?? [])]; a[i] = { ...a[i], damageType: e.target.value }; updateSheet({ attacks: a }); }} style={{ ...sheetStyle, border: 'none', padding: 2 }} /><button type="button" onClick={() => updateSheet({ attacks: (sheetData.attacks ?? []).filter((_, j) => j !== i) })} style={{ marginLeft: 4 }}>×</button></td>
                    </tr>
                  ))}
                  <tr><td colSpan={3}><button type="button" onClick={() => updateSheet({ attacks: [...(sheetData.attacks ?? []), { name: '', attackBonus: '', damageType: '' }] })} style={{ fontSize: 12 }}>+ Атака</button></td></tr>
                  {refOptions.attacks.length > 0 && (
                    <tr><td colSpan={3} style={{ paddingTop: 4 }}>
                      <span style={{ fontSize: 12, color: '#666', marginRight: 8 }}>или из справочника:</span>
                      <select
                        value={attackSelectValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAttackSelectValue(v);
                          if (v) {
                            const entry = refOptions.attacks.find((x) => x.name === v);
                            if (entry) addAttackFromRef(entry);
                          }
                        }}
                        style={{ ...sheetStyle, width: 220, display: 'inline-block' }}
                      >
                        <option value="">— атака или заклинание</option>
                        {refOptions.attacks.map((e) => (
                          <option key={e.id} value={e.name}>{e.name}</option>
                        ))}
                      </select>
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
                    <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                      <input type="checkbox" checked={checked} onChange={(e) => { const next = e.target.checked ? [...(sheetData.conditions ?? []), opt.key] : (sheetData.conditions ?? []).filter((c) => c !== opt.key); updateSheet({ conditions: next }); }} />
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
                      <input type="number" min={0} value={slot.total} onChange={(e) => { const v = parseInt(e.target.value, 10) || 0; const slots = [...(sheetData.spellSlots ?? [])]; const i = slots.findIndex((s) => s.level === lv); if (i >= 0) slots[i] = { ...slots[i], total: v }; else slots.push({ level: lv, total: v, used: 0 }); slots.sort((a, b) => a.level - b.level); updateSheet({ spellSlots: slots }); }} style={{ ...sheetStyle, width: 40 }} title="Всего" />
                      <span style={{ fontSize: 12 }}>/</span>
                      <input type="number" min={0} value={slot.used} onChange={(e) => { const v = Math.max(0, parseInt(e.target.value, 10) || 0); const slots = [...(sheetData.spellSlots ?? [])]; const i = slots.findIndex((s) => s.level === lv); const entry = i >= 0 ? slots[i] : { level: lv, total: 0, used: 0 }; const nextSlots = i >= 0 ? slots : [...slots, entry]; const j = nextSlots.findIndex((s) => s.level === lv); nextSlots[j] = { ...nextSlots[j], used: Math.min(v, nextSlots[j].total) }; nextSlots.sort((a, b) => a.level - b.level); updateSheet({ spellSlots: nextSlots }); }} style={{ ...sheetStyle, width: 40 }} title="Потрачено" />
                    </div>
                  );
                })}
              </div>
            </div>
            <div><label style={labelStyle}>Валюта (ММ, СМ, ЗМ, ПМ, МД)</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(['copper', 'silver', 'electrum', 'gold', 'platinum'] as const).map((c) => (
                  <input key={c} type="number" min={0} value={sheetData.currency?.[c] ?? 0} onChange={(e) => updateSheet({ currency: { ...(sheetData.currency ?? {}), [c]: parseInt(e.target.value, 10) || 0 } })} style={{ ...sheetStyle, width: 52 }} />
                ))}
              </div>
            </div>
            <div><label style={labelStyle}>Снаряжение</label><textarea value={sheetData.equipment ?? ''} onChange={(e) => updateSheet({ equipment: e.target.value })} rows={6} style={{ ...sheetStyle, resize: 'vertical' }} /></div>
            <div><h3 style={{ margin: '8px 0 4px', fontSize: 12 }}>Оружие</h3>
              {(sheetData.weapons ?? []).map((w, index) => (
                <div key={index} style={{ marginBottom: 8, padding: 8, border: '1px solid #dee2e6', borderRadius: 4 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="text" value={w.name} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), name: e.target.value }; updateSheet({ weapons: next }); }} placeholder="Оружие" style={{ ...sheetStyle, flex: 1, minWidth: 100 }} />
                    <input type="text" value={w.damage} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), damage: e.target.value }; updateSheet({ weapons: next }); }} placeholder="Кубики урона (1к8, 2к6)" style={{ ...sheetStyle, width: 140 }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                      <input type="checkbox" checked={w.proficient ?? false} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), proficient: e.target.checked }; updateSheet({ weapons: next }); }} />
                      Владение
                    </label>
                    <select value={w.ability ?? 'strength'} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), ability: e.target.value as AbilityKey }; updateSheet({ weapons: next }); }} style={{ ...sheetStyle, width: 72 }}>
                      {ABILITY_KEYS.map((key) => (
                        <option key={key} value={key}>{ABILITY_LABELS[key]}</option>
                      ))}
                    </select>
                    <select value={w.damageType ?? ''} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), damageType: (e.target.value || undefined) as WeaponDamageType | undefined }; updateSheet({ weapons: next }); }} style={{ ...sheetStyle, width: 100 }} title="Тип урона">
                      <option value="">— тип</option>
                      {WEAPON_DAMAGE_TYPES.map((key) => (
                        <option key={key} value={key}>{WEAPON_DAMAGE_TYPE_LABELS[key]}</option>
                      ))}
                    </select>
                    <input type="text" value={w.attackModifier ?? ''} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), attackModifier: e.target.value || undefined }; updateSheet({ weapons: next }); }} placeholder="Бонус атаки (опц.)" style={{ ...sheetStyle, width: 110 }} title="Оставьте пустым — считается по характеристике и владению" />
                    <button type="button" onClick={() => updateSheet({ weapons: (sheetData.weapons ?? []).filter((_, i) => i !== index) })}>×</button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
              <button type="button" onClick={() => updateSheet({ weapons: [...(sheetData.weapons ?? []), normalizeWeapon({ name: '', damage: '' })] })}>+ Оружие</button>
              {refOptions.weapons.length > 0 && (
                <>
                  <span style={{ fontSize: 12, color: '#666' }}>или из справочника:</span>
                  <select
                    value={weaponSelectValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      setWeaponSelectValue(v);
                      if (v) {
                        const entry = refOptions.weapons.find((x) => x.name === v);
                        if (entry) addWeaponFromRef(entry);
                      }
                    }}
                    style={{ ...sheetStyle, width: 220 }}
                  >
                    <option value="">— выбрать оружие</option>
                    {refOptions.weapons.map((e) => (
                      <option key={e.id} value={e.name}>{e.name}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
            </div>
            <div><h3 style={{ margin: '8px 0 4px', fontSize: 12 }}>Инвентарь</h3>
              {draft.inventory.map((item, index) => (
                <div key={index} style={{ marginBottom: 8, padding: 8, border: '1px solid #dee2e6', borderRadius: 4 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    <input type="text" value={item.name ?? ''} onChange={(e) => { const next = [...draft.inventory]; next[index] = { ...next[index], name: e.target.value }; setDraft((p) => ({ ...p, inventory: next })); }} placeholder="Название" style={{ ...sheetStyle, flex: 1 }} />
                    <button type="button" onClick={() => setDraft((p) => ({ ...p, inventory: p.inventory.filter((_, i) => i !== index) }))}>×</button>
                  </div>
                  <textarea value={item.description ?? ''} onChange={(e) => { const next = [...draft.inventory]; next[index] = { ...next[index], description: e.target.value }; setDraft((p) => ({ ...p, inventory: next })); }} placeholder="Описание" rows={2} style={{ ...sheetStyle, width: '100%', resize: 'vertical', marginTop: 4 }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
              <button type="button" onClick={() => setDraft((p) => ({ ...p, inventory: [...p.inventory, { name: '', description: '' }] }))}>+ Предмет</button>
              {refOptions.items.length > 0 && (
                <>
                  <span style={{ fontSize: 12, color: '#666' }}>или из справочника:</span>
                  <select
                    value={itemSelectValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      setItemSelectValue(v);
                      if (v) {
                        const entry = refOptions.items.find((x) => x.name === v);
                        if (entry) addItemFromRef(entry);
                      }
                    }}
                    style={{ ...sheetStyle, width: 220 }}
                  >
                    <option value="">— выбрать предмет</option>
                    {refOptions.items.map((e) => (
                      <option key={e.id} value={e.name}>{e.name}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
            </div>
          </div>

          {/* Правая колонка */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={labelStyle}>Черты характера</label><textarea value={sheetData.traits ?? ''} onChange={(e) => updateSheet({ traits: e.target.value })} rows={3} style={{ ...sheetStyle, resize: 'vertical' }} /></div>
            <div><label style={labelStyle}>Идеалы</label><textarea value={sheetData.ideals ?? ''} onChange={(e) => updateSheet({ ideals: e.target.value })} rows={3} style={{ ...sheetStyle, resize: 'vertical' }} /></div>
            <div><label style={labelStyle}>Привязанности</label><textarea value={sheetData.bonds ?? ''} onChange={(e) => updateSheet({ bonds: e.target.value })} rows={3} style={{ ...sheetStyle, resize: 'vertical' }} /></div>
            <div><label style={labelStyle}>Слабости</label><textarea value={sheetData.flaws ?? ''} onChange={(e) => updateSheet({ flaws: e.target.value })} rows={3} style={{ ...sheetStyle, resize: 'vertical' }} /></div>
            <div><label style={labelStyle}>Умения и особенности</label><textarea value={sheetData.featuresTraits ?? ''} onChange={(e) => updateSheet({ featuresTraits: e.target.value })} rows={8} style={{ ...sheetStyle, resize: 'vertical' }} /></div>
          </div>
        </div>
      </form>
    </div>
  );
};
