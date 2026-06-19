export const getXpRequiredForLevel = (level: number): number => {
  if (level <= 1) {
    return 0;
  }

  let total = 0;
  for (let nextLevel = 2; nextLevel <= level; nextLevel += 1) {
    total += 40 + (nextLevel - 2) * 15;
  }

  return total;
};

export const getLevelFromXp = (xp: number): number => {
  let level = 1;

  while (xp >= getXpRequiredForLevel(level + 1)) {
    level += 1;
  }

  return level;
};

export const getXpToNextLevel = (xp: number, level: number): number => {
  const nextLevelXp = getXpRequiredForLevel(level + 1);
  return Math.max(nextLevelXp - xp, 0);
};
