import Phaser from 'phaser';
import { animalAnimManifest, assetManifest, spriteSheetManifest } from '../assets/manifest';

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

    // Animal strips are loaded as plain images and sliced at runtime (see
    // create), so we don't need to know their frame size ahead of time.
    for (const entry of animalAnimManifest) {
      this.load.image(entry.key, entry.url);
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

    // Slice each loaded animal strip into equal frames and register a looping
    // animation. Strips that failed to load are skipped (the farm falls back to
    // the static animal textures).
    for (const entry of animalAnimManifest) {
      if (!this.textures.exists(entry.key) || this.anims.exists(entry.key)) {
        continue;
      }
      const texture = this.textures.get(entry.key);
      const source = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      // Derive the frame count from the strip's proportions (frames are square,
      // laid left-to-right), so a 4-, 8- or 12-frame strip just works without
      // editing the manifest. An explicit `frameCount` overrides this for the
      // rare strip whose frames aren't square.
      const derived = Math.round(source.width / source.height);
      const count = Math.max(1, entry.frameCount ?? derived);
      const frameWidth = Math.floor(source.width / count);
      const frameHeight = source.height;
      if (frameWidth <= 0 || frameHeight <= 0) {
        continue;
      }
      for (let i = 0; i < count; i += 1) {
        if (!texture.has(String(i))) {
          texture.add(i, 0, i * frameWidth, 0, frameWidth, frameHeight);
        }
      }
      this.anims.create({
        key: entry.key,
        frames: this.anims.generateFrameNumbers(entry.key, { start: 0, end: count - 1 }),
        frameRate: entry.frameRate ?? 10,
        repeat: -1,
      });
    }

    this.showSplash(() => this.scene.start('FarmScene'));
  }

  /**
   * Brief branded splash: fade the logo in over a soft backdrop, hold, then
   * fade the scene out and continue. Falls back to starting immediately when
   * the logo art isn't present. A pointer/key press skips the wait.
   */
  private showSplash(done: () => void): void {
    if (!this.textures.exists('logo_farmy')) {
      done();
      return;
    }

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#9fdd7a');

    const logo = this.add
      .image(width / 2, height / 2, 'logo_farmy')
      .setOrigin(0.5)
      .setAlpha(0);

    // Fit the logo to ~70% of the canvas width, preserving aspect.
    const maxWidth = width * 0.7;
    if (logo.width > maxWidth) {
      const scale = maxWidth / logo.width;
      logo.setScale(scale);
    }

    let finished = false;
    const finish = (): void => {
      if (finished) {
        return;
      }
      finished = true;
      this.cameras.main.fadeOut(220, 159, 221, 122);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, done);
    };

    this.tweens.add({
      targets: logo,
      alpha: 1,
      scale: { from: logo.scale * 0.9, to: logo.scale },
      ease: 'Back.Out',
      duration: 360,
    });

    // Auto-advance after a short hold; let the player tap/press to skip.
    this.time.delayedCall(1400, finish);
    this.input.once(Phaser.Input.Events.POINTER_DOWN, finish);
    this.input.keyboard?.once('keydown', finish);
  }
}
