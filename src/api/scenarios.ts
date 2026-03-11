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

/** Данные сценария для экспорта в JSON (обсуждение с GPT: без бинарных файлов, с кратким описанием NPC) */
export interface ScenarioExportPayload {
  title: string;
  description?: string | null;
  scriptData?: ScenarioScriptData | null;
  /** Краткое описание NPC: имя, тип, роль, текстовое описание */
  npcs?: Array<{ name: string; type?: string | null; npcKinds?: string[]; description?: string | null }>;
  /** Метки вложений (для контекста): карты и аудио по локациям */
  attachmentLabels?: Record<string, string>;
  exportedAt: string;
}

export function buildScenarioExportPayload(
  scenario: Scenario,
  npcs?: Array<{ name: string; type?: string | null; npcKinds?: string[]; description?: string | null }>
): ScenarioExportPayload {
  const attachmentLabels: Record<string, string> = {};
  for (const a of scenario.attachments ?? []) {
    attachmentLabels[a.id] = a.displayName ?? a.fileName;
  }
  for (const a of scenario.audios ?? []) {
    attachmentLabels[a.id] = a.displayName ?? a.fileName;
  }
  return {
    title: scenario.title,
    description: scenario.description ?? null,
    scriptData: scenario.scriptData ?? null,
    npcs: npcs ?? [],
    attachmentLabels: Object.keys(attachmentLabels).length > 0 ? attachmentLabels : undefined,
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

