import { useState, FormEvent } from 'react';
import { useAuth } from '../../store/authContext';

interface RegisterFormProps {
  onSuccess?: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Валидация пароля
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    setIsLoading(true);

    try {
      await register(email, username, password);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '400px', margin: '0 auto' }}>
      <h2>Регистрация</h2>
      
      {error && (
        <div style={{ 
          color: 'red', 
          marginBottom: '10px', 
          padding: '10px', 
          background: '#ffebee', 
          borderRadius: '4px' 
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Email:
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Имя пользователя:
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Пароль:
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
          minLength={6}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Подтвердите пароль:
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={isLoading}
          minLength={6}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '16px',
          background: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
      </button>
    </form>
  );
};

export default RegisterForm;

