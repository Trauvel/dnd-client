import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GameRoom } from '../../api/rooms';
import { pauseRoom, startGame, getRoomInfo } from '../../api/rooms';
import { useSocket } from '../../store/socketContext';
import { useAuth } from '../../store/authContext';
import { getScenarios, getScenarioById, type Scenario } from '../../api/scenarios';
import { getCharacterPortrait, getCharacterForView, updateCharacter, type CharacterViewResult, type Character } from '../../api/characters';
import { getProficiencyBonus, xpToLevel } from '../../utils/dndLevel';
import { type AbilityKey, WEAPON_DAMAGE_TYPE_LABELS, DND_SKILLS, ABILITY_KEYS, ABILITY_LABELS, CONDITION_OPTIONS } from '../../types/characterSheet';
import { CharacterSheetView } from '../Character/CharacterSheetView';
import type { CombatState, NpcInstance } from '../../api/socket';
import { getScenarioNpcsForView, type ScenarioNpc } from '../../api/scenarioNpcs';
import { MasterBookPanel } from './MasterBookPanel';
import { NotesBookViewPanel } from './NotesBookViewPanel';
import { DraggableWindow } from './DraggableWindow';

const DICE_SIDES = [2, 3, 4, 5, 6, 8, 10, 12, 20, 100];

