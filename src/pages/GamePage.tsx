import { useState } from "react";
import { useSocket } from "../store/socketContext";

const GamePage: React.FC = () => {
  const [name, setName] = useState("");
  const { connect, GameState, socket } = useSocket();

  const handleConnect = () => {
    if (name) connect(name);
  };

  const move = (locationId: string) => {
    socket?.emit("player:move", { locationId });
    socket?.emit("playerAction", {
      action: 'player:move',
      data: {
        'playerId': socket.id,
        'to': locationId,
      }
    });
  };

  return (
    <div>
      <h1>Игра</h1>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Имя игрока"
      />
      <button onClick={handleConnect}>Подключиться</button>

      {!GameState && <div>Не подключено</div>}
      {GameState && (
        <>
          <h2>Игроки:</h2>
          <ul>
            {GameState.public.players?.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>

          <h2>Локации:</h2>
          <ul>
            {GameState.public.locations?.map((loc) => (
              <li key={loc.id}>
                {loc.name} <button onClick={() => move(loc.id)}>Перейти</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default GamePage;
