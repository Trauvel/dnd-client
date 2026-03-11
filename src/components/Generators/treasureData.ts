const COINS = ['мм', 'см', 'зм', 'зм', 'зм', 'пм']; // медь, серебро, золото, платина
const COIN_NAMES: Record<string, string> = { мм: 'медные', см: 'серебряные', зм: 'золотые', пм: 'платиновые' };
const GEMS = ['рубин', 'сапфир', 'изумруд', 'топаз', 'аметист', 'жемчуг', 'яшма', 'оникс', 'бирюза'];
const ITEMS = ['кольцо', 'подвеска', 'браслет', 'кубок', 'статуэтка', 'печать', 'кинжал с рукоятью', 'карта'];
const MAGIC_HINTS = ['светится в темноте', 'тёплый на ощупь', 'тихо звенит', 'необычный узор', 'древние runes'];

export interface TreasureItem {
  type: 'coins' | 'gem' | 'item' | 'magic' | 'ref';
  description: string;
  value?: string;
}

function d(n: number, sides: number): number {
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * sides) + 1;
  return s;
}

export function generateTreasure(level: 'low' | 'mid' | 'high'): TreasureItem[] {
  const result: TreasureItem[] = [];
  const count = level === 'low' ? d(1, 3) : level === 'mid' ? d(1, 4) + 1 : d(2, 4) + 2;
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    if (r < 0.4) {
      const coin = COINS[Math.floor(Math.random() * COINS.length)];
      const amount = coin === 'мм' ? d(2, 6) * 10 : coin === 'см' ? d(2, 6) * 5 : d(1, 4) * 10;
      result.push({ type: 'coins', description: `${COIN_NAMES[coin]} монеты`, value: `${amount} ${coin}` });
    } else if (r < 0.7) {
      const gem = GEMS[Math.floor(Math.random() * GEMS.length)];
      result.push({ type: 'gem', description: `Драгоценный камень: ${gem}` });
    } else if (r < 0.9) {
      const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
      const material = ['серебро', 'золото', 'бронза', 'слоновая кость'][Math.floor(Math.random() * 4)];
      result.push({ type: 'item', description: `${material} ${item}` });
    } else {
      const hint = MAGIC_HINTS[Math.floor(Math.random() * MAGIC_HINTS.length)];
      result.push({ type: 'magic', description: `Предмет (${hint})` });
    }
  }
  return result;
}

/** Сокровища из записей справочника */
export function generateTreasureFromEntries(
  entries: Array<{ name: string; data: Record<string, unknown> }>,
  level: 'low' | 'mid' | 'high'
): TreasureItem[] {
  if (entries.length === 0) return [];
  const count = level === 'low' ? d(1, 3) : level === 'mid' ? d(1, 4) + 1 : d(2, 4) + 2;
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, entries.length));
  return selected.map((entry) => {
    const value = entry.data?.value ?? entry.data?.цена ?? entry.data?.стоимость;
    const valueStr = typeof value === 'number' ? `${value} зм` : typeof value === 'string' ? value : undefined;
    return {
      type: 'ref',
      description: entry.name,
      value: valueStr,
    };
  });
}
