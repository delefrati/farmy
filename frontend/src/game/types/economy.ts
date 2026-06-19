export type PlayerEconomy = {
  coins: number;
  xp: number;
  level: number;
};

export const createDefaultEconomy = (): PlayerEconomy => ({
  coins: 100,
  xp: 0,
  level: 1,
});
