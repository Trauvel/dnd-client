import type { Player, Trap, Location } from "./player";

export interface PublicState {
  players: Player[];
  locations?: Location[];
  logs?: string[];
}

export interface CombatParticipant {
  id: string;
  kind: 'pc' | 'npc';
  name: string;
  initiative: number;
  hp?: number;
  maxHp?: number;
  isDead?: boolean;
}

export interface NpcInstance {
  id: string;
  templateId?: string;
  name: string;
  imageUrl?: string;
  armorClass?: number;
  hp?: number;
  maxHp?: number;
  speed?: number;
  initiative?: number;
  isDead?: boolean;
}

export interface CombatState {
  active: boolean;
  startedAt?: string;
  turnIndex: number;
  order: CombatParticipant[];
  timerStartedAt?: string;
}

export interface MasterState {
  hiddenLocations?: Location[];
  traps?: Trap[];
  npcPlans?: Record<string, any>;
  logs?: string[];
  npcs?: NpcInstance[];
  combat?: CombatState;
}

export interface GameState {
  public: PublicState;
  master: MasterState;
}