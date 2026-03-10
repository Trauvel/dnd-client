import { API_CONFIG } from '../config';
import { getAuthHeader } from '../utils/auth';

const AUTH_BASE = (API_CONFIG.WEBSITE_API_URL || '').replace(/\/$/, '');

async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${AUTH_BASE}${url}`, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('Load failed')) {
      throw new Error(`Не удалось подключиться к серверу (${AUTH_BASE}${url}). Проверьте, что website-api запущен и VITE_WEBSITE_API_URL указан верно.`);
    }
    throw e;
  }
}

export interface User {
  id: string;
  email: string;
  username: string;
  createdAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ErrorResponse {
  error: string;
}

/**
 * Авторизация пользователя
 */
export async function login(data: LoginRequest): Promise<AuthResponse> {
  const response = await authFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Ошибка авторизации');
  }

  return response.json();
}

/**
 * Регистрация нового пользователя
 */
export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const response = await authFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Ошибка регистрации');
  }

  return response.json();
}

/**
 * Получить профиль текущего пользователя
 */
export async function getProfile(): Promise<{ user: User }> {
  const response = await authFetch('/api/auth/profile', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Требуется авторизация');
    const error: ErrorResponse = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Ошибка получения профиля');
  }

  return response.json();
}

export interface SearchUserItem {
  id: string;
  username: string;
}

/**
 * Поиск пользователей по имени (для выбора редакторов карточки персонажа)
 */
export async function searchUsers(query: string): Promise<SearchUserItem[]> {
  const q = encodeURIComponent((query || '').trim());
  const response = await authFetch(`/api/auth/users/search?q=${q}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
  });
  if (!response.ok) throw new Error('Ошибка поиска');
  const data = await response.json();
  return data.users ?? [];
}

