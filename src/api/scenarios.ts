import { API_CONFIG } from '../config';
import { getAuthHeader } from '../utils/auth';

export interface ScenarioFile {
  id: string;
  fileName: string;
  displayName?: string | null;
  mimeType: string;
  kind: 'main' | 'attachment';
  url: string;
}

export interface Scenario {
  id: string;
  title: string;
  description?: string | null;
  mainFileUrl?: string | null;
  attachments: ScenarioFile[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateScenarioRequest {
  title: string;
  description?: string;
}

function absolutizeUrl(relative?: string | null): string | null | undefined {
  if (!relative) return relative;
  // backend отдаёт путь вида /uploads/..., добавляем базовый URL API
  return `${API_CONFIG.WEBSITE_API_URL}${relative}`;
}

function normalizeScenario(raw: any): Scenario {
  const mainFileUrl = absolutizeUrl(raw.mainFileUrl);
  const attachments = (raw.attachments ?? []).map((f: any) => ({
    ...f,
    url: absolutizeUrl(f.url) as string,
  }));
  return {
    ...raw,
    mainFileUrl,
    attachments,
  } as Scenario;
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
}): Promise<Scenario> {
  const formData = new FormData();
  if (params.mainFile) {
    formData.append('mainFile', params.mainFile);
  }
  for (const file of params.attachments ?? []) {
    formData.append('attachments', file);
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

