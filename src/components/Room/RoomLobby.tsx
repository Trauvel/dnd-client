import { useEffect, useMemo, useState } from 'react';
import type { GameRoom } from '../../api/rooms';
import { pauseRoom, startGame, getRoomInfo } from '../../api/rooms';
import { useSocket } from '../../store/socketContext';
import { useAuth } from '../../store/authContext';
import { getScenarios, getScenarioById, type Scenario } from '../../api/scenarios';
import { getCharacterPortrait, getCharacterForView, type CharacterViewResult } from '../../api/characters';
import { CharacterSheetView } from '../Character/CharacterSheetView';

interface RoomLobbyProps {
  roomCode: string;
  onLeave: () => void;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({ roomCode, onLeave }) => {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { connect, isConnected, socket, GameState } = useSocket();
  const { user } = useAuth();
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [unlockedAttachments, setUnlockedAttachments] = useState<string[]>([]);
  const [activeAttachmentId, setActiveAttachmentId] = useState<string | null>(null);
  const [overlayHidden, setOverlayHidden] = useState(false);
  const [portraitUrls, setPortraitUrls] = useState<Record<string, string>>({});
  const [diceInput, setDiceInput] = useState('');
  const [diceLog, setDiceLog] = useState<Array<{ username: string; formula: string; result: number[]; total: number }>>([]);
  const [characterSheetView, setCharacterSheetView] = useState<CharacterViewResult | null>(null);
  const [characterSheetLoading, setCharacterSheetLoading] = useState(false);
  const [characterSheetError, setCharacterSheetError] = useState<string | null>(null);

  const isMaster = room && user && room.masterId === user.id;

  const openCharacterSheet = (characterId: string | undefined) => {
    if (!characterId) {
      setCharacterSheetView(null);
      setCharacterSheetError('У этого игрока не выбран персонаж');
      return;
    }
    setCharacterSheetError(null);
    setCharacterSheetLoading(true);
    setCharacterSheetView(null);
    getCharacterForView(characterId, roomCode)
      .then((result) => setCharacterSheetView(result))
      .catch((err) => setCharacterSheetError(err.message || 'Ошибка загрузки персонажа'))
      .finally(() => setCharacterSheetLoading(false));
  };

  const closeCharacterSheet = () => {
    setCharacterSheetView(null);
    setCharacterSheetError(null);
  };

  function parseDiceFormula(input: string): { count: number; sides: number } | null {
    const trimmed = input.trim().replace(/\s+/g, '');
    const match = trimmed.match(/^(\d+)[кkK](\d+)$/i);
    if (!match) return null;
    const count = parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);
    if (count < 1 || count > 20 || sides < 2 || sides > 100) return null;
    return { count, sides };
  }

