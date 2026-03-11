import { API_CONFIG } from '../config';
import { getAuthHeader } from '../utils/auth';

export type FieldType = 'string' | 'number' | 'text' | 'reference' | 'reference-multiple' | 'ability-bonus-list';

export const ABILITY_BONUS_KEYS = [
  { value: 'strength', label: 'Сила' },
  { value: 'dexterity', label: 'Ловкость' },
  { value: 'constitution', label: 'Телосложение' },
  { value: 'intelligence', label: 'Интеллект' },
  { value: 'wisdom', label: 'Мудрость' },
  { value: 'charisma', label: 'Харизма' },
] as const;

export type AbilityBonusItem = { ability_key: string; bonus: number };

export interface ReferenceField {
  id: string;
  key: string;
  name: string;
  fieldType: FieldType;
  targetBookId: string | null;
  order: number;
  required: boolean;
}

export interface ReferenceBook {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  order: number;
  parentBookIds: string[];
  fields: ReferenceField[];
  entriesCount?: number;
}

export interface ReferenceEntry {
  id: string;
  referenceBookId: string;
  name: string;
  data: Record<string, unknown>;
  order: number;
}

function buildRefBooksUrl(path: string): string {
  const base = (API_CONFIG.WEBSITE_API_URL || '').replace(/\/$/, '');
  return `${base}/api/reference-books${path}`;
}

async function refBooksFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...init?.headers },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('Load failed')) {
      throw new Error(`Не удалось подключиться к серверу (${url}). Проверьте, что website-api запущен и VITE_WEBSITE_API_URL указан верно.`);
    }
    throw e;
  }
}

async function parseJsonResponse<T>(res: Response, url: string): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (trimmed.startsWith('<')) {
    throw new Error(`Сервер вернул HTML вместо JSON (${url}). Проверьте VITE_WEBSITE_API_URL — возможно, указан адрес приложения, а не API.`);
  }
  try {
    return (trimmed ? JSON.parse(text) : {}) as T;
  } catch {
    throw new Error(`Неверный ответ сервера (${url}). Ожидался JSON.`);
  }
}

export async function getReferenceBooks(): Promise<ReferenceBook[]> {
  const url = buildRefBooksUrl('');
  const res = await refBooksFetch(url);
  const data = await parseJsonResponse<{ books?: ReferenceBook[]; error?: string }>(res, url);
  if (!res.ok) throw new Error(data.error || 'Ошибка загрузки справочников');
  return data.books ?? [];
}

export async function getReferenceBook(id: string): Promise<ReferenceBook | null> {
  const url = buildRefBooksUrl(`/${id}`);
  const res = await refBooksFetch(url);
  const data = await parseJsonResponse<ReferenceBook | { error?: string }>(res, url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Ошибка загрузки справочника');
  return data as ReferenceBook;
}

/** Загрузить записи справочника по slug (для селектов в форме персонажа) */
export async function getReferenceEntriesBySlug(slug: string): Promise<ReferenceEntry[]> {
  const books = await getReferenceBooks();
  const book = books.find((b) => b.slug === slug);
  if (!book?.id) return [];
  return getReferenceEntries(book.id);
}

export async function createReferenceBook(data: {
  name: string;
  slug?: string;
  description?: string;
  order?: number;
}): Promise<ReferenceBook> {
  const res = await refBooksFetch(buildRefBooksUrl(''), { method: 'POST', body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка создания справочника');
  return res.json();
}

export async function updateReferenceBook(
  id: string,
  data: Partial<{ name: string; slug: string; description: string; order: number; parentBookIds: string[] }>
): Promise<ReferenceBook> {
  const res = await refBooksFetch(buildRefBooksUrl(`/${id}`), { method: 'PUT', body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка обновления справочника');
  return res.json();
}

export async function deleteReferenceBook(id: string): Promise<void> {
  const res = await refBooksFetch(buildRefBooksUrl(`/${id}`), { method: 'DELETE' });
  if (!res.ok && res.status !== 204)
    throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка удаления справочника');
}

export async function addReferenceField(
  bookId: string,
  data: {
    key: string;
    name: string;
    fieldType: FieldType;
    targetBookId?: string;
    order?: number;
    required?: boolean;
  }
): Promise<ReferenceField> {
  const res = await refBooksFetch(buildRefBooksUrl(`/${bookId}/fields`), { method: 'POST', body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка добавления поля');
  return res.json();
}

export async function updateReferenceField(
  bookId: string,
  fieldId: string,
  data: Partial<ReferenceField>
): Promise<ReferenceField> {
  const res = await refBooksFetch(buildRefBooksUrl(`/${bookId}/fields/${fieldId}`), { method: 'PUT', body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка обновления поля');
  return res.json();
}

export async function deleteReferenceField(bookId: string, fieldId: string): Promise<void> {
  const res = await refBooksFetch(buildRefBooksUrl(`/${bookId}/fields/${fieldId}`), { method: 'DELETE' });
  if (!res.ok && res.status !== 204)
    throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка удаления поля');
}

const PAGE_SIZE = 50;

export async function getReferenceEntries(bookId: string): Promise<ReferenceEntry[]> {
  const res = await refBooksFetch(buildRefBooksUrl(`/${bookId}/entries`));
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка загрузки записей');
  const { entries } = await res.json();
  return entries;
}

export interface ReferenceEntriesPageResult {
  entries: ReferenceEntry[];
  total: number;
}

export async function getReferenceEntriesPage(
  bookId: string,
  opts: { limit?: number; offset?: number; search?: string; ensureIds?: string[] }
): Promise<ReferenceEntriesPageResult> {
  const params = new URLSearchParams();
  params.set('limit', String(opts.limit ?? PAGE_SIZE));
  params.set('offset', String(opts.offset ?? 0));
  if (opts.search != null && opts.search !== '') params.set('search', opts.search);
  if (opts.ensureIds?.length) params.set('ensureIds', opts.ensureIds.join(','));
  const url = `${buildRefBooksUrl(`/${bookId}/entries`)}?${params.toString()}`;
  const res = await refBooksFetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка загрузки записей');
  return res.json();
}

export async function getReferenceEntry(bookId: string, entryId: string): Promise<ReferenceEntry | null> {
  const res = await refBooksFetch(buildRefBooksUrl(`/${bookId}/entries/${entryId}`));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка загрузки записи');
  return res.json();
}

export async function createReferenceEntry(
  bookId: string,
  data: { name: string; data?: Record<string, unknown>; order?: number }
): Promise<ReferenceEntry> {
  const res = await refBooksFetch(buildRefBooksUrl(`/${bookId}/entries`), { method: 'POST', body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка создания записи');
  return res.json();
}

export async function updateReferenceEntry(
  bookId: string,
  entryId: string,
  data: Partial<{ name: string; data: Record<string, unknown>; order: number }>
): Promise<ReferenceEntry> {
  const res = await refBooksFetch(buildRefBooksUrl(`/${bookId}/entries/${entryId}`), { method: 'PUT', body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка обновления записи');
  return res.json();
}

export async function deleteReferenceEntry(bookId: string, entryId: string): Promise<void> {
  const res = await refBooksFetch(buildRefBooksUrl(`/${bookId}/entries/${entryId}`), { method: 'DELETE' });
  if (!res.ok && res.status !== 204)
    throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка удаления записи');
}
