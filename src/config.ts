export const API_CONFIG = {
  WEBSITE_API_URL: import.meta.env.VITE_WEBSITE_API_URL || 'http://localhost:3000',
  GAME_SERVER_URL: import.meta.env.VITE_GAME_SERVER_URL || 'http://localhost:3001',
  GAME_SERVER_WS: import.meta.env.VITE_GAME_SERVER_WS || 'http://localhost:3001', // Socket.io использует HTTP URL
  /** WS для отправки распознанной речи (roomId, playerId, partial/final). Не задан — кнопка не показывается. */
  SPEECH_WS: import.meta.env.VITE_SPEECH_WS || '',
};

// Константы для localStorage
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
};

