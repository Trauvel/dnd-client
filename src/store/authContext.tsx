import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { login as loginApi, register as registerApi, getProfile, type User } from '../api/auth';
import { saveToken, getToken, removeToken, saveUserData, getUserData, removeUserData } from '../utils/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Загрузка данных из localStorage при монтировании
  useEffect(() => {
    const loadAuthData = async () => {
      const savedToken = getToken();
      const savedUser = getUserData();

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(savedUser);

        // Проверяем валидность токена, загружая профиль
        try {
          const profile = await getProfile();
          setUser(profile.user);
        } catch (error) {
          // Если токен невалидный, очищаем данные
          console.error('Failed to load profile:', error);
          removeToken();
          removeUserData();
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    loadAuthData();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await loginApi({ email, password });
      setToken(response.token);
      setUser(response.user);
      saveToken(response.token);
      saveUserData(response.user);
    } catch (error: any) {
      throw error;
    }
  };

  const handleRegister = async (email: string, username: string, password: string) => {
    try {
      const response = await registerApi({ email, username, password });
      setToken(response.token);
      setUser(response.user);
      saveToken(response.token);
      saveUserData(response.user);
    } catch (error: any) {
      throw error;
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    removeToken();
    removeUserData();
  };

  const refreshProfile = async () => {
    try {
      const profile = await getProfile();
      setUser(profile.user);
      saveUserData(profile.user);
    } catch (error) {
      console.error('Failed to refresh profile:', error);
      handleLogout();
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!token && !!user,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

