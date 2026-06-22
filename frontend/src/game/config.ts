import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { FarmScene } from './scenes/FarmScene';
import { NeighborScene } from './scenes/NeighborScene';

export const createGameConfig = (parent: string | HTMLElement): Phaser.Types.Core.GameConfig => ({
  // Canvas renderer avoids WebGL text-texture artifacts (stray dark boxes /
  // wrong glyph colors) seen on some drivers after scene restarts. This game
  // only draws rectangles and text, so Canvas has no meaningful downside.
  type: Phaser.CANVAS,
  width: 1280,
  height: 860,
  parent,
  backgroundColor: '#8ecf7b',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // Fill the available container (full viewport on mobile) and letterbox the
    // fixed 1280x860 design inside it, keeping aspect ratio.
    width: 1280,
    height: 860,
    expandParent: true,
  },
  scene: [BootScene, FarmScene, NeighborScene],
});
