export interface Player {
    id?: string;
    name?: string;
    locationId?: string;
    inventory?: string[]; // список id предметов
    hp?: number;
    maxHp?: number,
    level?: number,
    experience?: number,
    strength?: number,
    dexterity?: number,
    constitution?: number,
    intelligence?: number,
    wisdom?: number,
    charisma?: number,
    class?: string,
    race?: string,
    armorClass?: number,
    initiative?: number,
    speed?: number
}

export interface Location {
    id: string;
    name: string;
    description?: string;
    locations?: Location[];
}

export interface Trap {
    id: string;
    name: string;
    description?: string;
}

export async function fetchPlayerMock() {
  const res = await fetch("http://localhost:3000/player");
  return res.json();
}