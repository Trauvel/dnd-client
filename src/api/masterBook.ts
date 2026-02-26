import { API_CONFIG } from '../config';
import { getAuthHeader } from '../utils/auth';

export interface MasterBookSection {
  id: string;
  title: string;
  body: string;
  children?: MasterBookSection[];
}

export interface MasterBookData {
  sections: MasterBookSection[];
}

/** Нормализовать дерево: у каждой секции есть массив children */
export function normalizeSections(sections: MasterBookSection[]): MasterBookSection[] {
  return (sections || []).map((s) => ({
    ...s,
    children: normalizeSections(s.children ?? []),
  }));
}

/** Найти секцию в дереве по id */
export function findSectionById(sections: MasterBookSection[], id: string): MasterBookSection | null {
  for (const s of sections) {
    if (s.id === id) return s;
    const inChild = findSectionById(s.children ?? [], id);
    if (inChild) return inChild;
  }
  return null;
}

/** Убрать HTML-теги из строки для поиска по тексту */
export function stripHtml(html: string): string {
  if (typeof html !== 'string') return '';
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (div) {
    div.innerHTML = html;
    return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
  }
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Текст раздела для поиска: заголовок + содержимое без HTML */
function getSectionSearchText(section: MasterBookSection): string {
  const title = (section.title || '').trim();
  const body = stripHtml(section.body || '');
  return `${title} ${body}`.toLowerCase();
}

/** Проверяет, совпадает ли раздел с поисковым запросом (все слова из запроса должны встречаться, порядок любой) */
export function sectionMatchesSearch(section: MasterBookSection, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = getSectionSearchText(section);
  return words.every((word) => text.includes(word));
}

/** Раздел или любой из потомков совпадает с запросом */
export function sectionOrDescendantMatches(section: MasterBookSection, query: string): boolean {
  if (sectionMatchesSearch(section, query)) return true;
  for (const ch of section.children ?? []) {
    if (sectionOrDescendantMatches(ch, query)) return true;
  }
  return false;
}

/** Сегменты строки для подсветки: массив { type: 'text'|'match', value } */
export function getHighlightSegments(text: string, query: string): Array<{ type: 'text' | 'match'; value: string }> {
  const q = query.trim();
  if (!q || !text) return [{ type: 'text' as const, value: text }];
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [{ type: 'text' as const, value: text }];
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(re);
  return parts.map((p, i) => ({ type: i % 2 === 1 ? ('match' as const) : ('text' as const), value: p }));
}

/** Все секции дерева в плоский список (для совместимости) */
export function flattenSections(sections: MasterBookSection[]): MasterBookSection[] {
  const out: MasterBookSection[] = [];
  for (const s of sections) {
    out.push(s);
    out.push(...flattenSections(s.children ?? []));
  }
  return out;
}

/** Обновить секцию в дереве по id (иммутабельно) */
export function updateSectionInTree(
  sections: MasterBookSection[],
  id: string,
  patch: Partial<Pick<MasterBookSection, 'title' | 'body'>>
): MasterBookSection[] {
  return sections.map((s) => {
    if (s.id === id) return { ...s, ...patch };
    return { ...s, children: updateSectionInTree(s.children ?? [], id, patch) };
  });
}

/** Удалить секцию и всех потомков из дерева */
export function removeSectionFromTree(sections: MasterBookSection[], id: string): MasterBookSection[] {
  return sections
    .filter((s) => s.id !== id)
    .map((s) => ({ ...s, children: removeSectionFromTree(s.children ?? [], id) }));
}

/** Добавить секцию в корень или в детей родителя */
export function addSectionInTree(
  sections: MasterBookSection[],
  newSection: MasterBookSection,
  parentId?: string | null
): MasterBookSection[] {
  if (!parentId) return [...sections, newSection];
  return sections.map((s) => {
    if (s.id !== parentId) return { ...s, children: addSectionInTree(s.children ?? [], newSection, parentId) };
    return { ...s, children: [...(s.children ?? []), newSection] };
  });
}

/** Список id секции и всех её потомков (для запрета переноса в себя/потомка) */
export function getSectionAndDescendantIds(section: MasterBookSection): string[] {
  const ids = [section.id];
  for (const ch of section.children ?? []) ids.push(...getSectionAndDescendantIds(ch));
  return ids;
}

/** Контекст секции среди соседей: массив соседей и индекс в нём */
export function getSiblingContext(
  sections: MasterBookSection[],
  sectionId: string,
  parentId: string | null = null
): { siblings: MasterBookSection[]; index: number; parentId: string | null } | null {
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].id === sectionId) return { siblings: sections, index: i, parentId };
    const inChild = getSiblingContext(sections[i].children ?? [], sectionId, sections[i].id);
    if (inChild) return inChild;
  }
  return null;
}

