import { API_CONFIG } from '../config';
import { getAuthHeader } from '../utils/auth';

export interface ScenarioFile {
  id: string;
  fileName: string;
  displayName?: string | null;
  mimeType: string;
  kind: 'main' | 'attachment' | 'audio';
  url: string;
}

/** Книга мастера */
export interface ScenarioScriptLocation {
  id: string;
  title: string;
  body: string;
  notes?: string;
  npcIds?: string[];
  order?: number;
  /** id файлов сценария (kind: audio) — аудио для локации (несколько треков) */
  audioIds?: string[];
  /** id вложений сценария (карты/изображения локации) — показываются в игре при выборе локации */
  mapFileIds?: string[];
}

export interface ScenarioScriptSituation {
  id: string;
  title: string;
  body: string;
  /** id локации, к которой привязана ситуация (ветка «если игроки сделали X» в рамках этой локации) */
  locationId?: string | null;
  order?: number;
}

export interface ScenarioScriptBranch {
  id: string;
  fromType: 'location' | 'situation';
  fromId: string;
  toType: 'location' | 'situation';
  toId: string;
  label: string;
}

export interface ScenarioScriptData {
  locations?: ScenarioScriptLocation[];
  situations?: ScenarioScriptSituation[];
  branches?: ScenarioScriptBranch[];
  startLocationId?: string | null;
}

