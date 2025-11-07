import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number; // в миллисекундах, если не указано - не исчезает автоматически
  timestamp: Date;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = `notification-${Date.now()}-${Math.random()}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
    };

    setNotifications((prev) => [...prev, newNotification]);

    // Автоматически удаляем уведомление через указанное время
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration);
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearNotifications,
      }}
    >
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
};

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '400px',
      }}
    >
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onClose: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClose }) => {
  const getNotificationStyles = () => {
    const baseStyles = {
      padding: '15px 20px',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '15px',
      minWidth: '300px',
      maxWidth: '400px',
      animation: 'slideIn 0.3s ease-out',
    };

    switch (notification.type) {
      case 'success':
        return {
          ...baseStyles,
          background: '#d4edda',
          border: '1px solid #c3e6cb',
          color: '#155724',
        };
      case 'warning':
        return {
          ...baseStyles,
          background: '#fff3cd',
          border: '1px solid #ffeaa7',
          color: '#856404',
        };
      case 'error':
        return {
          ...baseStyles,
          background: '#f8d7da',
          border: '1px solid #f5c6cb',
          color: '#721c24',
        };
      default: // info
        return {
          ...baseStyles,
          background: '#d1ecf1',
          border: '1px solid #bee5eb',
          color: '#0c5460',
        };
    }
  };

  return (
    <div style={getNotificationStyles()}>
      <div style={{ flex: 1 }}>
        {notification.title && (
          <div style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '14px' }}>
            {notification.title}
          </div>
        )}
        <div style={{ fontSize: '13px' }}>{notification.message}</div>
      </div>
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          fontSize: '18px',
          lineHeight: '1',
          padding: '0',
          opacity: 0.7,
        }}
        aria-label="Закрыть"
      >
        ×
      </button>
    </div>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

