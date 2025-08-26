import type { Player, Trap, Location } from "./player";

export interface PublicState {
  players: Player[];
  locations?: Location[];
  logs?: string[];
}

export interface MasterState {
  hiddenLocations?: Location[];
  traps?: Trap[];
  npcPlans?: Record<string, any>;
  logs?: string[];
}

export interface GameState {
  public: PublicState;
  master: MasterState;
}