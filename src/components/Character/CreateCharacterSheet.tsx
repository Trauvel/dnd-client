import React, { useState } from 'react';
import { createCharacter, updateCharacter, type Character, type InventoryItem } from '../../api/characters';
import { xpToLevel, getProficiencyBonus } from '../../utils/dndLevel';
import {
  type CharacterSheetData,
  DEFAULT_SHEET_DATA,
  DND_SKILLS,
  type AbilityKey,
} from '../../types/characterSheet';
import '../../pages/PlayerPage.css';

export interface CreateDraft {
  characterName: string;
  class: string;
  race: string;
  backstory: string;
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
  race: '',
  backstory: '',
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

  const sheetData = draft.characterData;
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
        race: draft.race || undefined,
        backstory: draft.backstory || undefined,
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
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          <div><label style={labelStyle}>Имя персонажа</label><br />{input('text', draft.characterName, (v) => setDraft((p) => ({ ...p, characterName: String(v) })), { placeholder: 'Обязательно' })}</div>
          <div><label style={labelStyle}>Класс и уровень</label><br /><span style={{ display: 'flex', gap: 4 }}>{input('text', draft.class, (v) => setDraft((p) => ({ ...p, ['class']: String(v) })))}<span style={{ ...sheetStyle, width: 40, textAlign: 'center', lineHeight: '28px' }}>{level}</span></span></div>
          <div><label style={labelStyle}>Предистория</label><br />{input('text', draft.backstory, (v) => setDraft((p) => ({ ...p, backstory: String(v) }))}</div>
          <div><label style={labelStyle}>Имя игрока</label><br /><input type="text" placeholder="—" readOnly style={{ ...sheetStyle, background: '#f5f5f5' }} /></div>
          <div><label style={labelStyle}>Раса</label><br />{input('text', draft.race, (v) => setDraft((p) => ({ ...p, race: String(v) }))}</div>
          <div><label style={labelStyle}>Мировоззрение</label><br /><input type="text" value={sheetData.alignment ?? ''} onChange={(e) => updateSheet({ alignment: e.target.value })} style={sheetStyle} /></div>
          <div><label style={labelStyle}>Опыт</label><br />{input('number', draft.experience, (v) => setDraft((p) => ({ ...p, experience: typeof v === 'number' ? v : 0 })), { min: 0 })}</div>
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
            <div><label style={labelStyle}>Прочие владения и языки</label><textarea value={sheetData.proficienciesAndLanguages ?? ''} onChange={(e) => updateSheet({ proficienciesAndLanguages: e.target.value })} rows={4} style={{ ...sheetStyle, resize: 'vertical' }} /></div>
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
              <div><label style={labelStyle}>Кость хитов (итого)</label><input type="text" value={sheetData.hitDiceTotal ?? ''} onChange={(e) => updateSheet({ hitDiceTotal: e.target.value })} placeholder="1d8" style={sheetStyle} /></div>
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
                </tbody>
              </table>
            </div>
            <div><label style={labelStyle}>Валюта (ММ, СМ, ЗМ, ПМ, МД)</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(['copper', 'silver', 'electrum', 'gold', 'platinum'] as const).map((c) => (
                  <input key={c} type="number" min={0} value={sheetData.currency?.[c] ?? 0} onChange={(e) => updateSheet({ currency: { ...(sheetData.currency ?? {}), [c]: parseInt(e.target.value, 10) || 0 } })} style={{ ...sheetStyle, width: 52 }} />
                ))}
              </div>
            </div>
            <div><label style={labelStyle}>Снаряжение</label><textarea value={sheetData.equipment ?? ''} onChange={(e) => updateSheet({ equipment: e.target.value })} rows={6} style={{ ...sheetStyle, resize: 'vertical' }} /></div>
            <div><h3 style={{ margin: '8px 0 4px', fontSize: 12 }}>Инвентарь</h3>
              {draft.inventory.map((item, index) => (
                <div key={index} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  <input type="text" value={item.name ?? ''} onChange={(e) => { const next = [...draft.inventory]; next[index] = { ...next[index], name: e.target.value }; setDraft((p) => ({ ...p, inventory: next })); }} placeholder="Название" style={sheetStyle} />
                  <button type="button" onClick={() => setDraft((p) => ({ ...p, inventory: p.inventory.filter((_, i) => i !== index) }))}>×</button>
                </div>
              ))}
              <button type="button" onClick={() => setDraft((p) => ({ ...p, inventory: [...p.inventory, { name: '', description: '' }] }))}>+ Предмет</button>
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
