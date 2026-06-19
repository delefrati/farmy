import Phaser from 'phaser';
import { assetManifest } from '../assets/manifest';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    // Queue every manifest asset. Files that don't exist yet are tolerated:
    // the loader keeps going on error and scenes fall back to shape rendering
    // for any texture that failed to load (use `this.textures.exists(key)`).
    this.load.on(
      Phaser.Loader.Events.FILE_LOAD_ERROR,
      (file: Phaser.Loader.File) => {
        console.warn(`[assets] missing, using fallback: ${file.src}`);
      },
    );

    for (const entry of assetManifest) {
      this.load.image(entry.key, entry.url);
    }
  }

  create(): void {
    this.scene.start('FarmScene');
  }
}
