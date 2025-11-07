import { API_CONFIG } from '../config';
import { getAuthHeader } from '../utils/auth';

export interface Character {
  id: string;
  userId: string;
  characterName: string | null;
  isActive: boolean;
  level: number;
  experience: number;
  hp: number;
  maxHp: number;
  locationId: string | null;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  class: string | null;
  race: string | null;
  armorClass: number;
  initiative: number;
  speed: number;
  inventory: string[];
  characterData?: any;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCharacterRequest {
  characterName?: string;
}

export interface UpdateCharacterRequest {
  characterName?: string;
  level?: number;
  experience?: number;
  hp?: number;
  maxHp?: number;
  locationId?: string;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  class?: string;
  race?: string;
  armorClass?: number;
  initiative?: number;
  speed?: number;
  inventory?: string[];
  characterData?: any;
}

export interface ErrorResponse {
  error: string;
}

/**
 * Получить список всех персонажей пользователя
 */
export async function getCharacters(): Promise<Character[]> {
  const response = await fetch(`${API_CONFIG.WEBSITE_API_URL}/api/game-session/history`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Требуется авторизация');
    }
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Ошибка получения списка персонажей');
  }

  const data = await response.json();
  // Преобразуем inventory из JSON строки в массив
  return data.sessions.map((session: any) => ({
    ...session,
    inventory: session.inventory ? JSON.parse(session.inventory) : [],
    characterData: session.characterData ? JSON.parse(session.characterData) : undefined,
  }));
}

/**
 * Получить активного персонажа
 */
export async function getActiveCharacter(): Promise<Character | null> {
  const response = await fetch(`${API_CONFIG.WEBSITE_API_URL}/api/game-session/active`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null; // Нет активного персонажа
    }
    if (response.status === 401) {
      throw new Error('Требуется авторизация');
    }
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Ошибка получения активного персонажа');
  }

  const data = await response.json();
  const session = data.session;
  return {
    ...session,
    inventory: session.inventory ? JSON.parse(session.inventory) : [],
    characterData: session.characterData ? JSON.parse(session.characterData) : undefined,
  };
}

/**
 * Создать нового персонажа
 */
export async function createCharacter(data: CreateCharacterRequest): Promise<Character> {
  const response = await fetch(`${API_CONFIG.WEBSITE_API_URL}/api/game-session/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Требуется авторизация');
    }
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Ошибка создания персонажа');
  }

  const result = await response.json();
  const session = result.session;
  return {
    ...session,
    inventory: session.inventory ? JSON.parse(session.inventory) : [],
    characterData: session.characterData ? JSON.parse(session.characterData) : undefined,
  };
}

/**
 * Обновить данные персонажа
 */
export async function updateCharacter(
  sessionId: string,
  data: UpdateCharacterRequest
): Promise<Character> {
  const response = await fetch(
    `${API_CONFIG.WEBSITE_API_URL}/api/game-session/${sessionId}/update`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Требуется авторизация');
    }
    if (response.status === 403) {
      throw new Error('Доступ запрещён');
    }
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Ошибка обновления персонажа');
  }

  const result = await response.json();
  const session = result.session;
  return {
    ...session,
    inventory: session.inventory ? JSON.parse(session.inventory) : [],
    characterData: session.characterData ? JSON.parse(session.characterData) : undefined,
  };
}

/**
 * Загрузить состояние персонажа
 */
export async function loadCharacterState(): Promise<any> {
  const response = await fetch(`${API_CONFIG.WEBSITE_API_URL}/api/game-session/state/load`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null; // Нет активного персонажа
    }
    if (response.status === 401) {
      throw new Error('Требуется авторизация');
    }
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Ошибка загрузки состояния');
  }

  const data = await response.json();
  return data.state;
}

/**
 * Сохранить состояние персонажа
 */
export async function saveCharacterState(state: any): Promise<boolean> {
  const response = await fetch(`${API_CONFIG.WEBSITE_API_URL}/api/game-session/state/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({ state }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Активная сессия не найдена');
    }
    if (response.status === 401) {
      throw new Error('Требуется авторизация');
    }
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Ошибка сохранения состояния');
  }

  const data = await response.json();
  return data.success;
}

