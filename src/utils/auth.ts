import { STORAGE_KEYS } from '../config';

/**
 * Сохранить JWT токен в localStorage
 */
export function saveToken(token: string): void {
  localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
}

/**
 * Получить JWT токен из localStorage
 */
export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
}

/**
 * Удалить JWT токен из localStorage
 */
export function removeToken(): void {
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
}

/**
 * Сохранить данные пользователя в localStorage
 */
export function saveUserData(user: { id: string; email: string; username: string }): void {
  localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
}

/**
 * Получить данные пользователя из localStorage
 */
export function getUserData(): { id: string; email: string; username: string } | null {
  const data = localStorage.getItem(STORAGE_KEYS.USER_DATA);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Удалить данные пользователя из localStorage
 */
export function removeUserData(): void {
  localStorage.removeItem(STORAGE_KEYS.USER_DATA);
}

/**
 * Проверить, авторизован ли пользователь
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * Получить заголовок Authorization для API запросов
 */
export function getAuthHeader(): { Authorization: string } | {} {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

