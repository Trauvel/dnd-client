import { Link } from "react-router-dom";

const Header: React.FC = () => {
  return (
    <header style={{ background: "#222", padding: "10px", color: "#fff" }}>
      <nav style={{ display: "flex", gap: "15px" }}>
        <Link to="/">Игра</Link>
        <Link to="/locations">Локации</Link>
        <Link to="/player">Персонаж</Link>
        <Link to="/settings">Настройки</Link>
        <Link to="/dev">Dev</Link>
      </nav>
    </header>
  );
};

export default Header;
