import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { FarmScene } from './scenes/FarmScene';

export const createGameConfig = (parent: string | HTMLElement): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  parent,
  backgroundColor: '#8ecf7b',
  scene: [BootScene, FarmScene],
});