export interface Scenario {
  id: string;
  title: string;
  description?: string | null;
  mainFileUrl?: string | null;
  scriptData?: ScenarioScriptData | null;
  attachments: ScenarioFile[];
  audios: ScenarioFile[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateScenarioRequest {
  title: string;
  description?: string;
}

export function absolutizeUrl(relative?: string | null): string | null | undefined {
  if (!relative) return relative;
  // backend отдаёт путь вида /uploads/..., добавляем базовый URL API
  const base =
    API_CONFIG.WEBSITE_API_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  return base ? `${base.replace(/\/$/, '')}${relative.startsWith('/') ? '' : '/'}${relative}` : relative;
}

function normalizeScenario(raw: any): Scenario {
  const mainFileUrl = absolutizeUrl(raw.mainFileUrl);
  const attachments = (raw.attachments ?? []).map((f: any) => ({
    ...f,
    url: absolutizeUrl(f.url) as string,
  }));
  const audios = (raw.audios ?? []).map((f: any) => ({
    ...f,
    url: absolutizeUrl(f.url) as string,
  }));
  return {
    ...raw,
    mainFileUrl,
    scriptData: raw.scriptData ?? null,
    attachments,
    audios,
  } as Scenario;
}

/** NPC в экспорте: все поля кроме аватарки и scenarioId (id сохраняем для маппинга при импорте). */
export interface ScenarioNpcExportItem {
  id: string;
  name: string;
  type?: string | null;
  npcKinds?: string[] | null;
  armorClass?: number | null;
  armorClassText?: string | null;
  hpAverage?: number | null;
  hpText?: string | null;
  speed?: string | null;
  strength?: number | null;
  dexterity?: number | null;
  constitution?: number | null;
  intelligence?: number | null;
  wisdom?: number | null;
  charisma?: number | null;
  skills?: string | null;
  senses?: string | null;
  languages?: string | null;
  xp?: number | null;
  challenge?: string | null;
  habitat?: string | null;
  traits?: string | null;
  abilities?: string | null;
  actions?: string | null;
  legendaryActions?: string | null;
  description?: string | null;
  notes?: string | null;
}

/** Данные сценария для экспорта в JSON. Изображения и аудио не включаются — добавляются только в редакторе. */
export interface ScenarioExportPayload {
  title: string;
  description?: string | null;
  scriptData?: ScenarioScriptData | null;
  /** Полные данные NPC (без аватарки); id — для маппинга при импорте. */
  npcs?: ScenarioNpcExportItem[];
  exportedAt: string;
}

function stripLocationMedia(scriptData: ScenarioScriptData | null | undefined): ScenarioScriptData | null | undefined {
  if (!scriptData?.locations?.length) return scriptData;
  return {
    ...scriptData,
    locations: scriptData.locations.map(({ audioIds, mapFileIds, ...loc }) => loc),
  };
}

const NPC_EXPORT_KEYS: (keyof ScenarioNpcExportItem)[] = [
  'id', 'name', 'type', 'npcKinds', 'armorClass', 'armorClassText', 'hpAverage', 'hpText',
  'speed', 'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
  'skills', 'senses', 'languages', 'xp', 'challenge', 'habitat', 'traits', 'abilities',
  'actions', 'legendaryActions', 'description', 'notes',
];

function toNpcExportItem(npc: Record<string, unknown>): ScenarioNpcExportItem {
  const out: Record<string, unknown> = {};
  for (const k of NPC_EXPORT_KEYS) {
    if (npc[k] !== undefined && npc[k] !== null) out[k] = npc[k];
  }
  out.id = String(npc.id ?? '');
  out.name = String(npc.name ?? '');
  return out as ScenarioNpcExportItem;
}

export function buildScenarioExportPayload(
  scenario: Scenario,
  npcs?: Array<Record<string, unknown>>
): ScenarioExportPayload {
  return {
    title: scenario.title,
    description: scenario.description ?? null,
    scriptData: stripLocationMedia(scenario.scriptData ?? null),
    npcs: (npcs ?? []).map(toNpcExportItem),
    exportedAt: new Date().toISOString(),
  };
}

/** Скачать сценарий как JSON-файл для обсуждения с GPT */
export function downloadScenarioAsJson(payload: ScenarioExportPayload, filename?: string): void {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename ?? `scenario-${payload.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}-export.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Элемент NPC при импорте: id из файла (для маппинга location.npcIds) + поля для создания. */
export interface ScenarioNpcImportItem extends ScenarioNpcExportItem {}

/** Результат валидации импорта */
export interface ScenarioImportValidation {
  valid: boolean;
  scriptData: ScenarioScriptData;
  /** NPC для создания при импорте (id из файла — подставить в scriptData.locations[].npcIds после создания). */
  npcs?: ScenarioNpcImportItem[];
  title?: string;
  description?: string | null;
  errors: string[];
}

/** Парсинг JSON импорта. Возвращает данные или объект с error. */
export function parseScenarioImportPayload(raw: string): ScenarioExportPayload | { error: string } {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== 'object') {
      return { error: 'JSON должен быть объектом' };
    }
    const obj = data as Record<string, unknown>;
    return {
      title: typeof obj.title === 'string' ? obj.title : 'Без названия',
      description: typeof obj.description === 'string' ? obj.description : obj.description === null ? null : undefined,
      scriptData: obj.scriptData != null && typeof obj.scriptData === 'object' ? (obj.scriptData as ScenarioScriptData) : undefined,
      npcs: Array.isArray(obj.npcs) ? obj.npcs : undefined,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Неверный JSON' };
  }
}

/** Нормализует и валидирует scriptData: проверяет ссылки, отфильтровывает битые ветки. */
export function validateScenarioImportPayload(payload: ScenarioExportPayload): ScenarioImportValidation {
  const errors: string[] = [];
  const locations = Array.isArray(payload.scriptData?.locations) ? payload.scriptData!.locations : [];
  const situations = Array.isArray(payload.scriptData?.situations) ? payload.scriptData!.situations : [];
  const branches = Array.isArray(payload.scriptData?.branches) ? payload.scriptData!.branches : [];
  const locationIds = new Set(locations.map((l) => l.id));
  const situationIds = new Set(situations.map((s) => s.id));

  /** При импорте аудио и изображения не переносим — добавляются только вручную в редакторе. */
  const normalizedLocations: ScenarioScriptLocation[] = locations.map((l) => ({
    id: String(l.id),
    title: String(l.title ?? ''),
    body: String(l.body ?? ''),
    notes: l.notes != null ? String(l.notes) : undefined,
    npcIds: Array.isArray(l.npcIds) ? l.npcIds.filter((id) => typeof id === 'string') : undefined,
    order: typeof l.order === 'number' ? l.order : undefined,
  }));

  const normalizedSituations: ScenarioScriptSituation[] = situations.map((s) => {
    const locId = s.locationId != null ? String(s.locationId) : null;
    if (locId && !locationIds.has(locId)) {
      errors.push(`Ситуация "${s.title || s.id}": локация с id "${locId}" не найдена`);
    }
    return {
      id: String(s.id),
      title: String(s.title ?? ''),
      body: String(s.body ?? ''),
      locationId: locId || null,
      order: typeof s.order === 'number' ? s.order : undefined,
    };
  });

  const validBranches: ScenarioScriptBranch[] = [];
  for (const b of branches) {
    const fromOk = b.fromType === 'location' ? locationIds.has(b.fromId) : situationIds.has(b.fromId);
    const toOk = b.toType === 'location' ? locationIds.has(b.toId) : situationIds.has(b.toId);
    if (!fromOk) {
      errors.push(`Переход "${b.label || b.id}": источник (${b.fromType}) "${b.fromId}" не найден`);
    }
    if (!toOk) {
      errors.push(`Переход "${b.label || b.id}": цель (${b.toType}) "${b.toId}" не найдена`);
    }
    if (fromOk && toOk) {
      validBranches.push({
        id: String(b.id),
        fromType: b.fromType,
        fromId: String(b.fromId),
        toType: b.toType,
        toId: String(b.toId),
        label: String(b.label ?? ''),
      });
    }
  }

  let startLocationId: string | null = null;
  if (payload.scriptData?.startLocationId != null && payload.scriptData.startLocationId !== '') {
    const startId = String(payload.scriptData.startLocationId);
    if (locationIds.has(startId)) {
      startLocationId = startId;
    } else {
      errors.push(`Стартовая локация "${startId}" не найдена в списке локаций`);
    }
  }

  const scriptData: ScenarioScriptData = {
    locations: normalizedLocations,
    situations: normalizedSituations,
    branches: validBranches,
    startLocationId,
  };

  /** Нормализуем NPC: все поля кроме аватарки; id из файла для маппинга location.npcIds. */
  const normalizedNpcs: ScenarioNpcImportItem[] = [];
  if (Array.isArray(payload.npcs)) {
    payload.npcs.forEach((n, i) => {
      if (!n || typeof n !== 'object') return;
      const name = String((n as Record<string, unknown>).name ?? '').trim();
      if (!name) return;
      const item = toNpcExportItem(n as Record<string, unknown>) as ScenarioNpcImportItem;
      if (!item.id) item.id = `__npc_${i}`;
      normalizedNpcs.push(item);
    });
  }

  return {
    valid: errors.length === 0,
    scriptData,
    npcs: normalizedNpcs.length > 0 ? normalizedNpcs : undefined,
    title: payload.title ? String(payload.title) : undefined,
    description: payload.description ?? undefined,
    errors,
  };
}

/** Подставляет в scriptData.locations[].npcIds новые id NPC (старый id -> новый id после создания). */
export function mapScriptDataNpcIds(
  scriptData: ScenarioScriptData,
  oldIdToNewId: Record<string, string>
): ScenarioScriptData {
  if (!scriptData.locations?.length) return scriptData;
  return {
    ...scriptData,
    locations: scriptData.locations.map((loc) => {
      if (!loc.npcIds?.length) return loc;
      const mapped = loc.npcIds.map((oldId) => oldIdToNewId[oldId] ?? oldId).filter(Boolean);
      return { ...loc, npcIds: mapped.length ? mapped : undefined };
    }),
  };
}

export async function getScenarioScript(scenarioId: string): Promise<ScenarioScriptData> {
  const response = await fetch(
    `${API_CONFIG.WEBSITE_API_URL}/api/scenarios/${scenarioId}/script`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка загрузки сценария');
  }
  const data = await response.json();
  return data.script || { locations: [], situations: [], branches: [], startLocationId: null };
}

export async function saveScenarioScript(
  scenarioId: string,
  script: ScenarioScriptData
): Promise<Scenario> {
  const response = await fetch(
    `${API_CONFIG.WEBSITE_API_URL}/api/scenarios/${scenarioId}/script`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ script }),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка сохранения сценария');
  }
  const data = await response.json();
  return normalizeScenario(data.scenario);
}

export async function getScenarios(): Promise<Scenario[]> {
  const response = await fetch(`${API_CONFIG.WEBSITE_API_URL}/api/scenarios`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('Ошибка загрузки сценариев');
  }

  const data = await response.json();
  return (data.scenarios as any[]).map(normalizeScenario);
}

/** Получить сценарий по id для просмотра в комнате (игрок подгружает сценарий мастера) */
export async function getScenarioById(scenarioId: string): Promise<Scenario> {
  const response = await fetch(
    `${API_CONFIG.WEBSITE_API_URL}/api/scenarios/${scenarioId}/view`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) throw new Error('Сценарий не найден');
    throw new Error('Ошибка загрузки сценария');
  }

  const data = await response.json();
  return normalizeScenario(data.scenario);
}

export async function createScenario(payload: CreateScenarioRequest): Promise<Scenario> {
  const response = await fetch(`${API_CONFIG.WEBSITE_API_URL}/api/scenarios`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка создания сценария');
  }

  const data = await response.json();
  return normalizeScenario(data.scenario);
}

export async function uploadScenarioFiles(params: {
  scenarioId: string;
  mainFile?: File | null;
  attachments?: File[];
  audioFiles?: File[];
}): Promise<Scenario> {
  const formData = new FormData();
  if (params.mainFile) {
    formData.append('mainFile', params.mainFile);
  }
  for (const file of params.attachments ?? []) {
    formData.append('attachments', file);
  }
  for (const file of params.audioFiles ?? []) {
    formData.append('audioFiles', file);
  }

  const response = await fetch(
    `${API_CONFIG.WEBSITE_API_URL}/api/scenarios/${params.scenarioId}/files`,
    {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка загрузки файлов сценария');
  }

  const data = await response.json();
  return normalizeScenario(data.scenario);
}

export async function updateScenarioApi(
  scenarioId: string,
  payload: { title?: string; description?: string }
): Promise<Scenario> {
  const response = await fetch(`${API_CONFIG.WEBSITE_API_URL}/api/scenarios/${scenarioId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка обновления сценария');
  }

  const data = await response.json();
  return normalizeScenario(data.scenario);
}

export async function deleteScenarioFile(
  scenarioId: string,
  fileId: string
): Promise<Scenario> {
  const response = await fetch(
    `${API_CONFIG.WEBSITE_API_URL}/api/scenarios/${scenarioId}/files/${fileId}`,
    {
      method: 'DELETE',
      headers: {
        ...getAuthHeader(),
      },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка удаления файла');
  }

  const data = await response.json();
  return normalizeScenario(data.scenario);
}

/** Удалить сценарий (только свой) */
export async function deleteScenario(scenarioId: string): Promise<void> {
  const response = await fetch(
    `${API_CONFIG.WEBSITE_API_URL}/api/scenarios/${scenarioId}`,
    {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    }
  );
  if (!response.ok) {
    if (response.status === 404) throw new Error('Сценарий не найден');
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка удаления сценария');
  }
}

export async function renameScenarioFile(
  scenarioId: string,
  fileId: string,
  displayName: string
): Promise<Scenario> {
  const response = await fetch(
    `${API_CONFIG.WEBSITE_API_URL}/api/scenarios/${scenarioId}/files/${fileId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ displayName }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка переименования файла');
  }

  const data = await response.json();
  return normalizeScenario(data.scenario);
}

