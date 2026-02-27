import { API_CONFIG } from '../config';
import { getAuthHeader } from '../utils/auth';
import { absolutizeUrl } from './scenarios';

/** 'enemy' = враг (в бой), 'ally' = союзник, 'story' = персонаж мастера (только картинка и описание). Можно комбинировать. */
export type ScenarioNpcKind = 'enemy' | 'ally' | 'story';

export interface ScenarioNpc {
  id: string;
  scenarioId: string;
  name: string;
  type?: string | null;
  /** Множественный выбор: враг, союзник, персонаж мастера */
  npcKinds?: ScenarioNpcKind[];
  /** @deprecated используйте npcKinds */
  npcKind?: ScenarioNpcKind | null;
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
  imageUrl?: string | null;
  imageFileId?: string | null;
}

export interface UpsertScenarioNpcPayload {
  name: string;
  type?: string;
  npcKinds?: ScenarioNpcKind[] | null;
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
  imageFileId?: string | null;
}

function normalizeNpc(raw: any): ScenarioNpc {
  const npcKinds = Array.isArray(raw.npcKinds)
    ? raw.npcKinds.filter((k: string) => k === 'enemy' || k === 'ally' || k === 'story')
    : raw.npcKind && (raw.npcKind === 'enemy' || raw.npcKind === 'ally' || raw.npcKind === 'story')
      ? [raw.npcKind]
      : [];
  return {
    ...raw,
    npcKinds: npcKinds.length ? npcKinds : undefined,
    imageUrl: absolutizeUrl(raw.imageUrl) as string | null,
  } as ScenarioNpc;
}

export async function getScenarioNpcs(scenarioId: string): Promise<ScenarioNpc[]> {
  const response = await fetch(
    `${API_CONFIG.WEBSITE_API_URL}/api/scenarios/${scenarioId}/npcs`,
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
    throw new Error(err.error || 'Ошибка загрузки NPC сценария');
  }

  const data = await response.json();
  return (data.npcs ?? []).map(normalizeNpc);
}

/** Список NPC для просмотра в комнате (мастер/игроки) */
export async function getScenarioNpcsForView(
  scenarioId: string
): Promise<ScenarioNpc[]> {
  const response = await fetch(
    `${API_CONFIG.WEBSITE_API_URL}/api/scenarios/${scenarioId}/npcs/view`,
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
    throw new Error(err.error || 'Ошибка загрузки NPC сценария');
  }

  const data = await response.json();
  return (data.npcs ?? []).map(normalizeNpc);
}

export async function createScenarioNpc(
  scenarioId: string,
  payload: UpsertScenarioNpcPayload
): Promise<ScenarioNpc> {
  const response = await fetch(
    `${API_CONFIG.WEBSITE_API_URL}/api/scenarios/${scenarioId}/npcs`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка создания NPC');
  }

  const data = await response.json();
  return normalizeNpc(data.npc);
}

export async function updateScenarioNpc(
  scenarioId: string,
  npcId: string,
  payload: Partial<UpsertScenarioNpcPayload>
): Promise<ScenarioNpc> {
  const response = await fetch(
    `${API_CONFIG.WEBSITE_API_URL}/api/scenarios/${scenarioId}/npcs/${npcId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка обновления NPC');
  }

  const data = await response.json();
  return normalizeNpc(data.npc);
}

export async function deleteScenarioNpc(
  scenarioId: string,
  npcId: string
): Promise<void> {
  const response = await fetch(
    `${API_CONFIG.WEBSITE_API_URL}/api/scenarios/${scenarioId}/npcs/${npcId}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка удаления NPC');
  }
}