  function rollDiceLocal(count: number, sides: number): { result: number[]; total: number } {
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      result.push(Math.floor(Math.random() * sides) + 1);
    }
    const total = result.reduce((a, b) => a + b, 0);
    return { result, total };
  }

  useEffect(() => {
    loadRoomInfo();
    // Подключаемся к WebSocket комнате
    if (!isConnected) {
      connect(roomCode);
    }

    // Обновляем информацию о комнате периодически
    const interval = setInterval(() => {
      loadRoomInfo();
    }, 5000); // Каждые 5 секунд

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, isConnected]);

  // Обработка событий WebSocket для обновления информации о комнате
  useEffect(() => {
    if (!socket) return;

    const handleRoomJoined = (data: { room?: { code?: string; masterId?: string; scenarioId?: string; gameStarted?: boolean; players?: Array<{ userId: string; username: string; role: string; characterId?: string }>; isPaused?: boolean } }) => {
      if (!data.room) {
        loadRoomInfo();
        return;
      }
      const r = data.room;
      const players: Array<{ userId: string; username: string; role: 'master' | 'player'; characterId?: string; isConnected: boolean; joinedAt: string }> = Array.isArray(r.players)
        ? r.players.map((p) => ({
            userId: p.userId,
            username: p.username,
            role: p.role === 'master' ? 'master' : 'player',
            characterId: p.characterId,
            isConnected: true,
            joinedAt: new Date().toISOString(),
          }))
        : [];
      setRoom((prev) => {
        const base: GameRoom = prev ?? {
          id: '',
          code: r.code ?? roomCode,
          masterId: r.masterId ?? '',
          scenarioId: r.scenarioId,
          gameStarted: r.gameStarted ?? false,
          isPaused: r.isPaused ?? false,
          isActive: true,
          characterSelection: 'predefined',
          players: [],
          createdAt: new Date().toISOString(),
        };
        return {
          ...base,
          scenarioId: r.scenarioId ?? base.scenarioId,
          gameStarted: r.gameStarted ?? base.gameStarted,
          isPaused: r.isPaused ?? base.isPaused,
          players: players.length > 0 ? players : base.players,
        };
      });
      loadRoomInfo();
    };

    const handlePlayerJoined = () => {
      loadRoomInfo();
    };

    const handlePlayerLeft = () => {
      loadRoomInfo();
    };

    const handlePaused = () => {
      loadRoomInfo();
    };

    const handleResumed = () => {
      loadRoomInfo();
    };

    const handleMasterReconnected = () => {
      loadRoomInfo();
    };

    const handleRoomClosed = () => {
      setError('Комната закрыта из-за отсутствия мастера');
    };

    const handleRoomReopened = () => {
      setError(null);
      loadRoomInfo();
    };

    const handleScenarioUpdate = (data: {
      scenarioId?: string;
      unlocked?: string[];
      activeAttachmentId?: string | null;
    }) => {
      if (!data.scenarioId) return;
      setUnlockedAttachments(data.unlocked || []);
      setActiveAttachmentId(data.activeAttachmentId ?? null);
      if (data.activeAttachmentId) setOverlayHidden(false);
    };

    socket.on('room:joined', handleRoomJoined);
    socket.on('room:player-joined', handlePlayerJoined);
    socket.on('room:player-left', handlePlayerLeft);
    socket.on('room:paused', handlePaused);
    socket.on('room:resumed', handleResumed);
    socket.on('room:master-reconnected', handleMasterReconnected);
    socket.on('room:closed', handleRoomClosed);
    socket.on('room:reopened', handleRoomReopened);
    socket.on('scenario:update', handleScenarioUpdate);

    const handleDiceResult = (data: { username: string; formula: string; result: number[]; total: number }) => {
      setDiceLog((prev) => [...prev.slice(-49), data]);
    };

    socket.on('dice:result', handleDiceResult);

    return () => {
      socket.off('dice:result', handleDiceResult);
      socket.off('room:joined', handleRoomJoined);
      socket.off('room:player-joined', handlePlayerJoined);
      socket.off('room:player-left', handlePlayerLeft);
      socket.off('room:paused', handlePaused);
      socket.off('room:resumed', handleResumed);
      socket.off('room:master-reconnected', handleMasterReconnected);
      socket.off('room:closed', handleRoomClosed);
      socket.off('room:reopened', handleRoomReopened);
      socket.off('scenario:update', handleScenarioUpdate);
    };
  }, [roomCode, socket]);

  // Загружаем данные сценария, если он есть у комнаты
  useEffect(() => {
    const loadScenario = async () => {
      if (!room?.scenarioId) {
        setScenario(null);
        return;
      }
      try {
        const list = await getScenarios();
        let found = list.find((s) => s.id === room.scenarioId) || null;
        if (!found) {
          found = await getScenarioById(room.scenarioId);
        }
        setScenario(found);
      } catch {
        setScenario(null);
      }
    };
    loadScenario();
  }, [room?.scenarioId]);

  const portraitCharacterIdsKey = useMemo(
    () =>
      (room?.players ?? [])
        .map((p) => p.characterId)
        .filter(Boolean)
        .sort()
        .join(','),
    [room?.players]
  );

  // Подгружаем портреты персонажей по characterId из комнаты
  useEffect(() => {
    if (!room?.players?.length) {
      setPortraitUrls({});
      return;
    }
    const ids = room.players.map((p) => p.characterId).filter(Boolean) as string[];
    if (ids.length === 0) {
      setPortraitUrls({});
      return;
    }
    let cancelled = false;
    const next: Record<string, string> = {};
    Promise.all(
      ids.map(async (cid) => {
        if (cancelled) return;
        try {
          const url = await getCharacterPortrait(cid);
          if (!cancelled && url) next[cid] = url;
        } catch {
          // ignore
        }
      })
    ).then(() => {
      if (!cancelled) setPortraitUrls((prev) => ({ ...prev, ...next }));
    });
    return () => {
      cancelled = true;
    };
  }, [portraitCharacterIdsKey]);

  const loadRoomInfo = async () => {
    try {
      const response = await getRoomInfo(roomCode);
      setRoom(response.room);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки информации о комнате');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRollDice = () => {
    const parsed = parseDiceFormula(diceInput);
    if (!parsed || !socket) {
      return;
    }
    const normalized = `${parsed.count}к${parsed.sides}`;
    const { result, total } = rollDiceLocal(parsed.count, parsed.sides);
    socket.emit('dice:roll', { formula: normalized, result, total });
    setDiceInput('');
  };

  const handlePause = async (paused: boolean) => {
    if (!isMaster) return;

    try {
      await pauseRoom(roomCode, paused);
      await loadRoomInfo();
    } catch (err: any) {
      setError(err.message || 'Ошибка установки паузы');
    }
  };

  const handleStartGame = async () => {
    if (!isMaster) return;

    try {
      await startGame(roomCode);
      await loadRoomInfo();
    } catch (err: any) {
      setError(err.message || 'Ошибка начала игры');
    }
  };

  const fullScreenWrap = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: '#f0f0f0',
    color: '#333',
  };

  if (isLoading) {
    return <div style={fullScreenWrap}>Загрузка...</div>;
  }

  if (error && !room) {
    return (
      <div style={fullScreenWrap}>
        <div style={{ color: '#dc3545', marginBottom: '15px' }}>{error}</div>
        <button onClick={onLeave}>Вернуться</button>
      </div>
    );
  }

  if (!room) {
    return <div style={fullScreenWrap}>Комната не найдена</div>;
  }

  const playersFromState = GameState?.public?.players || [];
  const showLobbyBlock = !room.gameStarted || room.isPaused;
  type DisplayPlayer = {
    id?: string;
    userId?: string;
    name?: string;
    characterId?: string;
    hp?: number;
    maxHp?: number;
    level?: number;
  };
  const displayPlayers: DisplayPlayer[] = (
    playersFromState.length > 0
      ? (playersFromState.map((p) => ({
          ...p,
          characterId: room.players.find((r) => r.userId === (p as DisplayPlayer).userId)?.characterId,
        })) as DisplayPlayer[])
      : room.players.map((p) => ({
          id: p.userId,
          userId: p.userId,
          name: p.username,
          characterId: p.characterId,
        }))
  ).filter((p) => p.userId !== room.masterId);
  const overlayAttachment =
    scenario?.attachments?.find((a) => a.id === activeAttachmentId) || null;
  const centerShowImage =
    overlayAttachment && activeAttachmentId && !overlayHidden && overlayAttachment.mimeType?.startsWith('image/');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: '#f0f0f0',
      }}
    >
      {/* Шапка: слева — ключ, статус, игроки; справа — управление и выход */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 20px',
          background: '#fff',
          borderBottom: '1px solid #dee2e6',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '18px', color: '#333' }}>Комната {room.code}</span>
          <span style={{ color: '#666', fontSize: '14px' }}>
            {room.isPaused ? '⏸️ На паузе' : room.gameStarted ? '▶️ Игра идёт' : '⏳ Ожидание'}
          </span>
          <span style={{ color: '#666', fontSize: '14px' }}>
            Игроков: {room.players.length}{room.maxPlayers ? `/${room.maxPlayers}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isMaster && (
            <>
              {!room.gameStarted && (
                <button
                  onClick={handleStartGame}
                  disabled={room.players.length < 1}
                  style={{
                    padding: '8px 16px',
                    background: room.players.length < 1 ? '#adb5bd' : '#28a745',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: room.players.length < 1 ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Начать игру
                </button>
              )}
              {room.gameStarted && (
                <button
                  onClick={() => handlePause(!room.isPaused)}
                  style={{
                    padding: '8px 16px',
                    background: room.isPaused ? '#28a745' : '#ffc107',
                    color: room.isPaused ? '#fff' : '#333',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  {room.isPaused ? '▶️ Возобновить' : '⏸️ Пауза'}
                </button>
              )}
            </>
          )}
          <button
            onClick={onLeave}
            style={{
              padding: '8px 16px',
              background: '#dc3545',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Покинуть комнату
          </button>
        </div>
      </header>

      {error && (
        <div
          style={{
            color: '#721c24',
            padding: '10px 20px',
            background: '#f8d7da',
            borderBottom: '1px solid #f5c6cb',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {!room.isActive && (
        <div
          style={{
            padding: '12px 20px',
            background: '#f8d7da',
            color: '#721c24',
            fontSize: '14px',
            borderBottom: '1px solid #f5c6cb',
          }}
        >
          <strong>⚠️ Комната закрыта.</strong> Ожидайте возвращения мастера или покиньте комнату.
        </div>
      )}

      {showLobbyBlock && (
        <div style={{ padding: '12px 20px', background: '#fff3cd', borderBottom: '1px solid #dee2e6', fontSize: '14px', color: 'black' }}>
          <strong>Игроки в лобби:</strong>{' '}
          {room.players.map((p) => p.username).join(', ')}
        </div>
      )}

      {/* Основная область: левая панель — кубики, центр — показ вложения, правая — вложения сценария */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Левая панель — кубики */}
        <aside
          style={{
            width: '220px',
            minWidth: '220px',
            padding: '16px',
            background: '#fff',
            borderRight: '1px solid #dee2e6',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <h3 style={{ color: '#333', marginBottom: '10px', fontSize: '15px' }}>Кубики</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <input
              type="text"
              value={diceInput}
              onChange={(e) => setDiceInput(e.target.value)}
              placeholder="1к8 или 2к20"
              style={{
                padding: '8px 10px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '13px',
                width: '100%',
                boxSizing: 'border-box',
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleRollDice()}
            />
            <button
              type="button"
              onClick={handleRollDice}
              disabled={!socket}
              style={{
                padding: '8px 14px',
                background: socket ? '#0d6efd' : '#adb5bd',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: socket ? 'pointer' : 'not-allowed',
                fontSize: '13px',
                width: '100%',
              }}
            >
              Бросить
            </button>
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
            1к8, 2к20 — число кубиков и граней
          </div>
          {diceLog.length > 0 && (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {[...diceLog].reverse().map((entry, i) => (
                <div
                  key={i}
                  style={{
                    padding: '6px 8px',
                    marginBottom: '4px',
                    background: '#f8f9fa',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#333',
                  }}
                >
                  <strong>{entry.username}</strong>: {entry.formula} → {entry.result.join(', ')} ={' '}
                  <strong>{entry.total}</strong>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Центр — показ вложения (всегда изображение) */}
        <section
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: centerShowImage ? '#1a1a1a' : '#e9ecef',
            padding: '16px',
          }}
        >
          {centerShowImage && overlayAttachment ? (
            <img
              src={overlayAttachment.url}
              alt={overlayAttachment.displayName ?? overlayAttachment.fileName}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          ) : overlayAttachment && activeAttachmentId && !overlayHidden && overlayAttachment.mimeType === 'application/pdf' ? (
            <div style={{ textAlign: 'center', color: '#666' }}>
              <p>Документ показан мастером.</p>
              <a href={overlayAttachment.url} target="_blank" rel="noreferrer" style={{ color: '#0d6efd' }}>
                Открыть PDF в новой вкладке
              </a>
            </div>
          ) : overlayAttachment && activeAttachmentId && !overlayHidden ? (
            <div style={{ textAlign: 'center', color: '#666' }}>
              <a href={overlayAttachment.url} target="_blank" rel="noreferrer" style={{ color: '#0d6efd' }}>
                Открыть файл в новой вкладке
              </a>
            </div>
          ) : (
            <span style={{ color: '#999', fontSize: '14px' }}>
              {room.gameStarted && room.scenarioId ? 'Мастер может показать вложение' : ''}
            </span>
          )}
        </section>

        {/* Правая панель — вложения сценария (скролл, высота 60%) */}
        <aside
          style={{
            width: '260px',
            minWidth: '260px',
            padding: '16px',
            background: '#fff',
            borderLeft: '1px solid #dee2e6',
            overflowY: 'auto',
            flexShrink: 0,
          }}
        >
          {room.scenarioId ? (
            <>
              <h3 style={{ color: '#333', marginBottom: '12px', fontSize: '15px' }}>
                Вложения {isMaster ? '(мастер)' : ''}
              </h3>
              {!scenario ? (
                <div style={{ color: '#666', fontSize: '13px' }}>Загрузка...</div>
              ) : (() => {
                const attachments = scenario?.attachments ?? [];
                const attachmentsToShow = isMaster
                  ? attachments
                  : attachments.filter((f) => unlockedAttachments.includes(f.id));
                return attachmentsToShow.length === 0 ? (
                  <div style={{ color: '#666', fontSize: '13px' }}>Нет вложений</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {attachmentsToShow.map((f) => {
                      const unlocked = unlockedAttachments.includes(f.id);
                      const isActive = activeAttachmentId === f.id;
                      const isImage = f.mimeType?.startsWith('image/');
                      const name = f.displayName ?? f.fileName;
                      return (
                        <div
                          key={f.id}
                          style={{
                            borderRadius: '6px',
                            border: '1px solid #dee2e6',
                            padding: '8px',
                            background: unlocked ? '#f8f9fa' : '#f1f1f1',
                            opacity: unlocked ? 1 : 0.7,
                          }}
                        >
                          <div
                            style={{
                              height: '80px',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              background: '#e9ecef',
                              marginBottom: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {isImage ? (
                              <img
                                src={f.url}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <span style={{ fontSize: '11px', color: '#666' }}>PDF/файл</span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              marginBottom: '6px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: '#333',
                            }}
                            title={name}
                          >
                            {name}
                          </div>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {isMaster && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!socket) return;
                                    socket.emit(unlocked ? 'scenario:lock' : 'scenario:unlock', {
                                      attachmentId: f.id,
                                    });
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: unlocked ? '#ffc107' : '#28a745',
                                    color: unlocked ? '#333' : '#fff',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {unlocked ? 'Заблок.' : 'Разблок.'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!socket) return;
                                    if (isActive) {
                                      socket.emit('scenario:hide');
                                    } else {
                                      socket.emit('scenario:show', { attachmentId: f.id });
                                    }
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: isActive ? '#6c757d' : '#007bff',
                                    color: '#fff',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {isActive ? 'Скрыть' : 'Показать'}
                                </button>
                              </>
                            )}
                            {!isMaster && unlocked && (
                              <a
                                href={f.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  background: '#007bff',
                                  color: '#fff',
                                  fontSize: '11px',
                                  textDecoration: 'none',
                                }}
                              >
                                Открыть
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          ) : (
            <div style={{ color: '#999', fontSize: '13px' }}>Сценарий не выбран</div>
          )}
        </aside>
      </main>

      {/* Футер — список персонажей (всегда внизу экрана) */}
      {displayPlayers.length > 0 && (
        <footer
          style={{
            flexShrink: 0,
            padding: '12px 20px',
            background: '#fff',
            borderTop: '1px solid #dee2e6',
            boxShadow: '0 -1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '12px',
              overflowX: 'auto',
              paddingBottom: '4px',
              alignItems: 'flex-start',
            }}
          >
            {displayPlayers.map((p, idx) => {
              const hp = p.hp ?? 0;
              const maxHp = p.maxHp ?? hp;
              const level = p.level ?? 1;
              const name = p.name || `Игрок ${idx + 1}`;
              const initial = name.charAt(0).toUpperCase();
              const characterId = p.characterId;
              const portraitUrl = characterId ? portraitUrls[characterId] : undefined;
              return (
                <div
                  key={p.id || p.userId || idx}
                  role="button"
                  tabIndex={0}
                  onClick={() => openCharacterSheet(characterId)}
                  onKeyDown={(e) => e.key === 'Enter' && openCharacterSheet(characterId)}
                  style={{
                    minWidth: '140px',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    background: '#f8f9fa',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      background: portraitUrl ? 'transparent' : '#2a5298',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      fontWeight: 700,
                      overflow: 'hidden',
                    }}
                  >
                    {portraitUrl ? (
                      <img
                        src={portraitUrl}
                        alt={name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      initial
                    )}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '14px', textAlign: 'center', color: 'black' }}>
                    {name}
                  </div>
                  <div style={{ fontSize: '13px', color: 'black' }}>Уровень: {level}</div>
                  <div style={{ fontSize: '13px', color: 'black' }}>
                    HP: {hp}/{maxHp}
                  </div>
                </div>
              );
            })}
          </div>
        </footer>
      )}

      {/* Модальное окно листа персонажа */}
      {(characterSheetLoading || characterSheetError || characterSheetView) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={(e) => e.target === e.currentTarget && !characterSheetLoading && closeCharacterSheet()}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              maxWidth: 900,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {characterSheetLoading && (
              <div style={{ padding: 48, textAlign: 'center', color: '#333' }}>Загрузка персонажа...</div>
            )}
            {characterSheetError && !characterSheetView && (
              <div style={{ padding: 24 }}>
                <div style={{ color: '#dc3545', marginBottom: 16 }}>{characterSheetError}</div>
                <button
                  onClick={closeCharacterSheet}
                  style={{
                    padding: '8px 16px',
                    background: '#6c757d',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Закрыть
                </button>
              </div>
            )}
            {characterSheetView && (
              <CharacterSheetView
                character={characterSheetView.character}
                canEdit={characterSheetView.canEdit}
                hideInventory={characterSheetView.hideInventory}
                onClose={closeCharacterSheet}
                onSave={() => {
                  closeCharacterSheet();
                  loadRoomInfo();
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

