/**
 * Валидаторы и нормализаторы полей карточки персонажа.
 * Используются для единообразного хранения числовых значений и будущей автоматизации игры.
 */

const HEIGHT_CM_MIN = 50;
const HEIGHT_CM_MAX = 300;
const WEIGHT_KG_MIN = 20;
const WEIGHT_KG_MAX = 500;

/** Извлекает число из строки (например "185 см" → 185, "55 кг" → 55) */
function parseNumericFromString(s: string | null | undefined): number | null {
  if (s == null || s === '') return null;
  const trimmed = String(s).trim();
  if (!trimmed) return null;
  const num = parseInt(trimmed.replace(/\D.*$/, '').replace(/\s/g, ''), 10);
  return Number.isNaN(num) ? null : num;
}

/**
 * Рост в см. Парсит строку в число (например "185 см" → 185). Без ограничения по диапазону.
 */
export function parseHeight(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : Math.round(value);
  const n = parseNumericFromString(value);
  return n == null ? null : n;
}

/**
 * Вес в кг. Парсит строку в число. Без ограничения по диапазону.
 */
export function parseWeight(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : Math.round(value);
  const n = parseNumericFromString(value);
  return n == null ? null : n;
}

/** Для отправки на API: число/строка → строка (только цифра), с ограничением диапазона */
export function heightToApi(value: number | string | null | undefined): string | undefined {
  const n = parseHeight(value);
  if (n == null) return undefined;
  const clamped = Math.max(HEIGHT_CM_MIN, Math.min(HEIGHT_CM_MAX, n));
  return String(clamped);
}

export function weightToApi(value: number | string | null | undefined): string | undefined {
  const n = parseWeight(value);
  if (n == null) return undefined;
  const clamped = Math.max(WEIGHT_KG_MIN, Math.min(WEIGHT_KG_MAX, n));
  return String(clamped);
}

export const HEIGHT_CM = { min: HEIGHT_CM_MIN, max: HEIGHT_CM_MAX };
export const WEIGHT_KG = { min: WEIGHT_KG_MIN, max: WEIGHT_KG_MAX };
