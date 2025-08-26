import React, { useState, useEffect } from 'react';
import { useSocket } from '../store/socketContext';
import { fetchPlayerMock, type Player } from '../api/player';
import './PlayerPage.css';

const PlayerPage: React.FC = () => {
  const { socket, GameState, connect, updatePlayer } = useSocket();
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const playerMock = fetchPlayerMock();
  console.log(playerMock);

  // Моковые данные персонажа для демонстрации
  const Player: Player = {
    id: 'player-1',
    name: 'Арагорн',
    ...playerMock,
  };

  useEffect(() => {
    // Устанавливаем мокового персонажа при загрузке
    setCurrentPlayer(Player);
  }, []);

  const handleConnect = () => {
    if (playerName.trim()) {
      connect(playerName);
    }
  };

  const updatePlayerStat = (stat: keyof Player, value: any) => {
    if (currentPlayer) {
      const updatedPlayer = {
        ...currentPlayer,
        [stat]: value
      };
      setCurrentPlayer(updatedPlayer);

      // Отправляем обновление на сервер
      updatePlayer({ [stat]: value });
    }
  };

  const getModifier = (abilityScore: number): string => {
    const modifier = Math.floor((abilityScore - 10) / 2);
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  };

  if (!currentPlayer) {
    return <div className="player-page">Загрузка персонажа...</div>;
  }

  return (
    <div className="player-page">
      <div className="player-header">
        <h1>Персонаж: {currentPlayer.name}</h1>
        <div className="connection-section">
          <input
            type="text"
            placeholder="Введите имя персонажа"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="name-input"
          />
          <button onClick={handleConnect} className="connect-btn">
            Подключиться
          </button>
        </div>
      </div>

      <div className="player-content">
        <div className="player-main-info">
          <div className="character-sheet">
            <div className="basic-info">
              <h2>Основная информация</h2>
              <div className="info-grid">
                <div className="info-item">
                  <label>Имя:</label>
                  <input
                    type="text"
                    value={currentPlayer.name}
                    onChange={(e) => updatePlayerStat('name', e.target.value)}
                  />
                </div>
                <div className="info-item">
                  <label>Раса:</label>
                  <input
                    type="text"
                    value={currentPlayer.race || ''}
                    onChange={(e) => updatePlayerStat('race', e.target.value)}
                  />
                </div>
                <div className="info-item">
                  <label>Класс:</label>
                  <input
                    type="text"
                    value={currentPlayer.class || ''}
                    onChange={(e) => updatePlayerStat('class', e.target.value)}
                  />
                </div>
                <div className="info-item">
                  <label>Уровень:</label>
                  <input
                    type="number"
                    value={currentPlayer.level || 1}
                    onChange={(e) => updatePlayerStat('level', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="combat-stats">
              <h2>Боевые характеристики</h2>
              <div className="stats-grid">
                <div className="stat-item">
                  <label>HP:</label>
                  <input
                    type="number"
                    value={currentPlayer.hp || 0}
                    onChange={(e) => updatePlayerStat('hp', parseInt(e.target.value))}
                  />
                  <span>/ {currentPlayer.maxHp || 0}</span>
                </div>
                <div className="stat-item">
                  <label>КД:</label>
                  <input
                    type="number"
                    value={currentPlayer.armorClass || 0}
                    onChange={(e) => updatePlayerStat('armorClass', parseInt(e.target.value))}
                  />
                </div>
                <div className="stat-item">
                  <label>Инициатива:</label>
                  <input
                    type="number"
                    value={currentPlayer.initiative || 0}
                    onChange={(e) => updatePlayerStat('initiative', parseInt(e.target.value))}
                  />
                </div>
                <div className="stat-item">
                  <label>Скорость:</label>
                  <input
                    type="number"
                    value={currentPlayer.speed || 0}
                    onChange={(e) => updatePlayerStat('speed', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="ability-scores">
              <h2>Характеристики</h2>
              <div className="abilities-grid">
                {[
                  { key: 'strength', name: 'Сила' },
                  { key: 'dexterity', name: 'Ловкость' },
                  { key: 'constitution', name: 'Телосложение' },
                  { key: 'intelligence', name: 'Интеллект' },
                  { key: 'wisdom', name: 'Мудрость' },
                  { key: 'charisma', name: 'Харизма' }
                ].map(({ key, name }) => (
                  <div key={key} className="ability-item">
                    <label>{name}:</label>
                    <input
                      type="number"
                      value={currentPlayer[key as keyof Player] || 10}
                      onChange={(e) => updatePlayerStat(key as keyof Player, parseInt(e.target.value))}
                    />
                    <span className="modifier">
                      {getModifier(currentPlayer[key as keyof Player] as number || 10)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="experience-section">
              <h2>Опыт</h2>
              <div className="exp-item">
                <label>Опыт:</label>
                <input
                  type="number"
                  value={currentPlayer.experience || 0}
                  onChange={(e) => updatePlayerStat('experience', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="inventory-section">
              <h2>Инвентарь</h2>
              <div className="inventory-list">
                {currentPlayer.inventory?.map((item, index) => (
                  <div key={index} className="inventory-item">
                    {item}
                  </div>
                )) || <div>Инвентарь пуст</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="player-sidebar">
          <div className="connection-status">
            <h3>Статус подключения</h3>
            <div className={`status-indicator ${socket ? 'connected' : 'disconnected'}`}>
              {socket ? 'Подключено' : 'Отключено'}
            </div>
          </div>

          {GameState && (
            <div className="game-state">
              <h3>Игровое состояние</h3>
              <div className="state-info">
                <p>Игроков онлайн: {GameState.public.players.length}</p>
                <p>Локаций: {GameState.public.locations?.length || 0}</p>
                {GameState.public.logs && GameState.public.logs.length > 0 && (
                  <div className="logs-section">
                    <h4>Последние события:</h4>
                    <div className="logs-list">
                      {GameState.public.logs.slice(-5).map((log, index) => (
                        <div key={index} className="log-item">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerPage;
