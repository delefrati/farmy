import Phaser from 'phaser';
import { createGameConfig } from './config';

let game: Phaser.Game | null = null;

export const createGame = (parent: string | HTMLElement): Phaser.Game => {
  if (game) {
    return game;
  }

  game = new Phaser.Game(createGameConfig(parent));
  if (import.meta.env.DEV) {
    (window as unknown as { __farmyGame?: Phaser.Game }).__farmyGame = game;
  }
  return game;
};

export const destroyGame = (): void => {
  if (!game) {
    return;
  }

  game.destroy(true);
  game = null;
};
