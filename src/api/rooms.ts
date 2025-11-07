import { API_CONFIG } from '../config';
import { getAuthHeader } from '../utils/auth';

export interface RoomSettings {
  maxPlayers?: number;
  characterSelection: 'predefined' | 'in-room';
}

export interface RoomPlayer {
  userId: string;
  username: string;
  role: 'master' | 'player';
  characterId?: string;
  isConnected: boolean;
  joinedAt: string;
}

export interface GameRoom {
  id: string;
  code: string;
  masterId: string;
  maxPlayers?: number;
  characterSelection: 'predefined' | 'in-room';
  isPaused: boolean;
  isActive: boolean;
  players: RoomPlayer[];
  createdAt: string;
  gameStarted: boolean;
}

export interface CreateRoomRequest {
  maxPlayers?: number;
  characterSelection?: 'predefined' | 'in-room';
}

export interface CreateRoomResponse {
  room: GameRoom;
}

export interface JoinRoomRequest {
  code: string;
  characterId?: string;
}

export interface JoinRoomResponse {
  room: GameRoom;
  player: {
    userId: string;
    username: string;
    role: 'master' | 'player';
    characterId?: string;
  };
}

export interface RoomInfoResponse {
  room: GameRoom;
}

export interface ErrorResponse {
  error: string;
}

/**
 * Создать новую игровую комнату
 */
export async function createRoom(settings: CreateRoomRequest = {}): Promise<CreateRoomResponse> {
  const response = await fetch(`${API_CONFIG.GAME_SERVER_URL}/api/rooms/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({
      maxPlayers: settings.maxPlayers,
      characterSelection: settings.characterSelection || 'predefined',
    }),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Ошибка создания комнаты');
  }

  return response.json();
}

/**
 * Присоединиться к комнате
 */
export async function joinRoom(data: JoinRoomRequest): Promise<JoinRoomResponse> {
  const response = await fetch(`${API_CONFIG.GAME_SERVER_URL}/api/rooms/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({
      code: data.code.toUpperCase(),
      characterId: data.characterId,
    }),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Ошибка присоединения к комнате');
  }

  return response.json();
}

/**
 * Получить информацию о комнате
 */
export async function getRoomInfo(code: string): Promise<RoomInfoResponse> {
  const response = await fetch(`${API_CONFIG.GAME_SERVER_URL}/api/rooms/${code.toUpperCase()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Ошибка получения информации о комнате');
  }

  return response.json();
}

/**
 * Поставить игру на паузу или возобновить (только мастер)
 */
export async function pauseRoom(code: string, paused: boolean): Promise<{ success: boolean; paused: boolean }> {
  const response = await fetch(`${API_CONFIG.GAME_SERVER_URL}/api/rooms/${code.toUpperCase()}/pause`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({ paused }),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Ошибка установки паузы');
  }

  return response.json();
}

/**
 * Начать игру (только мастер)
 */
export async function startGame(code: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_CONFIG.GAME_SERVER_URL}/api/rooms/${code.toUpperCase()}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Ошибка начала игры');
  }

  return response.json();
}

export interface RoomSnapshot {
  id: string;
  roomCode: string;
  masterId: string;
  userId: string;
  players: string[];
  gameStarted: boolean;
  createdAt: string;
}

export interface RoomHistoryResponse {
  snapshots: RoomSnapshot[];
}

/**
 * Получить историю комнат пользователя
 */
export async function getRoomHistory(): Promise<RoomHistoryResponse> {
  const response = await fetch(`${API_CONFIG.WEBSITE_API_URL}/api/rooms/history`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Ошибка получения истории комнат');
  }

  return response.json();
}

/**
 * Восстановить комнату из сохранения
 */
export async function restoreRoom(saveId: string): Promise<{ roomCode: string }> {
  const response = await fetch(`${API_CONFIG.WEBSITE_API_URL}/api/rooms/saves/${saveId}/restore`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Ошибка восстановления комнаты');
  }

  const data = await response.json();
  return { roomCode: data.roomCode };
}

/**
 * Получить сохранение по ID
 */
export async function getRoomSnapshot(saveId: string): Promise<{ id: string; roomCode: string; state: string; gameStarted: boolean; createdAt: string }> {
  const response = await fetch(`${API_CONFIG.WEBSITE_API_URL}/api/rooms/saves/${saveId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Ошибка получения сохранения');
  }

  return response.json();
}

/**
 * Удалить сохранение
 */
export async function deleteRoomSnapshot(saveId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_CONFIG.WEBSITE_API_URL}/api/rooms/saves/${saveId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Ошибка удаления сохранения');
  }

  return response.json();
}

