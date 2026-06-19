import Phaser from 'phaser';
import { assetManifest, spriteSheetManifest } from '../assets/manifest';

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

    for (const sheet of spriteSheetManifest) {
      this.load.spritesheet(sheet.key, sheet.url, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
    }
  }

  create(): void {
    // Register an animation for each loaded effect sprite-sheet. Sheets that
    // failed to load are skipped so a missing effect simply never plays.
    for (const sheet of spriteSheetManifest) {
      if (!this.textures.exists(sheet.key) || this.anims.exists(sheet.key)) {
        continue;
      }
      this.anims.create({
        key: sheet.key,
        frames: this.anims.generateFrameNumbers(
          sheet.key,
          sheet.frameSequence
            ? { frames: sheet.frameSequence }
            : { start: 0, end: sheet.frameCount - 1 },
        ),
        frameRate: 12,
        repeat: 0,
      });
    }

    this.scene.start('FarmScene');
  }
}
