import { useState, FormEvent } from 'react';
import { useAuth } from '../../store/authContext';

interface LoginFormProps {
  onSuccess?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '400px', margin: '0 auto' }}>
      <h2>Вход</h2>
      
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
          Пароль:
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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

      <button
        type="submit"
        disabled={isLoading}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '16px',
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        {isLoading ? 'Вход...' : 'Войти'}
      </button>
    </form>
  );
};

export default LoginForm;

