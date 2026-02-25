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
