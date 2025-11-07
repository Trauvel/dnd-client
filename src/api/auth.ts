import { API_CONFIG } from '../config';
import { getAuthHeader } from '../utils/auth';

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
  const response = await fetch(`${API_CONFIG.WEBSITE_API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Ошибка авторизации');
  }

  return response.json();
}

/**
 * Регистрация нового пользователя
 */
export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const response = await fetch(`${API_CONFIG.WEBSITE_API_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || 'Ошибка регистрации');
  }

  return response.json();
}

/**
 * Получить профиль текущего пользователя
 */
export async function getProfile(): Promise<{ user: User }> {
  const response = await fetch(`${API_CONFIG.WEBSITE_API_URL}/api/auth/profile`, {
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
    throw new Error(error.error || 'Ошибка получения профиля');
  }

  return response.json();
}

