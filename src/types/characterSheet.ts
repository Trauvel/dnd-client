/** Расширенные данные листа персонажа D&D 5e (хранятся в characterData) */
export interface CharacterSheetData {
  inspiration?: boolean;
  tempHp?: number;
  deathSaveSuccesses?: number;
  deathSaveFailures?: number;
  hitDiceTotal?: string;
  hitDiceUsed?: number;
  alignment?: string;
  savingThrowProficiencies?: string[];
  skillProficiencies?: string[];
  passivePerception?: number;
  proficienciesAndLanguages?: string;
  attacks?: { name: string; attackBonus: string; damageType: string }[];
  currency?: { copper?: number; silver?: number; electrum?: number; gold?: number; platinum?: number };
  traits?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
  featuresTraits?: string;
  equipment?: string;
  /** Список оружий: название, кубики урона (1d8, 2d6), владение, характеристика для броска */
  weapons?: {
    name: string;
    /** Формула кубиков урона (игрок вводит сам), напр. 1d8, 2d6 */
    damage: string;
    /** Бонус атаки вручную (если пусто — считается по характеристике + владение) */
    attackModifier?: string;
    /** Владение оружием — добавляет бонус мастерства к атаке */
    proficient?: boolean;
    /** По какой характеристике считать атаку и урон: Сил, Лов и т.д. */
    ability?: AbilityKey;
  }[];
}

export const ABILITY_KEYS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;
export type AbilityKey = (typeof ABILITY_KEYS)[number];

/** Короткие подписи характеристик для UI */
export const ABILITY_LABELS: Record<AbilityKey, string> = {
  strength: 'Сил',
  dexterity: 'Лов',
  constitution: 'Тел',
  intelligence: 'Инт',
  wisdom: 'Мдр',
  charisma: 'Хар',
};

/** Навыки D&D 5e: название и ключ характеристики */
export const DND_SKILLS: { key: string; name: string; ability: AbilityKey }[] = [
  { key: 'acrobatics', name: 'Акробатика (Лов)', ability: 'dexterity' },
  { key: 'investigation', name: 'Анализ (Инт)', ability: 'intelligence' },
  { key: 'athletics', name: 'Атлетика (Сил)', ability: 'strength' },
  { key: 'perception', name: 'Внимательность (Мдр)', ability: 'wisdom' },
  { key: 'survival', name: 'Выживание (Мдр)', ability: 'wisdom' },
  { key: 'performance', name: 'Выступление (Хар)', ability: 'charisma' },
  { key: 'intimidation', name: 'Запугивание (Хар)', ability: 'charisma' },
  { key: 'history', name: 'История (Инт)', ability: 'intelligence' },
  { key: 'sleightOfHand', name: 'Ловкость рук (Лов)', ability: 'dexterity' },
  { key: 'arcana', name: 'Магия (Инт)', ability: 'intelligence' },
  { key: 'medicine', name: 'Медицина (Мдр)', ability: 'wisdom' },
  { key: 'deception', name: 'Обман (Хар)', ability: 'charisma' },
  { key: 'nature', name: 'Природа (Инт)', ability: 'intelligence' },
  { key: 'insight', name: 'Проницательность (Мдр)', ability: 'wisdom' },
  { key: 'religion', name: 'Религия (Инт)', ability: 'intelligence' },
  { key: 'stealth', name: 'Скрытность (Лов)', ability: 'dexterity' },
  { key: 'persuasion', name: 'Убеждение (Хар)', ability: 'charisma' },
  { key: 'animalHandling', name: 'Уход за животными (Мдр)', ability: 'wisdom' },
];

export const DEFAULT_SHEET_DATA: CharacterSheetData = {
  inspiration: false,
  tempHp: 0,
  deathSaveSuccesses: 0,
  deathSaveFailures: 0,
  hitDiceTotal: '',
  hitDiceUsed: 0,
  alignment: '',
  savingThrowProficiencies: [],
  skillProficiencies: [],
  passivePerception: 10,
  proficienciesAndLanguages: '',
  attacks: [],
  currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
  traits: '',
  ideals: '',
  bonds: '',
  flaws: '',
  featuresTraits: '',
  equipment: '',
  weapons: [],
};
