/** Пороги опыта по уровням (D&D 5e) */
const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
  120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

export function xpToLevel(experience: number): number {
  let level = 1;
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (experience >= XP_THRESHOLDS[i]) return i + 1;
  }
  return level;
}

/** Бонус мастерства по уровню: 1–4 +2, 5–8 +3, 9–12 +4, 13–16 +5, 17–20 +6 */
export function getProficiencyBonus(level: number): number {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}
