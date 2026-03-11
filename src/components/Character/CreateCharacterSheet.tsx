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
import './CharacterSheet.css';

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
    <select className="cs-select" value={value} onChange={(e) => onChange(e.target.value)}>
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

  const sheetStyle = { width: '100%', boxSizing: 'border-box' as const };
  const labelStyle = {};

  const input = (type: 'text' | 'number', value: string | number, onChange: (v: string | number) => void, opts?: { min?: number; placeholder?: string }) => (
    <input
      type={type}
      className="cs-input"
      value={value}
      onChange={(e) => (type === 'number' ? onChange(parseInt(e.target.value, 10) || 0) : onChange(e.target.value))}
      min={opts?.min}
      placeholder={opts?.placeholder}
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
    <div className="cs-root">
      <div className="cs-header">
        <h2 className="cs-title">Новый персонаж</h2>
        <div className="cs-actions">
          <button type="button" onClick={onCancel} className="cs-btn cs-btn-ghost">Отмена</button>
          <button type="submit" form="create-sheet-form" disabled={isSubmitting} className="cs-btn cs-btn-primary">{isSubmitting ? 'Создание...' : 'Создать'}</button>
        </div>
        {error && <div style={{ color: '#c53030', fontSize: 12, width: '100%' }}>{error}</div>}
      </div>

      <form id="create-sheet-form" onSubmit={handleSubmit}>
        <div className="cs-section">
          <h2 className="cs-section-title">Портрет</h2>
          <div className="cs-portrait-wrap">
            <div className="cs-portrait-box">
              {draft.imageUrl ? (
                <img src={draft.imageUrl} alt="Персонаж" className="cs-portrait-img" />
              ) : (
                <div className="cs-portrait-placeholder">Нет изображения</div>
              )}
            </div>
            <div className="cs-portrait-btns">
              <label className="cs-btn cs-btn-primary" style={{ margin: 0 }}>
                Загрузить
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = () => setDraft((p) => ({ ...p, imageUrl: reader.result as string })); reader.readAsDataURL(file); } }} />
              </label>
              <button type="button" className="cs-btn cs-btn-ghost" onClick={() => setDraft((p) => ({ ...p, imageUrl: '' }))}>Удалить</button>
            </div>
          </div>
        </div>
        <div className="cs-section">
          <div className="cs-grid-header">
            <div><label className="cs-label">Имя персонажа</label>{input('text', draft.characterName, (v) => setDraft((p) => ({ ...p, characterName: String(v) })), { placeholder: 'Обязательно' })}</div>
            <div><label className="cs-label">Класс и уровень</label><span className="cs-row">{select(draft.class, (v) => setDraft((p) => ({ ...p, class: v })), refOptions.classes, '—')}<span className="cs-inline-num">{level}</span></span></div>
            <div><label className="cs-label">Имя игрока</label><input type="text" className="cs-input" placeholder="—" readOnly style={{ background: '#eee' }} /></div>
            <div><label className="cs-label">Опыт</label>{input('number', draft.experience, (v) => setDraft((p) => ({ ...p, experience: typeof v === 'number' ? v : 0 })), { min: 0 })}</div>
            <div><label className="cs-label">Раса</label>{select(draft.race, (v) => setDraft((p) => ({ ...p, race: v })), refOptions.races, '—')}</div>
            <div><label className="cs-label">Архетип класса</label>{select(draft.classArchetype, (v) => setDraft((p) => ({ ...p, classArchetype: v })), refOptions.subclasses, '—')}</div>
            <div><label className="cs-label">Мировоззрение</label>{select(sheetData.alignment ?? '', (v) => updateSheet({ alignment: v }), refOptions.alignments, '—')}</div>
            <div><label className="cs-label">Подраса</label>{select(draft.subrace, (v) => setDraft((p) => ({ ...p, subrace: v })), refOptions.subraces, '—')}</div>
            <div><label className="cs-label">Вес</label>{input('text', draft.weight, (v) => setDraft((p) => ({ ...p, weight: String(v) })), { placeholder: '55 кг' })}</div>
            <div><label className="cs-label">Рост</label>{input('text', draft.height, (v) => setDraft((p) => ({ ...p, height: String(v) })), { placeholder: '185 см' })}</div>
          </div>
          <div style={{ marginBottom: 6 }}><label className="cs-label">Предыстория</label>{select(sheetData.background ?? '', (v) => updateSheet({ background: v }), refOptions.backgrounds, '—')}</div>
          <div style={{ marginBottom: 6 }}><label className="cs-label">Предистория (рассказ)</label><textarea className="cs-textarea cs-textarea-sm" value={draft.backstory} onChange={(e) => setDraft((p) => ({ ...p, backstory: e.target.value }))} rows={2} placeholder="Рассказ о прошлом персонажа..." /></div>
          <div><label className="cs-label">Внешность</label><textarea className="cs-textarea cs-textarea-xs" value={draft.appearance} onChange={(e) => setDraft((p) => ({ ...p, appearance: e.target.value }))} rows={1} placeholder="Описание внешности..." /></div>
        </div>

        <div className="cs-grid-cols">
          <div className="cs-col">
            <div className="cs-row">
              <label className="cs-label">Вдохновение</label>
              <input type="checkbox" checked={!!sheetData.inspiration} onChange={(e) => updateSheet({ inspiration: e.target.checked })} />
              <label className="cs-label">Бонус мастерства</label>
              <span className="cs-inline-num">+{profBonus}</span>
            </div>
            <div className="cs-abilities">
              {(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const).map((key) => {
                const names: Record<AbilityKey, string> = { strength: 'Сила', dexterity: 'Ловкость', constitution: 'Тел.', intelligence: 'Инт.', wisdom: 'Мудрость', charisma: 'Хар.' };
                const v = draft[key];
                return (
                  <div key={key} className="cs-ability">
                    <label className="cs-label">{names[key]}</label>
                    {input('number', v, (val) => setDraft((p) => ({ ...p, [key]: typeof val === 'number' ? val : 10 })))}
                    <span className="cs-ability-mod">{getModifier(v)}</span>
                  </div>
                );
              })}
            </div>
            <h3 className="cs-section-title">Спасброски</h3>
              {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map((abil, i) => {
                const names = ['Сила', 'Ловкость', 'Тел.', 'Инт.', 'Мудрость', 'Хар.'];
                const prof = (sheetData.savingThrowProficiencies ?? []).includes(abil);
                const score = draft[abil as AbilityKey];
                const mod = Math.floor((score - 10) / 2) + (prof ? profBonus : 0);
                return (
                  <div key={abil} className="cs-list-row">
                    <input type="checkbox" checked={prof} onChange={(e) => updateSheet({ savingThrowProficiencies: e.target.checked ? [...(sheetData.savingThrowProficiencies ?? []), abil] : (sheetData.savingThrowProficiencies ?? []).filter((x) => x !== abil) })} />
                    <span style={{ width: 56, fontSize: 11 }}>{names[i]}</span>
                    <span className="cs-num" style={{ display: 'inline-block' }}>{mod >= 0 ? '+' : ''}{mod}</span>
                  </div>
                );
              })}
            <h3 className="cs-section-title">Навыки</h3>
              {DND_SKILLS.map((sk) => {
                const prof = (sheetData.skillProficiencies ?? []).includes(sk.key);
                const score = draft[sk.ability];
                const mod = Math.floor((score - 10) / 2) + (prof ? profBonus : 0);
                return (
                  <div key={sk.key} className="cs-list-row">
                    <input type="checkbox" checked={prof} onChange={(e) => updateSheet({ skillProficiencies: e.target.checked ? [...(sheetData.skillProficiencies ?? []), sk.key] : (sheetData.skillProficiencies ?? []).filter((x) => x !== sk.key) })} />
                    <span style={{ flex: 1, fontSize: 11 }}>{sk.name}</span>
                    <span className="cs-num" style={{ display: 'inline-block' }}>{mod >= 0 ? '+' : ''}{mod}</span>
                  </div>
                );
              })}
            <div><label className="cs-label">Пассивная мудрость (Внимательность)</label>{input('number', sheetData.passivePerception ?? 10, (v) => updateSheet({ passivePerception: typeof v === 'number' ? v : 10 }))}</div>
            <div><label className="cs-label">Владение</label><textarea className="cs-textarea cs-textarea-xs" value={sheetData.proficiencies ?? sheetData.proficienciesAndLanguages ?? ''} onChange={(e) => updateSheet({ proficiencies: e.target.value })} rows={2} placeholder="Инструменты, оружие и т.д." /></div>
            <div><label className="cs-label">Языки</label><textarea className="cs-textarea cs-textarea-xs" value={sheetData.languages ?? ''} onChange={(e) => updateSheet({ languages: e.target.value })} rows={1} placeholder="Языки персонажа" /></div>
          </div>

          <div className="cs-col">
            <div className="cs-combat-row">
              <div><label className="cs-label">КД</label>{input('number', draft.armorClass, (v) => setDraft((p) => ({ ...p, armorClass: typeof v === 'number' ? v : 10 })))}</div>
              <div><label className="cs-label">Инициатива</label>{input('number', draft.initiative, (v) => setDraft((p) => ({ ...p, initiative: typeof v === 'number' ? v : 0 })))}</div>
              <div><label className="cs-label">Скорость</label>{input('number', draft.speed, (v) => setDraft((p) => ({ ...p, speed: typeof v === 'number' ? v : 30 })))}</div>
            </div>
            <div className="cs-hp-row">
              <div><label className="cs-label">Макс. хиты</label>{input('number', draft.maxHp, (v) => setDraft((p) => ({ ...p, maxHp: typeof v === 'number' ? v : 10 })))}</div>
              <div><label className="cs-label">Хиты</label>{input('number', draft.hp, (v) => setDraft((p) => ({ ...p, hp: typeof v === 'number' ? v : 10 })))}</div>
              <div><label className="cs-label">Врем. хиты</label>{input('number', sheetData.tempHp ?? 0, (v) => updateSheet({ tempHp: typeof v === 'number' ? v : 0 }))}</div>
            </div>
            <div className="cs-row">
              <div><label className="cs-label">Кость хитов</label><input type="text" className="cs-input" value={sheetData.hitDiceTotal ?? ''} onChange={(e) => updateSheet({ hitDiceTotal: e.target.value })} placeholder="1к8" style={{ maxWidth: 56 }} /></div>
              <div><label className="cs-label">Потрачено</label>{input('number', sheetData.hitDiceUsed ?? 0, (v) => updateSheet({ hitDiceUsed: typeof v === 'number' ? v : 0 }))}</div>
            </div>
            <div><label className="cs-label">Спасброски от смерти</label>
              <div className="cs-row" style={{ marginTop: 4 }}>
                <span style={{ fontSize: 10 }}>Успехи:</span>
                {[0, 1, 2].map((i) => (
                  <input key={`s${i}`} type="checkbox" checked={(sheetData.deathSaveSuccesses ?? 0) > i} onChange={() => updateSheet({ deathSaveSuccesses: (sheetData.deathSaveSuccesses ?? 0) === i + 1 ? i : i + 1 })} />
                ))}
                <span style={{ fontSize: 10, marginLeft: 6 }}>Провалы:</span>
                {[0, 1, 2].map((i) => (
                  <input key={`f${i}`} type="checkbox" checked={(sheetData.deathSaveFailures ?? 0) > i} onChange={() => updateSheet({ deathSaveFailures: (sheetData.deathSaveFailures ?? 0) === i + 1 ? i : i + 1 })} />
                ))}
              </div>
            </div>
            <h3 className="cs-section-title">Атаки и заклинания</h3>
              <table className="cs-attacks-table">
                <thead><tr><th>Название</th><th>Бонус</th><th>Урон/вид</th></tr></thead>
                <tbody>
                  {(sheetData.attacks ?? []).map((at, i) => (
                    <tr key={i}>
                      <td><input type="text" className="cs-input" value={at.name} onChange={(e) => { const a = [...(sheetData.attacks ?? [])]; a[i] = { ...a[i], name: e.target.value }; updateSheet({ attacks: a }); }} /></td>
                      <td><input type="text" className="cs-input" value={at.attackBonus} onChange={(e) => { const a = [...(sheetData.attacks ?? [])]; a[i] = { ...a[i], attackBonus: e.target.value }; updateSheet({ attacks: a }); }} style={{ width: 48 }} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}><input type="text" className="cs-input" value={at.damageType} onChange={(e) => { const a = [...(sheetData.attacks ?? [])]; a[i] = { ...a[i], damageType: e.target.value }; updateSheet({ attacks: a }); }} /><button type="button" className="cs-btn cs-btn-ghost" onClick={() => updateSheet({ attacks: (sheetData.attacks ?? []).filter((_, j) => j !== i) })} style={{ padding: '2px 6px' }}>×</button></td>
                    </tr>
                  ))}
                  <tr><td colSpan={3}><button type="button" className="cs-btn cs-btn-ghost" onClick={() => updateSheet({ attacks: [...(sheetData.attacks ?? []), { name: '', attackBonus: '', damageType: '' }] })}>+ Атака</button></td></tr>
                  {refOptions.attacks.length > 0 && (
                    <tr><td colSpan={3} style={{ paddingTop: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--cs-text-muted)', marginRight: 6 }}>из справочника:</span>
                      <select className="cs-select" value={attackSelectValue} onChange={(e) => { const v = e.target.value; setAttackSelectValue(v); if (v) { const entry = refOptions.attacks.find((x) => x.name === v); if (entry) addAttackFromRef(entry); } }} style={{ width: 160, display: 'inline-block' }}>
                        <option value="">— атака или заклинание</option>
                        {refOptions.attacks.map((e) => (<option key={e.id} value={e.name}>{e.name}</option>))}
                      </select>
                    </td></tr>
                  )}
                </tbody>
              </table>
            <div><h3 className="cs-section-title">Состояния</h3>
              <div className="cs-conditions">
                {CONDITION_OPTIONS.map((opt) => {
                  const checked = (sheetData.conditions ?? []).includes(opt.key);
                  return (
                    <label key={opt.key}>
                      <input type="checkbox" checked={checked} onChange={(e) => { const next = e.target.checked ? [...(sheetData.conditions ?? []), opt.key] : (sheetData.conditions ?? []).filter((c) => c !== opt.key); updateSheet({ conditions: next }); }} />
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
                      <input type="number" min={0} className="cs-input" value={slot.total} onChange={(e) => { const v = parseInt(e.target.value, 10) || 0; const slots = [...(sheetData.spellSlots ?? [])]; const i = slots.findIndex((s) => s.level === lv); if (i >= 0) slots[i] = { ...slots[i], total: v }; else slots.push({ level: lv, total: v, used: 0 }); slots.sort((a, b) => a.level - b.level); updateSheet({ spellSlots: slots }); }} title="Всего" />
                      <span style={{ fontSize: 10 }}>{'/'}</span>
                      <input type="number" min={0} className="cs-input" value={slot.used} onChange={(e) => { const v = Math.max(0, parseInt(e.target.value, 10) || 0); const slots = [...(sheetData.spellSlots ?? [])]; const i = slots.findIndex((s) => s.level === lv); const entry = i >= 0 ? slots[i] : { level: lv, total: 0, used: 0 }; const nextSlots = i >= 0 ? slots : [...slots, entry]; const j = nextSlots.findIndex((s) => s.level === lv); nextSlots[j] = { ...nextSlots[j], used: Math.min(v, nextSlots[j].total) }; nextSlots.sort((a, b) => a.level - b.level); updateSheet({ spellSlots: nextSlots }); }} title="Потрачено" />
                    </div>
                  );
                })}
              </div>
            <div><label className="cs-label">Валюта (ММ, СМ, ЗМ, ПМ, МД)</label>
              <div className="cs-currency">
                {(['copper', 'silver', 'electrum', 'gold', 'platinum'] as const).map((c) => (
                  <input key={c} type="number" min={0} className="cs-input" value={sheetData.currency?.[c] ?? 0} onChange={(e) => updateSheet({ currency: { ...(sheetData.currency ?? {}), [c]: parseInt(e.target.value, 10) || 0 } })} />
                ))}
              </div>
            </div>
            <div><label className="cs-label">Снаряжение</label><textarea className="cs-textarea cs-textarea-sm" value={sheetData.equipment ?? ''} onChange={(e) => updateSheet({ equipment: e.target.value })} rows={3} /></div>
            <div>
            <h3 className="cs-section-title">Оружие</h3>
              {(sheetData.weapons ?? []).map((w, index) => (
                <div key={index} className="cs-item-card">
                  <div className="cs-item-row">
                    <input type="text" className="cs-input" value={w.name} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), name: e.target.value }; updateSheet({ weapons: next }); }} placeholder="Оружие" />
                    <input type="text" className="cs-input" value={w.damage} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), damage: e.target.value }; updateSheet({ weapons: next }); }} placeholder="1к8" />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, cursor: 'pointer' }}><input type="checkbox" checked={w.proficient ?? false} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), proficient: e.target.checked }; updateSheet({ weapons: next }); }} />Влад.</label>
                    <select className="cs-select" value={w.ability ?? 'strength'} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), ability: e.target.value as AbilityKey }; updateSheet({ weapons: next }); }} style={{ width: 56 }}>{ABILITY_KEYS.map((key) => (<option key={key} value={key}>{ABILITY_LABELS[key]}</option>))}</select>
                    <select className="cs-select" value={w.damageType ?? ''} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), damageType: (e.target.value || undefined) as WeaponDamageType | undefined }; updateSheet({ weapons: next }); }} style={{ width: 72 }}><option value="">— тип</option>{WEAPON_DAMAGE_TYPES.map((key) => (<option key={key} value={key}>{WEAPON_DAMAGE_TYPE_LABELS[key]}</option>))}</select>
                    <input type="text" className="cs-input" value={w.attackModifier ?? ''} onChange={(e) => { const next = [...(sheetData.weapons ?? [])]; next[index] = { ...normalizeWeapon(next[index]), attackModifier: e.target.value || undefined }; updateSheet({ weapons: next }); }} placeholder="Бонус" style={{ width: 52 }} />
                    <button type="button" className="cs-btn cs-btn-ghost" onClick={() => updateSheet({ weapons: (sheetData.weapons ?? []).filter((_, i) => i !== index) })} style={{ padding: '2px 6px' }}>×</button>
                  </div>
                </div>
              ))}
              <div className="cs-row" style={{ marginTop: 4 }}>
              <button type="button" className="cs-btn cs-btn-ghost" onClick={() => updateSheet({ weapons: [...(sheetData.weapons ?? []), normalizeWeapon({ name: '', damage: '' })] })}>+ Оружие</button>
              {refOptions.weapons.length > 0 && (<><span style={{ fontSize: 10, color: 'var(--cs-text-muted)' }}>из справ.:</span><select className="cs-select" value={weaponSelectValue} onChange={(e) => { const v = e.target.value; setWeaponSelectValue(v); if (v) { const entry = refOptions.weapons.find((x) => x.name === v); if (entry) addWeaponFromRef(entry); } }} style={{ width: 140 }}><option value="">— выбрать оружие</option>{refOptions.weapons.map((e) => (<option key={e.id} value={e.name}>{e.name}</option>))}</select></>)}
            </div>
            </div>
            <div>
            <h3 className="cs-section-title">Инвентарь</h3>
              {draft.inventory.map((item, index) => (
                <div key={index} className="cs-item-card">
                  <div className="cs-item-row">
                    <input type="text" className="cs-input" value={item.name ?? ''} onChange={(e) => { const next = [...draft.inventory]; next[index] = { ...next[index], name: e.target.value }; setDraft((p) => ({ ...p, inventory: next })); }} placeholder="Название" />
                    <button type="button" className="cs-btn cs-btn-ghost" onClick={() => setDraft((p) => ({ ...p, inventory: p.inventory.filter((_, i) => i !== index) }))} style={{ padding: '2px 6px' }}>×</button>
                  </div>
                  <textarea className="cs-textarea cs-textarea-xs" value={item.description ?? ''} onChange={(e) => { const next = [...draft.inventory]; next[index] = { ...next[index], description: e.target.value }; setDraft((p) => ({ ...p, inventory: next })); }} placeholder="Описание" rows={1} style={{ marginTop: 4 }} />
                </div>
              ))}
              <div className="cs-row" style={{ marginTop: 4 }}>
              <button type="button" className="cs-btn cs-btn-ghost" onClick={() => setDraft((p) => ({ ...p, inventory: [...p.inventory, { name: '', description: '' }] }))}>+ Предмет</button>
              {refOptions.items.length > 0 && (<><span style={{ fontSize: 10, color: 'var(--cs-text-muted)' }}>из справ.:</span><select className="cs-select" value={itemSelectValue} onChange={(e) => { const v = e.target.value; setItemSelectValue(v); if (v) { const entry = refOptions.items.find((x) => x.name === v); if (entry) addItemFromRef(entry); } }} style={{ width: 140 }}><option value="">— выбрать предмет</option>{refOptions.items.map((e) => (<option key={e.id} value={e.name}>{e.name}</option>))}</select></>)}
            </div>
            </div>
          </div>

          <div className="cs-col">
            <div><label className="cs-label">Черты характера</label><textarea className="cs-textarea cs-textarea-xs" value={sheetData.traits ?? ''} onChange={(e) => updateSheet({ traits: e.target.value })} rows={2} /></div>
            <div><label className="cs-label">Идеалы</label><textarea className="cs-textarea cs-textarea-xs" value={sheetData.ideals ?? ''} onChange={(e) => updateSheet({ ideals: e.target.value })} rows={2} /></div>
            <div><label className="cs-label">Привязанности</label><textarea className="cs-textarea cs-textarea-xs" value={sheetData.bonds ?? ''} onChange={(e) => updateSheet({ bonds: e.target.value })} rows={2} /></div>
            <div><label className="cs-label">Слабости</label><textarea className="cs-textarea cs-textarea-xs" value={sheetData.flaws ?? ''} onChange={(e) => updateSheet({ flaws: e.target.value })} rows={2} /></div>
            <div><label className="cs-label">Умения и особенности</label><textarea className="cs-textarea cs-textarea-sm" value={sheetData.featuresTraits ?? ''} onChange={(e) => updateSheet({ featuresTraits: e.target.value })} rows={4} /></div>
          </div>
        </div>
      </form>
    </div>
  );
};