/** Удалить секцию из дерева и вернуть новое дерево + извлечённая секция */
function extractSectionFromTree(
  sections: MasterBookSection[],
  id: string
): { sections: MasterBookSection[]; extracted: MasterBookSection | null } {
  let extracted: MasterBookSection | null = null;
  const newSections = sections
    .filter((s) => {
      if (s.id === id) {
        extracted = s;
        return false;
      }
      return true;
    })
    .map((s) => {
      const { sections: newChildren, extracted: fromChild } = extractSectionFromTree(s.children ?? [], id);
      if (fromChild) extracted = fromChild;
      return { ...s, children: newChildren };
    });
  return { sections: newSections, extracted };
}

/** Вставить секцию в дерево: в корень на index или в детей parentId на index */
export function insertSectionInTree(
  sections: MasterBookSection[],
  section: MasterBookSection,
  parentId: string | null,
  index: number
): MasterBookSection[] {
  if (parentId === null) {
    const copy = [...sections];
    copy.splice(Math.max(0, Math.min(index, copy.length)), 0, section);
    return copy;
  }
  return sections.map((s) => {
    if (s.id !== parentId) return { ...s, children: insertSectionInTree(s.children ?? [], section, parentId, index) };
    const children = [...(s.children ?? [])];
    children.splice(Math.max(0, Math.min(index, children.length)), 0, section);
    return { ...s, children };
  });
}

/** Переместить секцию в новый родитель и позицию. Нельзя переносить в себя или в потомка. */
export function moveSectionInTree(
  sections: MasterBookSection[],
  sectionId: string,
  newParentId: string | null,
  newIndex: number
): MasterBookSection[] {
  const section = findSectionById(sections, sectionId);
  if (!section) return sections;
  const forbiddenIds = new Set(getSectionAndDescendantIds(section));
  if (newParentId !== null && forbiddenIds.has(newParentId)) return sections;

  const { sections: without, extracted } = extractSectionFromTree(sections, sectionId);
  if (!extracted) return sections;
  return insertSectionInTree(without, extracted, newParentId, newIndex);
}

/** Поднять/опустить секцию среди соседей (сдвиг на одну позицию) */
export function reorderSectionInTree(
  sections: MasterBookSection[],
  sectionId: string,
  direction: 'up' | 'down'
): MasterBookSection[] {
  const ctx = getSiblingContext(sections, sectionId);
  if (!ctx || ctx.siblings.length <= 1) return sections;
  const newIndex = direction === 'up' ? Math.max(0, ctx.index - 1) : Math.min(ctx.siblings.length - 1, ctx.index + 1);
  if (newIndex === ctx.index) return sections;
  return moveSectionInTree(sections, sectionId, ctx.parentId, newIndex);
}

export async function getMasterBook(): Promise<MasterBookData> {
  const response = await fetch(`${API_CONFIG.WEBSITE_API_URL}/api/master-book`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка загрузки книги мастера');
  }
  const data = await response.json();
  const raw = Array.isArray(data.sections) ? data.sections : [];
  return { sections: normalizeSections(raw) };
}

export async function updateMasterBook(data: MasterBookData): Promise<MasterBookData> {
  const response = await fetch(`${API_CONFIG.WEBSITE_API_URL}/api/master-book`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка сохранения книги мастера');
  }
  const result = await response.json();
  const raw = Array.isArray(result.sections) ? result.sections : [];
  return { sections: normalizeSections(raw) };
}
