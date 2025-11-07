import { useNavigate, Link } from 'react-router-dom';
import RegisterForm from '../components/Auth/RegisterForm';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate('/');
  };

  return (
    <div style={{ padding: '40px 20px', minHeight: 'calc(100vh - 100px)' }}>
      <RegisterForm onSuccess={handleSuccess} />
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <p>
          Уже есть аккаунт?{' '}
          <Link to="/login" style={{ color: '#007bff', textDecoration: 'none' }}>
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;

