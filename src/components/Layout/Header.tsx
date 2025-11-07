import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../store/authContext";

const Header: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header style={{ background: "#222", padding: "10px", color: "#fff" }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "15px" }}>
          {isAuthenticated ? (
            <>
              <Link to="/" style={{ color: "#fff", textDecoration: "none" }}>
                Игра
              </Link>
              <Link to="/characters" style={{ color: "#fff", textDecoration: "none" }}>
                Персонажи
              </Link>
              <Link to="/room-history" style={{ color: "#fff", textDecoration: "none" }}>
                История игр
              </Link>
              <Link to="/locations" style={{ color: "#fff", textDecoration: "none" }}>
                Локации
              </Link>
              <Link to="/settings" style={{ color: "#fff", textDecoration: "none" }}>
                Настройки
              </Link>
              <Link to="/dev" style={{ color: "#fff", textDecoration: "none" }}>
                Dev
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" style={{ color: "#fff", textDecoration: "none" }}>
                Вход
              </Link>
              <Link to="/register" style={{ color: "#fff", textDecoration: "none" }}>
                Регистрация
              </Link>
            </>
          )}
        </div>
        {isAuthenticated && user && (
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <span style={{ color: "#aaa" }}>{user.username}</span>
            <button
              onClick={handleLogout}
              style={{
                background: "#dc3545",
                color: "#fff",
                border: "none",
                padding: "5px 15px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Выход
            </button>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;
