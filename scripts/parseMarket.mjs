/**
 * Парсит папку market/*.md и генерирует marketData.generated.ts для генератора торговца.
 * Запуск: node scripts/parseMarket.mjs (из корня dnd-client; папка market — ../market)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKET_DIR = path.resolve(__dirname, '../../market');
const OUT_FILE = path.resolve(__dirname, '../src/components/Generators/marketData.generated.ts');

const QUALITIES = ['Ужасный', 'Плохой', 'Средний', 'Хороший', 'Прекрасный'];

const FILE_TO_CATEGORY = {
  'Алкоголь и напитки': 'Напитки',
  'Воровские приспособления': 'Вор',
  'Доспехи и щиты': 'Бронник',
  'Еда и животные продукты': 'Еда',
  'Животные': 'Животные',
  'Зелья, яды и травы': 'Зелья',
  'Изделия из кожи': 'Кожа',
  'Инструменты рабочие': 'Инструменты',
  'Книги заклинаний и свитки': 'Свитки',
  'Книги и карты': 'Книги',
  'Коробейник': 'Коробейник',
  'Мебель и Интерьер': 'Мебель',
  'Механизмы': 'Механизмы',
  'Музыкальные товары': 'Музыка',
  'Одежда и мода': 'Мода',
  'Оружие': 'Оружие',
  'Религиозные товары': 'Религия',
  'Транспорт и перевозки': 'Транспорт',
  'Цветы и семена': 'Цветы',
  'Ювелирные изделия': 'Ювелир',
  'Редкий Астральный путешественник': 'Астрал',
  'Редкий Волшебные существа': 'Волшебные_существа',
  'Редкий Магические предметы': 'Магия',
  'Редкий Некромантия': 'Некромантия',
  'Редкий Предложения фей': 'Феи',
  'Редкий Сделка с дьяволом': 'Дьявол',
  'Редкий Товары будущего': 'Попаданец',
  'Редкий Чары': 'Чары',
};

function parsePrice(str) {
  if (!str || typeof str !== 'string') return { copper: 10, text: str || '' };
  const t = str.trim().replace(/cм/g, 'см').split(/[/]/)[0].trim();
  const multMap = { мм: 1, см: 10, зм: 100, пм: 1000 };
  const range = t.match(/^(\d+)\s*-\s*(\d+)\s*([а-яёa-z]+)/i);
  if (range) {
    const [, a, b, u] = range;
    const avg = Math.floor((parseInt(a, 10) + parseInt(b, 10)) / 2);
    const uKey = (u || '').toLowerCase().replace(/\s/g, '');
    const mult = multMap[uKey] ?? multMap['см'] ?? 10;
    return { copper: avg * mult, text: str.trim() };
  }
  const single = t.match(/^(\d+)\s*([а-яёa-z]+)/i);
  if (single) {
    const [, n, u] = single;
    const uKey = (u || '').toLowerCase().replace(/\s/g, '');
    const mult = multMap[uKey] ?? multMap['см'] ?? 10;
    return { copper: parseInt(n, 10) * mult, text: str.trim() };
  }
  const num = parseInt(t.replace(/\D/g, ''), 10);
  return { copper: Number.isNaN(num) ? 10 : num * 10, text: str.trim() };
}

function parseItemLine(line) {
  const m = line.match(/\*\/\s*(.+?)\s*\/\*\s*(.*)/s);
  if (!m) return null;
  const [, name, rest] = m;
  const nameClean = name.trim();
  const priceMatch = rest.match(/Цена:\s*([^ВП]*?)(?=\s*В наличии:|\s*Примечание:|$)/i);
  const stockMatch = rest.match(/В наличии:\s*([^П]*?)(?=\s*Примечание:|$)/i);
  const noteMatch = rest.match(/Примечание:\s*([\s\S]*?)(?=\s*\*\/|$)/i);
  const priceStr = priceMatch ? priceMatch[1].trim() : '';
  const { copper, text: priceText } = parsePrice(priceStr);
  const qtyStr = stockMatch ? stockMatch[1].trim() : '';
  const note = noteMatch ? noteMatch[1].trim().replace(/\s+/g, ' ').slice(0, 200) : '';
  return {
    name: nameClean,
    priceCopper: copper,
    priceText: priceText || `${copper} мм`,
    qty: qtyStr || '',
    note,
  };
}

function parseFile(content) {
  const result = {};
  QUALITIES.forEach((q) => (result[q] = []));
  const blocks = content.split(/(?=Уровень торговца\s*:?\s*\n)/i);
  for (const block of blocks) {
    const qualityMatch = block.match(/(Ужасный|Плохой|Средний|Хороший|Прекрасный)/);
    const quality = qualityMatch ? qualityMatch[1] : null;
    if (!quality || !QUALITIES.includes(quality)) continue;
    const lines = block.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const item = parseItemLine(lines[i]);
      if (item && item.name) result[quality].push(item);
    }
  }
  return result;
}

function main() {
  if (!fs.existsSync(MARKET_DIR)) {
    console.error('Папка market не найдена:', MARKET_DIR);
    process.exit(1);
  }
  const files = fs.readdirSync(MARKET_DIR).filter((f) => f.endsWith('.md'));
  const data = {};

  for (const file of files) {
    const baseName = path.basename(file, '.md');
    const category = FILE_TO_CATEGORY[baseName];
    if (!category) {
      console.warn('Неизвестная категория для файла:', file);
      continue;
    }
    const content = fs.readFileSync(path.join(MARKET_DIR, file), 'utf-8');
    data[category] = parseFile(content);
  }

  const lines = [
    '// Автогенерация из market/*.md. Не редактировать вручную. Запуск: node scripts/parseMarket.mjs',
    '',
    'export interface MarketItem { name: string; priceCopper: number; priceText: string; qty: string; note: string; }',
    '',
    'export type MarketQuality = \'Ужасный\' | \'Плохой\' | \'Средний\' | \'Хороший\' | \'Прекрасный\';',
    '',
    'export const MARKET_DATA: Record<string, Record<MarketQuality, MarketItem[]>> = {',
  ];

  for (const [cat, qualities] of Object.entries(data)) {
    lines.push(`  ${JSON.stringify(cat)}: {`);
    for (const q of QUALITIES) {
      const items = qualities[q] || [];
      const itemsStr = items.map((it) => `{ name: ${JSON.stringify(it.name)}, priceCopper: ${it.priceCopper}, priceText: ${JSON.stringify(it.priceText)}, qty: ${JSON.stringify(it.qty)}, note: ${JSON.stringify(it.note)} }`).join(', ');
      lines.push(`    ${JSON.stringify(q)}: [ ${itemsStr} ],`);
    }
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');

  fs.writeFileSync(OUT_FILE, lines.join('\n'), 'utf-8');
  console.log('Записано:', OUT_FILE);
}

main();