interface RoomLobbyProps {
  roomCode: string;
  onLeave: () => void;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({ roomCode, onLeave }) => {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { connect, isConnected, socket, GameState, sendAction } = useSocket();
  const { user } = useAuth();
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [unlockedAttachments, setUnlockedAttachments] = useState<string[]>([]);
  const [activeAttachmentId, setActiveAttachmentId] = useState<string | null>(null);
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null);
  const [overlayHidden, setOverlayHidden] = useState(false);
  const [portraitUrls, setPortraitUrls] = useState<Record<string, string>>({});
  const [diceSides, setDiceSides] = useState<number>(20);
  const [diceCount, setDiceCount] = useState<number>(1);
  const [diceLog, setDiceLog] = useState<Array<{ username: string; formula: string; result: number[]; total: number }>>([]);
  const [diceRollOverlay, setDiceRollOverlay] = useState<{
    username: string;
    formula: string;
    result: number[];
    total: number;
  } | null>(null);
  const diceOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [characterSheetView, setCharacterSheetView] = useState<CharacterViewResult | null>(null);
  const [characterSheetLoading, setCharacterSheetLoading] = useState(false);
  const [characterSheetError, setCharacterSheetError] = useState<string | null>(null);
  const [characterPreviews, setCharacterPreviews] = useState<Record<string, Character>>({});
  const [hoveredPlayerKey, setHoveredPlayerKey] = useState<string | null>(null);
  const [tooltipShow, setTooltipShow] = useState(false);
  const [tooltipAnchorRect, setTooltipAnchorRect] = useState<DOMRect | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scenarioNpcs, setScenarioNpcs] = useState<ScenarioNpc[]>([]);
  const [scenarioNpcsLoading, setScenarioNpcsLoading] = useState(false);
  const [npcModalOpen, setNpcModalOpen] = useState(false);
  const [selectedNpcTemplateId, setSelectedNpcTemplateId] = useState<string | null>(null);
  const [npcSpawnCount, setNpcSpawnCount] = useState<number>(1);
  const [hoveredNpcId, setHoveredNpcId] = useState<string | null>(null);
  const [npcTooltipRect, setNpcTooltipRect] = useState<DOMRect | null>(null);
  const [npcDetail, setNpcDetail] = useState<ScenarioNpc | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioLoop, setAudioLoop] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const audioVolumeRef = useRef(0.5);
  const [logWindowOpen, setLogWindowOpen] = useState(false);
  const roomAudioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const roomAudioRef = useRef<HTMLAudioElement | null>(null);
  const roomAudioEndedHandlerRef = useRef<(() => void) | null>(null);
  const fallbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [playerNotesBookOpen, setPlayerNotesBookOpen] = useState(false);
  const [imagePopup, setImagePopup] = useState<{ url: string; name: string } | null>(null);
  const [hpUpdating, setHpUpdating] = useState(false);
  const [selectedWeaponIndex, setSelectedWeaponIndex] = useState(0);
  const [selectedSkillKey, setSelectedSkillKey] = useState('');
  const [selectedSaveAbility, setSelectedSaveAbility] = useState<AbilityKey>('strength');
  const [conditionsUpdating, setConditionsUpdating] = useState(false);
  const [spellSlotsUpdating, setSpellSlotsUpdating] = useState(false);
  const [combatParticipantUpdating, setCombatParticipantUpdating] = useState<string | null>(null);

  const isMaster = room && user && room.masterId === user.id;
  const masterState = GameState?.master;
  const combat: CombatState | undefined = masterState?.combat;
  const npcs: NpcInstance[] = masterState?.npcs ?? [];
  const hasBattleView = npcs.length > 0 || (combat && (combat.active || combat.order.length > 0));
  const tacticsMode = masterState?.tacticsMode ?? false;
  const tokenPositions = masterState?.tokenPositions ?? {};
  const tokenScale = masterState?.tokenScale ?? 1;
  const [draggingTokenKey, setDraggingTokenKey] = useState<string | null>(null);
  const [tokenTempPosition, setTokenTempPosition] = useState<{ x: number; y: number } | null>(null);
  const tacticsMapRef = useRef<HTMLDivElement>(null);
  const tokenDragPosRef = useRef<{ x: number; y: number } | null>(null);

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
      currentLocationId?: string | null;
    }) => {
      if (!data.scenarioId) return;
      setUnlockedAttachments(data.unlocked || []);
      setActiveAttachmentId(data.activeAttachmentId ?? null);
      if (data.currentLocationId !== undefined) setCurrentLocationId(data.currentLocationId ?? null);
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
      if (diceOverlayTimeoutRef.current) clearTimeout(diceOverlayTimeoutRef.current);
      setDiceRollOverlay(data);
      diceOverlayTimeoutRef.current = setTimeout(() => {
        setDiceRollOverlay(null);
        diceOverlayTimeoutRef.current = null;
      }, 2500);
    };

    socket.on('dice:result', handleDiceResult);

    const handleCharacterPreviewUpdate = (data: { character: Character }) => {
      if (data?.character?.id) {
        setCharacterPreviews((prev) => ({ ...prev, [data.character.id]: data.character }));
      }
    };
    socket.on('character:preview-update', handleCharacterPreviewUpdate);

    const handleAudioPlay = (data: { url: string; loop: boolean; id: string }) => {
      let el = roomAudioRef.current;
      if (!el) {
        const fallback = fallbackAudioRef.current;
        if (fallback) {
          fallback.pause();
          fallback.src = '';
        }
        fallbackAudioRef.current = new Audio(data.url);
        el = fallbackAudioRef.current;
      } else {
        if (fallbackAudioRef.current) {
          fallbackAudioRef.current.pause();
          fallbackAudioRef.current = null;
        }
        if (roomAudioEndedHandlerRef.current) {
          el.removeEventListener('ended', roomAudioEndedHandlerRef.current);
        }
      }
      el.src = data.url;
      el.loop = data.loop;
      el.currentTime = 0;
      el.volume = audioVolumeRef.current;
      roomAudioEndedHandlerRef.current = () => {
        if (!el.loop) setPlayingAudioId(null);
      };
      el.addEventListener('ended', roomAudioEndedHandlerRef.current);
      setPlayingAudioId(data.id || null);
      setAudioLoop(data.loop);
      const playWhenReady = () => {
        el.play().catch(() => {});
      };
      if (el.readyState >= 2) {
        playWhenReady();
      } else {
        el.addEventListener('canplaythrough', playWhenReady, { once: true });
      }
    };
    const handleAudioStop = () => {
      const el = roomAudioRef.current;
      if (el) {
        if (roomAudioEndedHandlerRef.current) el.removeEventListener('ended', roomAudioEndedHandlerRef.current);
        el.pause();
      }
      if (fallbackAudioRef.current) {
        fallbackAudioRef.current.pause();
        fallbackAudioRef.current.src = '';
        fallbackAudioRef.current = null;
      }
      setPlayingAudioId(null);
    };
    socket.on('audio:play', handleAudioPlay);
    socket.on('audio:stop', handleAudioStop);

    return () => {
      if (diceOverlayTimeoutRef.current) clearTimeout(diceOverlayTimeoutRef.current);
      socket.off('dice:result', handleDiceResult);
      socket.off('character:preview-update', handleCharacterPreviewUpdate);
      socket.off('room:joined', handleRoomJoined);
      socket.off('room:player-joined', handlePlayerJoined);
      socket.off('room:player-left', handlePlayerLeft);
      socket.off('room:paused', handlePaused);
      socket.off('room:resumed', handleResumed);
      socket.off('room:master-reconnected', handleMasterReconnected);
      socket.off('room:closed', handleRoomClosed);
      socket.off('room:reopened', handleRoomReopened);
      socket.off('scenario:update', handleScenarioUpdate);
      socket.off('audio:play', handleAudioPlay);
      socket.off('audio:stop', handleAudioStop);
    };
  }, [roomCode, socket]);

  // Загружаем данные сценария и список NPC сценария (для книги мастера), если есть комната с сценарием
  useEffect(() => {
    const loadScenario = async () => {
      if (!room?.scenarioId) {
        setScenario(null);
        setScenarioNpcs([]);
        return;
      }
      try {
        const list = await getScenarios();
        let found = list.find((s) => s.id === room.scenarioId) || null;
        if (!found) {
          found = await getScenarioById(room.scenarioId);
        }
        setScenario(found);
        // Загружаем NPC сценария, чтобы в «Книге» отображались карточки по локациям
        const npcList = await getScenarioNpcsForView(room.scenarioId);
        setScenarioNpcs(npcList);
      } catch {
        setScenario(null);
        setScenarioNpcs([]);
      }
    };
    loadScenario();
  }, [room?.scenarioId]);

  // Предзагрузка аудио сценария, чтобы при нажатии «Играть» звук шёл сразу у всех
  const scenarioAudioIdsKey = useMemo(
    () => (scenario?.audios ?? []).map((a) => a.id).sort().join(','),
    [scenario?.id, scenario?.audios]
  );
  useEffect(() => {
    const audios = scenario?.audios ?? [];
    if (audios.length === 0) {
      roomAudioRefs.current = {};
      return;
    }
    const next: Record<string, HTMLAudioElement> = {};
    audios.forEach((a) => {
      const el = new Audio(a.url);
      el.preload = 'auto';
      next[a.id] = el;
    });
    roomAudioRefs.current = next;
    return () => {
      Object.values(roomAudioRefs.current).forEach((el) => el.pause());
      roomAudioRefs.current = {};
    };
  }, [scenarioAudioIdsKey, scenario?.audios]);

  useEffect(() => {
    audioVolumeRef.current = audioVolume;
    const el = roomAudioRef.current;
    if (el) el.volume = audioVolume;
    if (fallbackAudioRef.current) fallbackAudioRef.current.volume = audioVolume;
  }, [audioVolume]);

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

  // Подгружаем данные персонажей: для списка (имя, HP) и для мастера — тултип
  const roomPlayerCharacterIds = useMemo(() => (room?.players ?? []).map((p) => p.characterId).filter(Boolean) as string[], [room?.players]);
  useEffect(() => {
    if (!roomCode || roomPlayerCharacterIds.length === 0) return;
    let cancelled = false;
    roomPlayerCharacterIds.forEach((cid) => {
      getCharacterForView(cid, roomCode)
        .then((r) => { if (!cancelled) setCharacterPreviews((prev) => ({ ...prev, [cid]: r.character })); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [roomCode, roomPlayerCharacterIds.join(',')]);

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    };
  }, []);

  // Драг токена на тактической карте (мастер — любой токен, игрок — только свой)
  const canDragToken = (key: string) => isMaster || key === `pc-${user?.id}`;
  useEffect(() => {
    if (!draggingTokenKey || !sendAction) return;
    if (!canDragToken(draggingTokenKey)) return;
    const onMove = (e: MouseEvent) => {
      const el = tacticsMapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      tokenDragPosRef.current = { x, y };
      setTokenTempPosition({ x, y });
    };
    const onUp = () => {
      const pos = tokenDragPosRef.current;
      if (pos && draggingTokenKey) sendAction('tactics:moveToken', { tokenKey: draggingTokenKey, x: pos.x, y: pos.y });
      tokenDragPosRef.current = null;
      setDraggingTokenKey(null);
      setTokenTempPosition(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingTokenKey, sendAction, isMaster, user?.id]);

  const getModifier = (n: number) => (Math.floor((n - 10) / 2) >= 0 ? `+${Math.floor((n - 10) / 2)}` : `${Math.floor((n - 10) / 2)}`);

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

  const loadScenarioNpcsForRoom = async () => {
    if (!room?.scenarioId || !isMaster) return;
    setScenarioNpcsLoading(true);
    try {
      const list = await getScenarioNpcsForView(room.scenarioId);
      setScenarioNpcs(list);
      if (list.length > 0 && !selectedNpcTemplateId) {
        setSelectedNpcTemplateId(list[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки NPC сценария');
    } finally {
      setScenarioNpcsLoading(false);
    }
  };

  const handleRollDice = () => {
    if (!socket) return;
    const normalized = `${diceCount}к${diceSides}`;
    const { result, total } = rollDiceLocal(diceCount, diceSides);
    socket.emit('dice:roll', { formula: normalized, result, total });
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
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: '#f0f0f0',
    color: '#333',
    boxSizing: 'border-box' as const,
  };

  // Всегда оборачиваем в контейнер с фоном, чтобы при навигации не было чёрного экрана
  const rootWrap = { minHeight: '100vh', width: '100%', background: '#f0f0f0', boxSizing: 'border-box' as const };

  if (isLoading) {
    return (
      <div style={rootWrap}>
        <div style={fullScreenWrap}>Загрузка...</div>
      </div>
    );
  }

  if (error && !room) {
    return (
      <div style={rootWrap}>
        <div style={fullScreenWrap}>
          <div style={{ color: '#dc3545', marginBottom: '15px' }}>{error}</div>
          <button onClick={onLeave}>Вернуться</button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div style={rootWrap}>
        <div style={fullScreenWrap}>Комната не найдена</div>
      </div>
    );
  }

  const showLobbyBlock = !room.gameStarted || room.isPaused;
  type DisplayPlayer = {
    id: string;
    userId: string;
    name: string;
    characterId?: string;
    role: 'master' | 'player';
  };
  const displayPlayers: DisplayPlayer[] = (
    room.players.map((p) => ({
      id: p.userId,
      userId: p.userId,
      name: p.username,
      characterId: p.characterId,
      role: p.role,
    }))
  ).filter((p) => p.role === 'player');
  const myPlayer = displayPlayers.find((p) => p.userId === user?.id);
  const myCharacter = myPlayer?.characterId && characterPreviews[myPlayer.characterId] ? characterPreviews[myPlayer.characterId] : null;

  const handleHpChange = async (delta: number) => {
    if (!myPlayer?.characterId || !myCharacter || hpUpdating) return;
    const newHp = Math.max(0, Math.min(myCharacter.maxHp ?? 999, (myCharacter.hp ?? 0) + delta));
    setHpUpdating(true);
    try {
      const updated = await updateCharacter(myPlayer.characterId, { hp: newHp }, roomCode);
      setCharacterPreviews((prev) => ({ ...prev, [myPlayer.characterId!]: updated }));
      socket?.emit('character:preview-update', { character: updated });
    } catch {
      // ошибка — не обновляем локально
    } finally {
      setHpUpdating(false);
    }
  };

  const getAbilityScore = (c: Character, ability: AbilityKey): number => {
    const v = c[ability];
    return typeof v === 'number' ? v : 10;
  };
  const getAbilityMod = (score: number): number => Math.floor((score - 10) / 2);

  const weaponsFromSheet = (() => {
    const raw = myCharacter?.characterData as Record<string, unknown> | undefined;
    const list = raw?.weapons;
    if (!Array.isArray(list) || list.length === 0) return [];
    const dmgTypes = ['piercing', 'slashing', 'bludgeoning', 'other'];
    return list.map((w: any) => ({
      name: typeof w?.name === 'string' ? w.name : 'Оружие',
      damage: typeof w?.damage === 'string' ? w.damage : '',
      attackModifier: typeof w?.attackModifier === 'string' ? w.attackModifier : undefined,
      proficient: !!w?.proficient,
      ability: (w?.ability && ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].includes(w.ability)) ? w.ability : 'strength' as AbilityKey,
      damageType: (w?.damageType && dmgTypes.includes(w.damageType)) ? w.damageType : undefined as string | undefined,
    }));
  })();

  const safeWeaponIndex = weaponsFromSheet.length > 0 ? Math.min(selectedWeaponIndex, weaponsFromSheet.length - 1) : 0;
  const selectedWeapon = weaponsFromSheet[safeWeaponIndex] ?? null;

  /** Парсит формулу кубиков: число + буква (к, d, k и т.д.) + число. Напр. 1к10, 2d6, 1к6 */
  const parseDamageDice = (s: string): { count: number; sides: number } | null => {
    const m = /^(\d+)\D+(\d+)$/.exec((s || '').trim());
    if (!m) return null;
    const count = Math.min(20, Math.max(1, parseInt(m[1], 10)));
    const sides = [2, 3, 4, 5, 6, 8, 10, 12, 20, 100].includes(Number(m[2])) ? parseInt(m[2], 10) : 6;
    return { count, sides };
  };

  /**
   * Парсит хиты из строки и возвращает результат для спавна NPC.
   * Формат "9 (2к8)": 9 — минимум, бросок 2к8; итог = max(9, бросок).
   * Формат "2к8" или "2d8+3": просто бросок.
   */
  const parseAndRollHp = (hpText: string | null | undefined): number | null => {
    const raw = (hpText || '').trim().replace(/\s+/g, ' ');
    if (!raw) return null;

    const minAndDice = raw.match(/^(\d+)\s*\((.+)\)\s*$/);
    let minimum: number | null = null;
    let dicePart = raw;
    if (minAndDice) {
      minimum = parseInt(minAndDice[1], 10);
      dicePart = minAndDice[2].trim();
    }

    const diceMatch = dicePart.match(/(\d+)[кdkКD](\d+)([+-]\d+)?/i);
    if (!diceMatch) return minimum != null ? Math.max(1, minimum) : null;
    const count = Math.min(20, Math.max(1, parseInt(diceMatch[1], 10)));
    const sides = [2, 3, 4, 5, 6, 8, 10, 12, 20, 100].includes(Number(diceMatch[2])) ? parseInt(diceMatch[2], 10) : 6;
    const { total } = rollDiceLocal(count, sides);
    let mod = 0;
    if (diceMatch[3]) {
      const modStr = diceMatch[3];
      mod = (modStr.startsWith('-') ? -1 : 1) * (parseInt(modStr.slice(1), 10) || 0);
    }
    const rolled = Math.max(1, total + mod);
    const result = minimum != null ? Math.max(minimum, rolled) : rolled;
    return Math.max(1, result);
  };

  const handleWeaponAttack = () => {
    if (!socket || !myCharacter || !selectedWeapon) return;
    const level = xpToLevel(myCharacter.experience ?? 0);
    const profBonus = getProficiencyBonus(level);
    const abilityScore = getAbilityScore(myCharacter, selectedWeapon.ability);
    const abilityMod = getAbilityMod(abilityScore);
    let attackMod = abilityMod;
    if (selectedWeapon.attackModifier !== undefined && selectedWeapon.attackModifier !== null && String(selectedWeapon.attackModifier).trim() !== '') {
      const s = String(selectedWeapon.attackModifier).trim();
      const m = /([+-])?(\d+)/.exec(s);
      if (m) {
        const n = parseInt(m[2], 10);
        attackMod = m[1] === '-' ? -n : n;
      } else if (selectedWeapon.proficient) {
        attackMod += profBonus;
      }
    } else if (selectedWeapon.proficient) {
      attackMod += profBonus;
    }
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + attackMod;
    const typeLabel = selectedWeapon.damageType && WEAPON_DAMAGE_TYPE_LABELS[selectedWeapon.damageType as keyof typeof WEAPON_DAMAGE_TYPE_LABELS] ? `, ${WEAPON_DAMAGE_TYPE_LABELS[selectedWeapon.damageType as keyof typeof WEAPON_DAMAGE_TYPE_LABELS]}` : '';
    const formula = `Атака (${selectedWeapon.name}${typeLabel}): ${total}`;
    socket.emit('dice:roll', { formula, result: [d20], total });
  };

  const sheetData = (() => {
    const raw = myCharacter?.characterData as Record<string, unknown> | undefined;
    if (!raw || typeof raw !== 'object') return null;
    return {
      skillProficiencies: (raw.skillProficiencies as string[] | undefined) ?? [],
      savingThrowProficiencies: (raw.savingThrowProficiencies as string[] | undefined) ?? [],
      conditions: (raw.conditions as string[] | undefined) ?? [],
      spellSlots: (raw.spellSlots as { level: number; total: number; used: number }[] | undefined) ?? [],
    };
  })();

  const handleSkillCheck = () => {
    if (!socket || !myCharacter || !selectedSkillKey) return;
    const skill = DND_SKILLS.find((s) => s.key === selectedSkillKey);
    if (!skill) return;
    const level = xpToLevel(myCharacter.experience ?? 0);
    const profBonus = getProficiencyBonus(level);
    const abilityScore = getAbilityScore(myCharacter, skill.ability);
    const abilityMod = getAbilityMod(abilityScore);
    const proficient = sheetData?.skillProficiencies?.includes(skill.key) ?? false;
    const mod = abilityMod + (proficient ? profBonus : 0);
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + mod;
    const formula = `Проверка (${skill.name}): ${total}`;
    socket.emit('dice:roll', { formula, result: [d20], total });
  };

  const handleSavingThrow = () => {
    if (!socket || !myCharacter) return;
    const level = xpToLevel(myCharacter.experience ?? 0);
    const profBonus = getProficiencyBonus(level);
    const abilityScore = getAbilityScore(myCharacter, selectedSaveAbility);
    const abilityMod = getAbilityMod(abilityScore);
    const proficient = sheetData?.savingThrowProficiencies?.includes(selectedSaveAbility) ?? false;
    const mod = abilityMod + (proficient ? profBonus : 0);
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + mod;
    const formula = `Спасбросок (${ABILITY_LABELS[selectedSaveAbility]}): ${total}`;
    socket.emit('dice:roll', { formula, result: [d20], total });
  };

  const handleConditionToggle = async (key: string, checked: boolean) => {
    if (!myPlayer?.characterId || !myCharacter || conditionsUpdating) return;
    const current = (myCharacter.characterData as Record<string, unknown>) ?? {};
    const list: string[] = Array.isArray(current.conditions) ? [...(current.conditions as string[])] : [];
    const next = checked ? (list.includes(key) ? list : [...list, key]) : list.filter((c) => c !== key);
    setConditionsUpdating(true);
    try {
      const updated = await updateCharacter(myPlayer.characterId, { characterData: { ...current, conditions: next } }, roomCode);
      setCharacterPreviews((prev) => ({ ...prev, [myPlayer.characterId!]: updated }));
      socket?.emit('character:preview-update', { character: updated });
    } catch {
      // ignore
    } finally {
      setConditionsUpdating(false);
    }
  };

  const handleSpendSpellSlot = async (level: number) => {
    if (!myPlayer?.characterId || !myCharacter || spellSlotsUpdating) return;
    const raw = (myCharacter.characterData as Record<string, unknown>) ?? {};
    const slots: { level: number; total: number; used: number }[] = Array.isArray(raw.spellSlots) ? [...(raw.spellSlots as { level: number; total: number; used: number }[])] : [];
    const idx = slots.findIndex((s) => s.level === level);
    if (idx < 0) return;
    const slot = slots[idx];
    if (slot.used >= slot.total) return;
    const nextSlots = slots.map((s, i) => (i === idx ? { ...s, used: s.used + 1 } : s));
    setSpellSlotsUpdating(true);
    try {
      const updated = await updateCharacter(myPlayer.characterId, { characterData: { ...raw, spellSlots: nextSlots } }, roomCode);
      setCharacterPreviews((prev) => ({ ...prev, [myPlayer.characterId!]: updated }));
      socket?.emit('character:preview-update', { character: updated });
    } catch {
      // ignore
    } finally {
      setSpellSlotsUpdating(false);
    }
  };

  const participantKey = (p: { kind: string; id: string }) => `${p.kind}-${p.id}`;

  const handleCombatParticipantHp = (p: import('../../api/socket').CombatParticipant, delta: number) => {
    if (!sendAction || !combat?.order) return;
    const currentHp = p.hp ?? 0;
    const maxHp = p.maxHp ?? 999;
    const newHp = Math.max(0, Math.min(maxHp, currentHp + delta));
    const key = participantKey(p);
    setCombatParticipantUpdating(key);
    sendAction('combat:updateParticipant', { participantId: p.id, kind: p.kind, hp: newHp, roomCode });
    setCombatParticipantUpdating(null);
  };
  const handleCombatParticipantEffect = (p: import('../../api/socket').CombatParticipant, effectKey: string, checked: boolean) => {
    if (!sendAction) return;
    const next = Array.isArray(p.effects) ? [...p.effects] : [];
    if (checked) next.push(effectKey); else next.splice(next.indexOf(effectKey), 1);
    sendAction('combat:updateParticipant', { participantId: p.id, kind: p.kind, effects: next, roomCode });
  };

  const handleWeaponDamage = () => {
    if (!socket || !myCharacter || !selectedWeapon) return;
    const parsed = parseDamageDice(selectedWeapon.damage);
    if (!parsed) {
      const fallback = rollDiceLocal(1, 6);
      const typeLabel = selectedWeapon.damageType && WEAPON_DAMAGE_TYPE_LABELS[selectedWeapon.damageType as keyof typeof WEAPON_DAMAGE_TYPE_LABELS] ? `, ${WEAPON_DAMAGE_TYPE_LABELS[selectedWeapon.damageType as keyof typeof WEAPON_DAMAGE_TYPE_LABELS]}` : '';
      socket.emit('dice:roll', { formula: `Урон (${selectedWeapon.name}${typeLabel}) 1к6: ${fallback.total}`, result: fallback.result, total: fallback.total });
      return;
    }
    const abilityScore = getAbilityScore(myCharacter, selectedWeapon.ability);
    const abilityMod = getAbilityMod(abilityScore);
    const { result, total: diceTotal } = rollDiceLocal(parsed.count, parsed.sides);
    const total = diceTotal + abilityMod;
    const typeLabel = selectedWeapon.damageType && WEAPON_DAMAGE_TYPE_LABELS[selectedWeapon.damageType as keyof typeof WEAPON_DAMAGE_TYPE_LABELS] ? `, ${WEAPON_DAMAGE_TYPE_LABELS[selectedWeapon.damageType as keyof typeof WEAPON_DAMAGE_TYPE_LABELS]}` : '';
    const formula = `Урон (${selectedWeapon.name}${typeLabel}) ${selectedWeapon.damage}${abilityMod >= 0 ? '+' : ''}${abilityMod}: ${total}`;
    socket.emit('dice:roll', { formula, result, total });
  };

  const overlayAttachment =
    scenario?.attachments?.find((a) => a.id === activeAttachmentId) || null;
  const centerShowImage =
    overlayAttachment && activeAttachmentId && !overlayHidden && overlayAttachment.mimeType?.startsWith('image/');

  return (
    <div style={rootWrap}>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        height: '100vh',
        overflow: 'hidden',
        background: '#f0f0f0',
        boxSizing: 'border-box',
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
          {currentLocationId && scenario?.scriptData?.locations && (() => {
            const loc = scenario.scriptData.locations.find((l) => l.id === currentLocationId);
            return loc ? (
              <span style={{ color: '#555', fontSize: '14px' }} title="Текущая локация">
                Локация: {loc.title || '—'}
              </span>
            ) : null;
          })()}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setLogWindowOpen(true)}
            style={{
              padding: '8px 16px',
              background: '#6f42c1',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Логи
          </button>
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

      {diceRollOverlay &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)',
            }}
            onClick={() => {
              setDiceRollOverlay(null);
              if (diceOverlayTimeoutRef.current) {
                clearTimeout(diceOverlayTimeoutRef.current);
                diceOverlayTimeoutRef.current = null;
              }
            }}
          >
            <div
              style={{
                background: '#2d2d2d',
                borderRadius: 16,
                padding: '24px 32px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                minWidth: 200,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 14, color: '#aaa' }}>
                {diceRollOverlay.username} · {diceRollOverlay.formula}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  justifyContent: 'center',
                }}
              >
                {diceRollOverlay.result.map((value, i) => (
                  <div
                    key={i}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 10,
                      background: 'linear-gradient(145deg, #fff 0%, #e8e8e8 100%)',
                      color: '#1a1a1a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                      fontWeight: 700,
                      boxShadow: '0 4px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.8)',
                      animation: 'dice-roll-in 0.5s ease-out forwards',
                      animationDelay: `${i * 0.08}s`,
                      opacity: 0,
                    }}
                  >
                    {value}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
                Сумма: {diceRollOverlay.total}
              </div>
            </div>
          </div>,
          document.body
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
        {/* Скрытый аудио для воспроизведения треков комнаты — всегда в DOM, чтобы ref был при первом audio:play */}
        <audio ref={roomAudioRef} preload="auto" style={{ position: 'absolute', left: -9999, width: 0, height: 0 }} />
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <select
              value={diceCount}
              onChange={(e) => setDiceCount(Number(e.target.value))}
              style={{
                padding: '8px 10px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '13px',
                flex: '1',
                minWidth: '60px',
                boxSizing: 'border-box',
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <select
              value={diceSides}
              onChange={(e) => setDiceSides(Number(e.target.value))}
              style={{
                padding: '8px 10px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '13px',
                flex: '1',
                minWidth: '70px',
                boxSizing: 'border-box',
              }}
            >
              {DICE_SIDES.map((s) => (
                <option key={s} value={s}>d{s}</option>
              ))}
            </select>
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
          {!isMaster && myCharacter && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#495057', marginBottom: '8px', textTransform: 'uppercase' }}>
                Персонаж
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>
                HP: {myCharacter.hp ?? 0} / {myCharacter.maxHp ?? 0}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => handleHpChange(-5)}
                  disabled={hpUpdating || (myCharacter.hp ?? 0) <= 0}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', background: '#dc3545', color: '#fff', fontSize: '13px', cursor: hpUpdating ? 'wait' : 'pointer', fontWeight: 600 }}
                >
                  −5
                </button>
                <button
                  type="button"
                  onClick={() => handleHpChange(-1)}
                  disabled={hpUpdating || (myCharacter.hp ?? 0) <= 0}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', background: '#fd7e14', color: '#fff', fontSize: '13px', cursor: hpUpdating ? 'wait' : 'pointer', fontWeight: 600 }}
                >
                  −1
                </button>
                <button
                  type="button"
                  onClick={() => handleHpChange(1)}
                  disabled={hpUpdating}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', background: '#28a745', color: '#fff', fontSize: '13px', cursor: hpUpdating ? 'wait' : 'pointer', fontWeight: 600 }}
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => handleHpChange(5)}
                  disabled={hpUpdating}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', background: '#28a745', color: '#fff', fontSize: '13px', cursor: hpUpdating ? 'wait' : 'pointer', fontWeight: 600 }}
                >
                  +5
                </button>
              </div>
            </div>
          )}
          {!isMaster && myCharacter && weaponsFromSheet.length > 0 && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#495057', marginBottom: '8px', textTransform: 'uppercase' }}>
                Оружие
              </div>
              <select
                value={safeWeaponIndex}
                onChange={(e) => setSelectedWeaponIndex(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #ced4da',
                  fontSize: '13px',
                  marginBottom: '8px',
                  boxSizing: 'border-box',
                }}
              >
                {weaponsFromSheet.map((w, i) => (
                  <option key={i} value={i}>{w.name || `Оружие ${i + 1}`}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleWeaponAttack}
                  disabled={!socket}
                  style={{ flex: 1, minWidth: '70px', padding: '6px 10px', borderRadius: '6px', border: 'none', background: socket ? '#0d6efd' : '#adb5bd', color: '#fff', fontSize: '12px', cursor: socket ? 'pointer' : 'not-allowed', fontWeight: 600 }}
                >
                  Атака
                </button>
                <button
                  type="button"
                  onClick={handleWeaponDamage}
                  disabled={!socket}
                  style={{ flex: 1, minWidth: '70px', padding: '6px 10px', borderRadius: '6px', border: 'none', background: socket ? '#6f42c1' : '#adb5bd', color: '#fff', fontSize: '12px', cursor: socket ? 'pointer' : 'not-allowed', fontWeight: 600 }}
                >
                  Урон
                </button>
              </div>
            </div>
          )}
          {!isMaster && myCharacter && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#495057', marginBottom: '8px', textTransform: 'uppercase' }}>
                Проверка навыка
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <select
                  value={selectedSkillKey}
                  onChange={(e) => setSelectedSkillKey(e.target.value)}
                  style={{ flex: 1, minWidth: '100px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '12px', boxSizing: 'border-box' }}
                >
                  <option value="">— навык</option>
                  {DND_SKILLS.map((s) => (
                    <option key={s.key} value={s.key}>{s.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleSkillCheck}
                  disabled={!socket || !selectedSkillKey}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', background: socket && selectedSkillKey ? '#17a2b8' : '#adb5bd', color: '#fff', fontSize: '12px', cursor: socket && selectedSkillKey ? 'pointer' : 'not-allowed', fontWeight: 600 }}
                >
                  Бросок
                </button>
              </div>
            </div>
          )}
          {!isMaster && myCharacter && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#495057', marginBottom: '8px', textTransform: 'uppercase' }}>
                Спасбросок
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <select
                  value={selectedSaveAbility}
                  onChange={(e) => setSelectedSaveAbility(e.target.value as AbilityKey)}
                  style={{ flex: 1, minWidth: '80px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '12px', boxSizing: 'border-box' }}
                >
                  {ABILITY_KEYS.map((key) => (
                    <option key={key} value={key}>{ABILITY_LABELS[key]}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleSavingThrow}
                  disabled={!socket}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', background: socket ? '#17a2b8' : '#adb5bd', color: '#fff', fontSize: '12px', cursor: socket ? 'pointer' : 'not-allowed', fontWeight: 600 }}
                >
                  Бросок
                </button>
              </div>
            </div>
          )}
          {!isMaster && myCharacter && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#495057', marginBottom: '8px', textTransform: 'uppercase' }}>
                Состояния
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {CONDITION_OPTIONS.map((opt) => {
                  const checked = sheetData?.conditions?.includes(opt.key) ?? false;
                  return (
                    <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: conditionsUpdating ? 'wait' : 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => handleConditionToggle(opt.key, e.target.checked)}
                        disabled={conditionsUpdating}
                      />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {!isMaster && myCharacter && (sheetData?.spellSlots?.filter((s) => s.total > 0)?.length ?? 0) > 0 && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#495057', marginBottom: '8px', textTransform: 'uppercase' }}>
                Слоты заклинаний
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                {(sheetData!.spellSlots!.filter((s) => s.total > 0)).map((slot) => {
                  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][slot.level - 1] ?? String(slot.level);
                  const canSpend = slot.used < slot.total && !spellSlotsUpdating;
                  return (
                    <div key={slot.level} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                      <span style={{ minWidth: '48px' }}>{roman}: {slot.total - slot.used}/{slot.total}</span>
                      <button
                        type="button"
                        onClick={() => handleSpendSpellSlot(slot.level)}
                        disabled={!canSpend}
                        style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', background: canSpend ? '#6f42c1' : '#adb5bd', color: '#fff', fontSize: '11px', cursor: canSpend ? 'pointer' : 'not-allowed' }}
                      >
                        −1
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setLogWindowOpen(true)}
            style={{
              marginTop: '10px',
              padding: '8px 12px',
              width: '100%',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              background: '#f8f9fa',
              fontSize: '13px',
              cursor: 'pointer',
              color: '#495057',
            }}
          >
            Логи {diceLog.length > 0 ? `(${diceLog.length})` : ''}
          </button>
        </aside>

        {/* Центр — режим тактики (карта + токены) или зона боя или вложение */}
        <section
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: (tacticsMode && centerShowImage) || centerShowImage ? '#1a1a1a' : '#e9ecef',
            padding: '16px',
          }}
        >
          {tacticsMode && centerShowImage && overlayAttachment ? (
            <div
              ref={tacticsMapRef}
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 800,
                aspectRatio: '4/3',
                maxHeight: '60vh',
                margin: '0 auto',
                background: '#1a1a1a',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <img
                src={overlayAttachment.url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
              />
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
                {(() => {
                  const order = combat?.order ?? [];
                  const inCombat = order.length > 0;
                  const tokenParticipants = inCombat
                    ? order
                    : displayPlayers.map((dp) => ({ id: dp.userId, kind: 'pc' as const, name: characterPreviews[dp.characterId!]?.characterName ?? dp.name ?? 'Игрок' }));
                      return tokenParticipants.map((p, index) => {
                        const key = participantKey(p);
                        const isNpc = p.kind === 'npc';
                        const npc = isNpc ? npcs.find((n) => n.id === p.id) : undefined;
                        const pc = !isNpc ? displayPlayers.find((dp) => dp.userId === p.id) : undefined;
                        const ch = pc?.characterId ? characterPreviews[pc.characterId] : null;
                        const name = ch?.characterName ?? p.name ?? pc?.name ?? `Участник ${index + 1}`;
                        const imageUrl = isNpc ? npc?.imageUrl : (pc?.characterId ? portraitUrls[pc.characterId] : undefined);
                        const pos = draggingTokenKey === key && tokenTempPosition ? tokenTempPosition : (tokenPositions[key] ?? { x: 20 + (index % 6) * 14, y: 25 + Math.floor(index / 6) * 22 });
                        const size = Math.max(24, Math.min(80, 48 * tokenScale));
                        return (
                          <div
                            key={key}
                            onMouseDown={(e) => { if (canDragToken(key) && e.button === 0) { e.preventDefault(); setDraggingTokenKey(key); tokenDragPosRef.current = { x: pos.x, y: pos.y }; setTokenTempPosition({ x: pos.x, y: pos.y }); } }}
                            style={{
                              position: 'absolute',
                              left: `${pos.x}%`,
                              top: `${pos.y}%`,
                              transform: 'translate(-50%, -50%)',
                              width: size,
                              height: size,
                              borderRadius: '50%',
                              overflow: 'hidden',
                              border: '2px solid #fff',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                              cursor: canDragToken(key) ? 'grab' : 'default',
                              background: '#2a5298',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: Math.round(size * 0.45),
                              fontWeight: 700,
                              userSelect: 'none',
                            }}
                          >
                            {imageUrl ? <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name.charAt(0).toUpperCase()}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
          ) : hasBattleView ? (
            <div style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ color: '#fff', fontSize: 14 }}>
                  <strong style={{color:'black'}}>{combat?.active ? 'Бой идёт' : 'NPC на поле, бой ещё не начат'}</strong>
                  {combat?.timerStartedAt && combat.active && (
                    <span style={{ marginLeft: 8, fontSize: 13, color:'black' }}>(таймер хода отображается у клиентов)</span>
                  )}
                </div>
                {isMaster && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {!combat?.active && (
                      <button
                        type="button"
                        onClick={() => { if (!sendAction) return; sendAction('combat:start', {}); }}
                        style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#28a745', color: '#fff', fontSize: 12, cursor: 'pointer' }}
                      >
                        Начать бой
                      </button>
                    )}
                    {combat?.active && (
                      <>
                        <button type="button" onClick={() => { if (!sendAction) return; sendAction('combat:next', {}); }} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#0d6efd', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Следующий ход</button>
                        <button type="button" onClick={() => { if (!sendAction) return; sendAction('combat:end', {}); }} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#dc3545', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Закончить бой</button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-start' }}>
                {(combat?.order ?? []).map((p, index) => {
                  const isCurrent = (combat?.turnIndex ?? 0) === index;
                  const isNpc = p.kind === 'npc';
                  const npc = isNpc ? npcs.find((n) => n.id === p.id) : undefined;
                  const pc = !isNpc ? displayPlayers.find((dp) => dp.userId === p.id) : undefined;
                  const ch = pc?.characterId ? characterPreviews[pc.characterId] : null;
                  const name = ch?.characterName || p.name || pc?.name || `Участник ${index + 1}`;
                  const hp = p.hp ?? npc?.hp ?? ch?.hp;
                  const maxHp = p.maxHp ?? npc?.maxHp ?? ch?.maxHp;
                  const imageUrl = isNpc ? npc?.imageUrl : (pc?.characterId ? portraitUrls[pc.characterId] : undefined);
                  return (
                    <div
                      key={`${p.kind}-${p.id}`}
                      style={{
                        position: 'relative',
                        width: 140,
                        padding: 8,
                        borderRadius: 8,
                        border: isCurrent ? '2px solid #0d6efd' : '1px solid #ddd',
                        background: isCurrent ? '#e7f1ff' : '#fff',
                        boxShadow: isCurrent ? '0 0 0 2px rgba(13,110,253,0.2)' : 'none',
                        opacity: p.isDead ? 0.6 : 1,
                        cursor: isMaster && isNpc ? 'pointer' : 'default',
                      }}
                      onMouseEnter={(e) => {
                        if (!isMaster || !isNpc) return;
                        const el = e.currentTarget as HTMLElement;
                        setHoveredNpcId(npc?.id || p.id);
                        setNpcTooltipRect(el.getBoundingClientRect());
                      }}
                      onMouseLeave={() => {
                        if (!isMaster || !isNpc) return;
                        setHoveredNpcId(null);
                        setNpcTooltipRect(null);
                      }}
                      onClick={() => {
                        if (!isMaster || !isNpc) return;
                        const tpl = npc?.templateId
                          ? scenarioNpcs.find((t) => t.id === npc.templateId)
                          : undefined;
                        if (tpl) {
                          setNpcDetail(tpl);
                        } else {
                          // Фоллбек из боевого NPC, если шаблон не найден
                          setNpcDetail({
                            id: npc?.id || p.id,
                            scenarioId: room.scenarioId || '',
                            name,
                            type: undefined,
                            armorClass: npc?.armorClass ?? undefined,
                            armorClassText: undefined,
                            hpAverage: npc?.maxHp ?? undefined,
                            hpText: undefined,
                            speed: npc?.speed != null ? String(npc.speed) : undefined,
                            strength: undefined,
                            dexterity: undefined,
                            constitution: undefined,
                            intelligence: undefined,
                            wisdom: undefined,
                            charisma: undefined,
                            skills: undefined,
                            senses: undefined,
                            languages: undefined,
                            xp: undefined,
                            challenge: undefined,
                            habitat: undefined,
                            traits: undefined,
                            abilities: undefined,
                            actions: undefined,
                            legendaryActions: undefined,
                            description: undefined,
                            imageUrl: npc?.imageUrl ?? undefined,
                            imageFileId: undefined,
                          });
                        }
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: -8,
                          left: -8,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: '#0d6efd',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {index + 1}
                      </div>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: isNpc ? 6 : 24,
                          overflow: 'hidden',
                          background: '#2a5298',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 22,
                          fontWeight: 700,
                          margin: '0 auto 4px',
                        }}
                      >
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13, textAlign: 'center', color: '#000' }}>{name}</div>
                      <div style={{ fontSize: 11, color: '#333', marginTop: 2, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
                        {isMaster ? (
                          <>
                            <label style={{ whiteSpace: 'nowrap' }}>Инит:</label>
                            <input
                              type="number"
                              value={p.initiative}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                if (!Number.isNaN(v) && sendAction) sendAction('combat:setInitiative', { participantId: p.id, kind: p.kind, initiative: v });
                              }}
                              style={{ width: 44, padding: '2px 4px', fontSize: 11, textAlign: 'center', borderRadius: 4, border: '1px solid #ccc' }}
                            />
                          </>
                        ) : (
                          <>Инит: {p.initiative >= 0 ? `+${p.initiative}` : p.initiative}</>
                        )}
                      </div>
                      {hp != null && maxHp != null && (
                        <div style={{ fontSize: 11, color: '#333', textAlign: 'center' }}>
                          HP: {hp}/{maxHp}
                        </div>
                      )}
                      {isMaster && (
                        <div style={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleCombatParticipantHp(p, -5); }} disabled={combatParticipantUpdating === participantKey(p) || (hp ?? 0) <= 0} style={{ padding: '2px 6px', borderRadius: 4, border: 'none', background: '#dc3545', color: '#fff', fontSize: 10, cursor: 'pointer' }}>−5</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleCombatParticipantHp(p, -1); }} disabled={combatParticipantUpdating === participantKey(p) || (hp ?? 0) <= 0} style={{ padding: '2px 6px', borderRadius: 4, border: 'none', background: '#fd7e14', color: '#fff', fontSize: 10, cursor: 'pointer' }}>−1</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleCombatParticipantHp(p, 1); }} disabled={combatParticipantUpdating === participantKey(p)} style={{ padding: '2px 6px', borderRadius: 4, border: 'none', background: '#28a745', color: '#fff', fontSize: 10, cursor: 'pointer' }}>+1</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleCombatParticipantHp(p, 5); }} disabled={combatParticipantUpdating === participantKey(p)} style={{ padding: '2px 6px', borderRadius: 4, border: 'none', background: '#28a745', color: '#fff', fontSize: 10, cursor: 'pointer' }}>+5</button>
                        </div>
                      )}
                      {isMaster && (
                        <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
                          {CONDITION_OPTIONS.map((opt) => {
                            const checked = (p.effects ?? []).includes(opt.key);
                            return (
                              <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                                <input type="checkbox" checked={checked} onChange={(e) => handleCombatParticipantEffect(p, opt.key, e.target.checked)} />
                                {opt.label}
                              </label>
                            );
                          })}
                        </div>
                      )}
                      {isMaster && isNpc && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!sendAction) return;
                            sendAction('npc:toggleDead', { npcId: p.id });
                          }}
                          style={{
                            marginTop: 6,
                            width: '100%',
                            padding: '3px 0',
                            borderRadius: 4,
                            border: 'none',
                            background: p.isDead ? '#20c997' : '#dc3545',
                            color: '#fff',
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          {p.isDead ? 'Возродить' : 'Убить'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : centerShowImage && overlayAttachment ? (
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
              {isMaster && (
                <div style={{ marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #dee2e6' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', cursor: 'pointer', color: '#333', marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      checked={tacticsMode}
                      onChange={() => sendAction?.('tactics:toggle', {})}
                    />
                    Режим тактики
                  </label>
                  {tacticsMode && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '12px', color: '#333' }}>Размер токенов:</span>
                      <button type="button" onClick={() => sendAction?.('tactics:setScale', { scale: Math.max(0.25, tokenScale - 0.25) })} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: 14 }}>−</button>
                      <span style={{ fontSize: 12, minWidth: 36, textAlign: 'center' }}>{Math.round(tokenScale * 100)}%</span>
                      <button type="button" onClick={() => sendAction?.('tactics:setScale', { scale: Math.min(3, tokenScale + 0.25) })} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: 14 }}>+</button>
                    </div>
                  )}
                </div>
              )}
              <h3 style={{ color: '#333', marginBottom: '12px', fontSize: '15px' }}>
                Вложения {isMaster ? '(мастер)' : ''}
              </h3>
              {isMaster && (
                <div style={{ marginBottom: '10px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setBookOpen(true)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#6f42c1',
                      color: '#fff',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Книга
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await loadScenarioNpcsForRoom();
                      setNpcModalOpen(true);
                    }}
                    disabled={scenarioNpcsLoading || !room.scenarioId}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: scenarioNpcsLoading ? '#6c757d' : '#28a745',
                      color: '#fff',
                      fontSize: '12px',
                      cursor: scenarioNpcsLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {scenarioNpcsLoading ? 'Загрузка NPC...' : '+ NPC'}
                  </button>
                  {scenarioNpcs.length > 0 && (
                    <span style={{ fontSize: 11, color: '#666' }}>
                      Шаблонов NPC: {scenarioNpcs.length}
                    </span>
                  )}
                </div>
              )}
              {isMaster && (scenario?.scriptData?.locations?.length ?? 0) > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>
                    Текущая локация
                  </label>
                  <select
                    value={currentLocationId ?? ''}
                    onChange={(e) => {
                      const locId = e.target.value;
                      if (!socket) return;
                      socket.emit('scenario:setLocation', { locationId: locId || '' });
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '13px',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      background: '#fff',
                    }}
                  >
                    <option value="">— не выбрана —</option>
                    {(scenario?.scriptData?.locations ?? []).map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.title || '—'} {((loc as { mapFileIds?: string[] }).mapFileIds?.length ?? (loc as { mapFileId?: string }).mapFileId) ? '' : '(нет карты)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!isMaster && (
                <div style={{ marginBottom: '10px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setPlayerNotesBookOpen(true)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#6f42c1',
                      color: '#fff',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Книга
                  </button>
                </div>
              )}
              {(scenario?.audios?.length ?? 0) > 0 && (
                <>
                  <h3 style={{ color: '#333', marginTop: '12px', marginBottom: '8px', fontSize: '15px' }}>
                    Аудио {currentLocationId && scenario?.scriptData?.locations?.find((l) => l.id === currentLocationId)
                      ? `(локация «${scenario.scriptData.locations.find((l) => l.id === currentLocationId)?.title ?? '—'}»)`
                      : '(все)'}
                  </h3>
                  {isMaster ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                        <span style={{ fontSize: '12px', color: 'black', minWidth: '70px' }}>Громкость</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round(audioVolume * 100)}
                          onChange={(e) => {
                            const v = Number(e.target.value) / 100;
                            setAudioVolume(v);
                            audioVolumeRef.current = v;
                          }}
                          style={{ flex: 1, accentColor: '#28a745' }}
                        />
                        <span style={{ fontSize: '11px', color: '#666', width: '28px' }}>{Math.round(audioVolume * 100)}%</span>
                      </div>
                      {(() => {
                        const audios = scenario?.audios ?? [];
                        const loc = currentLocationId && scenario?.scriptData?.locations
                          ? scenario.scriptData.locations.find((l) => l.id === currentLocationId)
                          : null;
                        const locAudioIds: string[] = !loc
                          ? []
                          : Array.isArray(loc.audioIds)
                            ? loc.audioIds
                            : (loc as unknown as { audioId?: string }).audioId
                              ? [(loc as unknown as { audioId: string }).audioId]
                              : [];
                        const audiosToShow = currentLocationId && loc
                          ? audios.filter((a) => locAudioIds.includes(a.id))
                          : audios;
                        const renderAudio = (a: typeof audios[0]) => {
                          const name = a.displayName ?? a.fileName;
                          const isPlaying = playingAudioId === a.id;
                          return (
                            <div
                              key={a.id}
                              style={{
                                borderRadius: '6px',
                                border: '1px solid #dee2e6',
                                padding: '8px',
                                background: isPlaying ? '#e7f3ff' : '#f8f9fa',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  marginBottom: '6px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  color: 'black',
                                }}
                                title={name}
                              >
                                {name}
                              </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isPlaying) {
                                    socket?.emit('audio:stop');
                                  } else {
                                    socket?.emit('audio:play', { url: a.url, loop: audioLoop, id: a.id });
                                  }
                                }}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  border: 'none',
                                  background: isPlaying ? '#6c757d' : '#28a745',
                                  color: '#fff',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                              >
                                {isPlaying ? 'Стоп' : 'Играть'}
                              </button>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer', color: 'black' }}>
                                <input
                                  type="checkbox"
                                  checked={audioLoop}
                                  onChange={(e) => setAudioLoop(e.target.checked)}
                                />
                                Зациклить
                              </label>
                            </div>
                          </div>
                          );
                        };
                        return audiosToShow.length === 0 ? (
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {currentLocationId && loc ? 'У выбранной локации нет аудио' : 'Нет аудио'}
                          </div>
                        ) : (
                          <>{audiosToShow.map((a) => renderAudio(a))}</>
                        );
                      })()}
                    </div>
                  ) : playingAudioId ? (
                    <div
                      style={{
                        borderRadius: '6px',
                        border: '1px solid #dee2e6',
                        padding: '8px',
                        background: '#e7f3ff',
                        fontSize: '12px',
                        color: '#333',
                      }}
                    >
                      <div style={{ marginBottom: '6px' }}>Играет: {(scenario?.audios ?? []).find((a) => a.id === playingAudioId)?.displayName ?? (scenario?.audios ?? []).find((a) => a.id === playingAudioId)?.fileName ?? '—'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', minWidth: '58px' }}>Громкость</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round(audioVolume * 100)}
                          onChange={(e) => {
                            const v = Number(e.target.value) / 100;
                            setAudioVolume(v);
                            audioVolumeRef.current = v;
                          }}
                          style={{ flex: 1, accentColor: '#28a745' }}
                        />
                        <span style={{ fontSize: '11px', color: '#666', width: '28px' }}>{Math.round(audioVolume * 100)}%</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#666' }}>Мастер включит аудио</div>
                  )}
                </>
              )}
              {!scenario ? (
                <div style={{ color: '#666', fontSize: '13px' }}>Загрузка...</div>
              ) : (() => {
                const attachments = scenario?.attachments ?? [];
                const loc = currentLocationId && scenario?.scriptData?.locations
                  ? scenario.scriptData.locations.find((l) => l.id === currentLocationId)
                  : null;
                const locMapIds: string[] = !loc
                  ? []
                  : Array.isArray(loc.mapFileIds)
                    ? loc.mapFileIds
                    : (loc as unknown as { mapFileId?: string }).mapFileId
                      ? [(loc as unknown as { mapFileId: string }).mapFileId]
                      : [];
                const byLocation = currentLocationId && loc
                  ? attachments.filter((f) => locMapIds.includes(f.id))
                  : attachments;
                const attachmentsToShow = isMaster
                  ? byLocation
                  : byLocation.filter((f) => unlockedAttachments.includes(f.id));
                return (
                  <>
                    <h3 style={{ color: '#333', marginTop: '12px', marginBottom: '8px', fontSize: '15px' }}>
                      Вложения {currentLocationId && loc ? `(локация «${loc.title ?? '—'}»)` : '(все)'}
                    </h3>
                    {attachmentsToShow.length === 0 ? (
                  <div style={{ color: '#666', fontSize: '13px' }}>
                    {currentLocationId && loc ? 'У выбранной локации нет вложений' : 'Нет вложений'}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', minWidth: 0 }}>
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
                            minWidth: 0,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => isImage && setImagePopup({ url: f.url, name: f.displayName ?? f.fileName })}
                            onKeyDown={(e) => isImage && (e.key === 'Enter' || e.key === ' ') && setImagePopup({ url: f.url, name: f.displayName ?? f.fileName })}
                            style={{
                              height: '80px',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              background: '#e9ecef',
                              marginBottom: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: 0,
                              cursor: isImage ? 'pointer' : 'default',
                            }}
                          >
                            {isImage ? (
                              <img
                                src={f.url}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover', minWidth: 0, maxWidth: '100%', display: 'block', pointerEvents: 'none' }}
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
                )}
                  </>
                );
              })()}
            </>
          ) : (
            <div style={{ color: '#999', fontSize: '13px' }}>Сценарий не выбран</div>
          )}
        </aside>
      </main>

      {/* Футер — в режиме тактики и в бою: слева игроки, справа NPC; иначе — список персонажей */}
      {(displayPlayers.length > 0 || (tacticsMode && (combat?.order?.length ?? 0) > 0)) && (
        <footer
          style={{
            flexShrink: 0,
            padding: '12px 20px',
            background: '#fff',
            borderTop: '1px solid #dee2e6',
            boxShadow: '0 -1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {tacticsMode && (combat?.order?.length ?? 0) > 0 ? (
            <div style={{ display: 'flex', gap: '24px', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '8px' }}>Игроки</div>
                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px', alignItems: 'flex-start' }}>
                  {(combat!.order!.filter((p) => p.kind === 'pc')).map((p) => {
                    const pc = displayPlayers.find((dp) => dp.userId === p.id);
                    const characterId = pc?.characterId;
                    const ch = characterId ? characterPreviews[characterId] : null;
                    const name = ch?.characterName ?? p.name ?? pc?.name ?? 'Игрок';
                    const hp = p.hp ?? ch?.hp ?? 0;
                    const maxHp = p.maxHp ?? ch?.maxHp ?? 0;
                    const level = ch?.level ?? 1;
                    const portraitUrl = characterId ? portraitUrls[characterId] : undefined;
                    return (
                      <div
                        key={`pc-${p.id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openCharacterSheet(characterId)}
                        onKeyDown={(e) => e.key === 'Enter' && openCharacterSheet(characterId)}
                        style={{
                          minWidth: '120px',
                          padding: '8px',
                          borderRadius: '8px',
                          border: '1px solid #dee2e6',
                          background: '#f8f9fa',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: portraitUrl ? 'transparent' : '#2a5298', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, overflow: 'hidden' }}>
                          {portraitUrl ? <img src={portraitUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '13px', textAlign: 'center', color: '#000' }}>{name}</div>
                        <div style={{ fontSize: '12px', color: '#333' }}>HP: {hp}/{maxHp}</div>
                        <div style={{ fontSize: '11px', color: '#666' }}>Ур. {level}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '8px' }}>NPC</div>
                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px', alignItems: 'flex-start' }}>
                  {(combat!.order!.filter((p) => p.kind === 'npc')).map((p) => {
                    const npc = npcs.find((n) => n.id === p.id);
                    const name = p.name ?? npc?.name ?? 'NPC';
                    const hp = p.hp ?? npc?.hp ?? 0;
                    const maxHp = p.maxHp ?? npc?.maxHp ?? 0;
                    const imageUrl = npc?.imageUrl;
                    const key = participantKey(p);
                    return (
                      <div
                        key={key}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          const tpl = npc?.templateId ? scenarioNpcs.find((t) => t.id === npc.templateId) : undefined;
                          if (tpl) setNpcDetail(tpl);
                          else if (npc) setNpcDetail({
                            id: npc.id,
                            scenarioId: room!.scenarioId!,
                            name,
                            type: undefined,
                            armorClass: npc.armorClass,
                            armorClassText: undefined,
                            hpAverage: npc.maxHp,
                            hpText: undefined,
                            speed: npc.speed != null ? String(npc.speed) : undefined,
                            strength: undefined,
                            dexterity: undefined,
                            constitution: undefined,
                            intelligence: undefined,
                            wisdom: undefined,
                            charisma: undefined,
                            skills: undefined,
                            senses: undefined,
                            languages: undefined,
                            xp: undefined,
                            challenge: undefined,
                            habitat: undefined,
                            traits: undefined,
                            abilities: undefined,
                            actions: undefined,
                            legendaryActions: undefined,
                            description: undefined,
                            imageUrl: npc.imageUrl,
                            imageFileId: undefined,
                          });
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && (document.activeElement as HTMLElement)?.click()}
                        style={{
                          minWidth: '120px',
                          padding: '8px',
                          borderRadius: '8px',
                          border: '1px solid #dee2e6',
                          background: p.isDead ? '#f8f8f8' : '#fff5f5',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                          opacity: p.isDead ? 0.7 : 1,
                        }}
                      >
                        <div style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', background: '#2a5298', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700 }}>
                          {imageUrl ? <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '13px', textAlign: 'center', color: '#000' }}>{name}</div>
                        <div style={{ fontSize: '12px', color: '#333' }}>HP: {hp}/{maxHp}</div>
                        {isMaster && (
                          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => handleCombatParticipantHp(p, -5)} disabled={combatParticipantUpdating === key || (hp ?? 0) <= 0} style={{ padding: '2px 5px', borderRadius: 4, border: 'none', background: '#dc3545', color: '#fff', fontSize: 10, cursor: 'pointer' }}>−5</button>
                            <button type="button" onClick={() => handleCombatParticipantHp(p, -1)} disabled={combatParticipantUpdating === key || (hp ?? 0) <= 0} style={{ padding: '2px 5px', borderRadius: 4, border: 'none', background: '#fd7e14', color: '#fff', fontSize: 10, cursor: 'pointer' }}>−1</button>
                            <button type="button" onClick={() => handleCombatParticipantHp(p, 1)} disabled={combatParticipantUpdating === key} style={{ padding: '2px 5px', borderRadius: 4, border: 'none', background: '#28a745', color: '#fff', fontSize: 10, cursor: 'pointer' }}>+1</button>
                            <button type="button" onClick={() => handleCombatParticipantHp(p, 5)} disabled={combatParticipantUpdating === key} style={{ padding: '2px 5px', borderRadius: 4, border: 'none', background: '#28a745', color: '#fff', fontSize: 10, cursor: 'pointer' }}>+5</button>
                            <button type="button" onClick={() => sendAction?.('npc:toggleDead', { npcId: p.id })} style={{ padding: '2px 6px', borderRadius: 4, border: 'none', background: p.isDead ? '#20c997' : '#6c757d', color: '#fff', fontSize: 10, cursor: 'pointer' }}>{p.isDead ? 'Жив' : 'Убит'}</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
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
              const characterId = p.characterId;
              const ch = characterId ? characterPreviews[characterId] : null;
              const name = ch?.characterName ?? p.name ?? `Игрок ${idx + 1}`;
              const hp = ch != null ? ch.hp : 0;
              const maxHp = ch != null ? ch.maxHp : 0;
              const level = ch?.level ?? 1;
              const initial = name.charAt(0).toUpperCase();
              const portraitUrl = characterId ? portraitUrls[characterId] : undefined;
              const playerKey = `${p.userId ?? idx}-${characterId ?? ''}`;
              const handleMouseEnter = (e: React.MouseEvent) => {
                setHoveredPlayerKey(playerKey);
                if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
                const el = e.currentTarget as HTMLElement;
                tooltipTimerRef.current = setTimeout(() => {
                  setTooltipAnchorRect(el.getBoundingClientRect());
                  setTooltipShow(true);
                }, 400);
              };
              const handleMouseLeave = () => {
                if (tooltipTimerRef.current) { clearTimeout(tooltipTimerRef.current); tooltipTimerRef.current = null; }
                setHoveredPlayerKey(null);
                setTooltipShow(false);
                setTooltipAnchorRect(null);
              };
              return (
                <div
                  key={p.id || p.userId || idx}
                  role="button"
                  tabIndex={0}
                  onClick={() => openCharacterSheet(characterId)}
                  onKeyDown={(e) => e.key === 'Enter' && openCharacterSheet(characterId)}
                  onMouseEnter={isMaster ? handleMouseEnter : undefined}
                  onMouseLeave={isMaster ? handleMouseLeave : undefined}
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
                    position: 'relative',
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
                  {(() => {
                    const cd = ch?.characterData as Record<string, unknown> | undefined;
                    const conditions = (Array.isArray(cd?.conditions) ? cd.conditions as string[] : []) as string[];
                    if (conditions.length === 0) return null;
                    const labels = conditions.map((key) => CONDITION_OPTIONS.find((o) => o.key === key)?.label ?? key);
                    return (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginTop: '4px' }}>
                        {labels.map((l) => (
                          <span key={l} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#e7f1ff', color: '#0d6efd' }}>{l}</span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
          )}
        </footer>
      )}

      {/* Тултип мастера — портал в body, чтобы не обрезался overflow */}
      {isMaster && tooltipShow && tooltipAnchorRect && hoveredPlayerKey && (() => {
        const tooltipPlayer = displayPlayers.find((p, idx) => `${p.userId ?? idx}-${p.characterId ?? ''}` === hoveredPlayerKey);
        if (!tooltipPlayer) return null;
        const tc = tooltipPlayer.characterId ? characterPreviews[tooltipPlayer.characterId] : null;
        const r = tooltipAnchorRect;
        const tipName = tc?.characterName ?? tooltipPlayer.name ?? '';
        const tipHp = tc != null ? tc.hp : 0;
        const tipMaxHp = tc != null ? tc.maxHp : 0;
        const tipLevel = tc?.level ?? 1;
        const tipAc = tc?.armorClass ?? 0;
        const tipInit = tc?.initiative ?? 0;
        const tipSpeed = tc?.speed ?? 0;
        const tipStr = tc?.strength ?? 10;
        const tipDex = tc?.dexterity ?? 10;
        const tipCon = tc?.constitution ?? 10;
        const tipInt = tc?.intelligence ?? 10;
        const tipWis = tc?.wisdom ?? 10;
        const tipCha = tc?.charisma ?? 10;
        return createPortal(
          <div
            style={{
              position: 'fixed',
              left: r.left + r.width / 2,
              bottom: typeof window !== 'undefined' ? window.innerHeight - r.top + 8 : 0,
              transform: 'translateX(-50%)',
              background: '#1a1a1a',
              color: '#eee',
              padding: '10px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              minWidth: '200px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              zIndex: 100000,
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6, borderBottom: '1px solid #444', paddingBottom: 4 }}>{tipName}</div>
            <div>Ур. {tipLevel} · HP {tipHp}/{tipMaxHp}</div>
            <div>КД {tipAc} · Инит {tipInit >= 0 ? `+${tipInit}` : tipInit} · Скорость {tipSpeed}</div>
            <div style={{ marginTop: 4, color: '#aaa', fontSize: 11 }}>
              Сил {getModifier(tipStr)} · Лов {getModifier(tipDex)} · Вын {getModifier(tipCon)} · Инт {getModifier(tipInt)} · Муд {getModifier(tipWis)} · Хар {getModifier(tipCha)}
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Тултип по NPC для мастера */}
      {isMaster && hoveredNpcId && npcTooltipRect && (() => {
        const npc = npcs.find((n) => n.id === hoveredNpcId);
        const tpl = npc?.templateId
          ? scenarioNpcs.find((t) => t.id === npc.templateId)
          : undefined;
        if (!npc && !tpl) return null;
        const r = npcTooltipRect;
        const tipName = tpl?.name ?? npc?.name ?? '';
        const tipType = tpl?.type ?? '';
        const tipAc = tpl?.armorClass ?? npc?.armorClass ?? 0;
        const tipHpText =
          tpl?.hpText ||
          (npc?.hp != null && npc?.maxHp != null ? `${npc.hp}/${npc.maxHp}` : undefined);
        const tipSpeed = tpl?.speed ?? (npc?.speed != null ? `${npc.speed}` : '');
        const tipSkills = tpl?.skills ?? '';
        const tipSenses = tpl?.senses ?? '';
        const tipLanguages = tpl?.languages ?? '';
        const tipChallenge =
          tpl?.challenge && tpl?.xp != null ? `${tpl.challenge} (${tpl.xp} XP)` : tpl?.challenge;
        return createPortal(
          <div
            style={{
              position: 'fixed',
              left: r.left + r.width / 2,
              bottom: typeof window !== 'undefined' ? window.innerHeight - r.top + 8 : 0,
              transform: 'translateX(-50%)',
              background: '#1a1a1a',
              color: '#eee',
              padding: '10px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              minWidth: '220px',
              maxWidth: '320px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              zIndex: 100000,
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4, borderBottom: '1px solid #444', paddingBottom: 4 }}>
              {tipName}
            </div>
            {tipType && <div style={{ marginBottom: 2 }}>{tipType}</div>}
            <div>
              КД {tipAc}
              {tpl?.armorClassText ? ` (${tpl.armorClassText})` : ''}
            </div>
            {tipHpText && <div>Хиты {tipHpText}</div>}
            {tipSpeed && <div>Скорость {tipSpeed}</div>}
            {tipChallenge && <div>Опасность {tipChallenge}</div>}
            {tpl?.habitat && <div>Местность: {tpl.habitat}</div>}
            {tipSkills && (
              <div style={{ marginTop: 4, fontSize: 11, color: '#ccc' }}>Навыки: {tipSkills}</div>
            )}
            {tipSenses && (
              <div style={{ fontSize: 11, color: '#ccc' }}>Чувства: {tipSenses}</div>
            )}
            {tipLanguages && (
              <div style={{ fontSize: 11, color: '#ccc' }}>Языки: {tipLanguages}</div>
            )}
          </div>,
          document.body
        );
      })()}

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
                roomCode={roomCode}
              />
            )}
          </div>
        </div>
      )}

      {/* Модальное окно с подробной карточкой NPC для мастера */}
      {isMaster && npcDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setNpcDetail(null);
          }}
        >
          <div
            style={{
              background: '#fff',
              color: '#000',
              borderRadius: 10,
              padding: 16,
              maxWidth: 800,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>{npcDetail.name}</h3>
            {npcDetail.type && (
              <div style={{ marginBottom: 6, fontSize: 13 }}>{npcDetail.type}</div>
            )}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 8,
                  border: '1px solid #ddd',
                  overflow: 'hidden',
                  background: '#f1f3f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {npcDetail.imageUrl ? (
                  <img
                    src={npcDetail.imageUrl}
                    alt={npcDetail.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  (npcDetail.name || '?').charAt(0).toUpperCase()
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <div>
                  КД {npcDetail.armorClass ?? '-'}
                  {npcDetail.armorClassText ? ` (${npcDetail.armorClassText})` : ''}
                </div>
                {npcDetail.hpText && <div>Хиты {npcDetail.hpText}</div>}
                {npcDetail.speed && <div>Скорость {npcDetail.speed}</div>}
                {npcDetail.challenge && (
                  <div>
                    Опасность {npcDetail.challenge}
                    {npcDetail.xp != null ? ` (${npcDetail.xp} XP)` : ''}
                  </div>
                )}
                {npcDetail.habitat && <div>Местность: {npcDetail.habitat}</div>}
              </div>
            </div>
            {(npcDetail.strength ||
              npcDetail.dexterity ||
              npcDetail.constitution ||
              npcDetail.intelligence ||
              npcDetail.wisdom ||
              npcDetail.charisma) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 8 }}>
                {[
                  ['СИЛ', npcDetail.strength],
                  ['ЛОВ', npcDetail.dexterity],
                  ['ТЕЛ', npcDetail.constitution],
                  ['ИНТ', npcDetail.intelligence],
                  ['МДР', npcDetail.wisdom],
                  ['ХАР', npcDetail.charisma],
                ].map(([label, val]) => (
                  <div key={label as string} style={{ fontSize: 12 }}>
                    <div style={{ fontWeight: 600 }}>{label}</div>
                    <div>{val ?? '-'}</div>
                  </div>
                ))}
              </div>
            )}
            {(npcDetail.skills || npcDetail.senses || npcDetail.languages) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                {npcDetail.skills && (
                  <div>
                    <strong style={{ fontSize: 12 }}>Навыки</strong>
                    <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{npcDetail.skills}</div>
                  </div>
                )}
                {npcDetail.senses && (
                  <div>
                    <strong style={{ fontSize: 12 }}>Чувства</strong>
                    <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{npcDetail.senses}</div>
                  </div>
                )}
                {npcDetail.languages && (
                  <div>
                    <strong style={{ fontSize: 12 }}>Языки</strong>
                    <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{npcDetail.languages}</div>
                  </div>
                )}
              </div>
            )}
            {npcDetail.description && (
              <div style={{ marginBottom: 8, fontSize: 13, whiteSpace: 'pre-wrap' }}>
                {npcDetail.description}
              </div>
            )}
            {npcDetail.traits && (
              <div style={{ marginBottom: 8 }}>
                <strong>Преимущества / черты</strong>
                <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{npcDetail.traits}</div>
              </div>
            )}
            {npcDetail.actions && (
              <div style={{ marginBottom: 8 }}>
                <strong>Действия</strong>
                <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{npcDetail.actions}</div>
              </div>
            )}
            {npcDetail.abilities && (
              <div style={{ marginBottom: 8 }}>
                <strong>Способности</strong>
                <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{npcDetail.abilities}</div>
              </div>
            )}
            {npcDetail.legendaryActions && (
              <div style={{ marginBottom: 8 }}>
                <strong>Легендарные действия</strong>
                <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{npcDetail.legendaryActions}</div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setNpcDetail(null)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#6c757d',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка выбора NPC-шаблона для спавна */}
      {isMaster && npcModalOpen && room?.scenarioId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setNpcModalOpen(false);
            }
          }}
        >
          <div
            style={{
              background: '#fff',
              color: '#000',
              borderRadius: 10,
              padding: 16,
              maxWidth: 780,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Добавить NPC из сценария</h3>
            {scenarioNpcsLoading && scenarioNpcs.length === 0 ? (
              <div style={{ fontSize: 14 }}>Загрузка NPC...</div>
            ) : (() => {
              const enemyNpcs = scenarioNpcs.filter((n) => n.npcKinds?.includes('enemy'));
              if (enemyNpcs.length === 0) {
                return (
                  <div style={{ fontSize: 14 }}>
                    {scenarioNpcs.length === 0
                      ? 'В этом сценарии ещё нет NPC. Создай их на странице сценариев.'
                      : 'Нет NPC-врагов для боя. Укажи тип «Враг (можно добавить в бой)» у нужных NPC на странице сценариев — союзники и нейтральные сюда не попадают.'}
                  </div>
                );
              }
              return (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                {enemyNpcs.map((npc) => {
                  const selected = npc.id === selectedNpcTemplateId;
                  return (
                    <button
                      key={npc.id}
                      type="button"
                      onClick={() => setSelectedNpcTemplateId(npc.id)}
                      style={{
                        textAlign: 'left',
                        borderRadius: 8,
                        padding: 8,
                        width: 220,
                        border: selected ? '2px solid #0d6efd' : '1px solid #ddd',
                        background: selected ? '#e7f1ff' : '#f8f9fa',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 6,
                            overflow: 'hidden',
                            background: '#e9ecef',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                          }}
                        >
                          {npc.imageUrl ? (
                            <img
                              src={npc.imageUrl}
                              alt={npc.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            (npc.name || '?').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{npc.name}</div>
                          {npc.type && (
                            <div style={{ fontSize: 11, color: '#555' }}>{npc.type}</div>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: '#333' }}>
                        {npc.armorClass != null && (
                          <div>
                            КД {npc.armorClass}
                            {npc.armorClassText ? ` (${npc.armorClassText})` : ''}
                          </div>
                        )}
                        {npc.hpText && <div>Хиты {npc.hpText}</div>}
                        {npc.speed && <div>Скорость {npc.speed}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
            })()}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 13 }}>Количество копий:</span>
              <input
                type="number"
                min={1}
                max={20}
                value={npcSpawnCount}
                onChange={(e) => setNpcSpawnCount(Math.max(1, Number(e.target.value) || 1))}
                style={{ width: 80 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setNpcModalOpen(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#6c757d',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!sendAction || !selectedNpcTemplateId || !room?.scenarioId) return;
                  const template = scenarioNpcs.find((n) => n.id === selectedNpcTemplateId);
                  if (!template || !template.npcKinds?.includes('enemy')) return;
                  const instances = Array.from({ length: npcSpawnCount }, (_, i) => {
                    const baseName = template.name || 'NPC';
                    const name = npcSpawnCount > 1 ? `${baseName} #${i + 1}` : baseName;
                    const rolledHp = template.hpText ? parseAndRollHp(template.hpText) : null;
                    const hpValue = rolledHp ?? template.hpAverage ?? undefined;
                    const speedNumber =
                      template.speed && /^\d+/.test(template.speed)
                        ? Number((template.speed.match(/^\d+/) || ['0'])[0])
                        : undefined;
                    return {
                      templateId: template.id,
                      name,
                      imageUrl: template.imageUrl ?? undefined,
                      armorClass: template.armorClass ?? undefined,
                      hp: hpValue,
                      maxHp: hpValue,
                      speed: speedNumber,
                      dexterity: template.dexterity ?? 10,
                      isDead: false,
                    };
                  });
                  sendAction('npc:spawn', { instances, roomCode });
                  setOverlayHidden(true);
                  setNpcModalOpen(false);
                }}
                disabled={!selectedNpcTemplateId || !scenarioNpcs.find((n) => n.id === selectedNpcTemplateId)?.npcKinds?.includes('enemy')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: selectedNpcTemplateId && scenarioNpcs.find((n) => n.id === selectedNpcTemplateId)?.npcKinds?.includes('enemy') ? '#28a745' : '#adb5bd',
                  color: '#fff',
                  cursor: selectedNpcTemplateId && scenarioNpcs.find((n) => n.id === selectedNpcTemplateId)?.npcKinds?.includes('enemy') ? 'pointer' : 'not-allowed',
                }}
              >
                Создать NPC
              </button>
            </div>
          </div>
        </div>
      )}

      {bookOpen && (
        <MasterBookPanel
          scriptData={scenario?.scriptData ?? null}
          scenarioNpcs={scenarioNpcs ?? []}
          scenarioAudios={scenario?.audios ?? []}
          onClose={() => setBookOpen(false)}
        />
      )}

      {playerNotesBookOpen && (
        <NotesBookViewPanel onClose={() => setPlayerNotesBookOpen(false)} />
      )}

      {logWindowOpen && (
        <DraggableWindow title="Логи" onClose={() => setLogWindowOpen(false)} width={420} maxHeight="70vh">
          <div style={{ padding: '12px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {diceLog.length === 0 ? (
              <div style={{ color: '#999', fontSize: '13px' }}>Пока нет бросков</div>
            ) : (
              [...diceLog].reverse().map((entry, i) => (
                <div
                  key={i}
                  style={{
                    padding: '8px 10px',
                    marginBottom: '6px',
                    background: '#f8f9fa',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#333',
                  }}
                >
                  <strong>{entry.username}</strong>: {entry.formula} → {entry.result.join(', ')} ={' '}
                  <strong>{entry.total}</strong>
                </div>
              ))
            )}
          </div>
        </DraggableWindow>
      )}

      {imagePopup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр изображения"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setImagePopup(null)}
        >
          <div
            style={{
              maxHeight: '70vh',
              maxWidth: '90vw',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imagePopup.url}
              alt={imagePopup.name}
              style={{
                maxHeight: '70vh',
                maxWidth: '90vw',
                objectFit: 'contain',
                borderRadius: 8,
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
            />
            <button
              type="button"
              onClick={() => setImagePopup(null)}
              style={{
                marginTop: 12,
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#6c757d',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

