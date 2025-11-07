import { useNavigate, Link } from 'react-router-dom';
import LoginForm from '../components/Auth/LoginForm';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate('/');
  };

  return (
    <div style={{ padding: '40px 20px', minHeight: 'calc(100vh - 100px)' }}>
      <LoginForm onSuccess={handleSuccess} />
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <p>
          Нет аккаунта?{' '}
          <Link to="/register" style={{ color: '#007bff', textDecoration: 'none' }}>
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;

