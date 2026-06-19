import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import type { FarmTile } from '../types/farm';

export class FarmScene extends Phaser.Scene {
  private readonly saveSystem = new SaveSystem();

  private farmTiles: FarmTile[] = [];

  private readonly tileSize = { width: 120, height: 90 };

  private readonly tileGap = 8;

  constructor() {
    super('FarmScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#9fdd7a');

    this.farmTiles = this.saveSystem.loadGame().farmTiles;

    this.add
      .text(24, 24, 'FarmScene: Phase 4 Save System Ready', {
        color: '#1f3f10',
        fontSize: '24px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const subtitle = this.add
      .text(24, 58, 'Click tiles to toggle state. Save is automatic. Press R to reset.', {
        color: '#2f4f1f',
        fontSize: '16px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    this.add
      .rectangle(480, 290, 860, 420, 0x6c9a4b)
      .setStrokeStyle(4, 0x4b6d33)
      .setDepth(0);

    const resetButton = this.add
      .text(770, 22, 'Reset Save (R)', {
        color: '#ffffff',
        backgroundColor: '#955728',
        fontSize: '16px',
        fontFamily: 'Arial',
        padding: { x: 12, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const renderGrid = (): void => {
      const originX = 100;
      const originY = 100;

      this.farmTiles.forEach((tile) => {
        const posX = originX + tile.x * (this.tileSize.width + this.tileGap);
        const posY = originY + tile.y * (this.tileSize.height + this.tileGap);
        const tileColor = tile.state === 'planted' ? 0x7a5230 : 0xc4955f;

        const rect = this.add
          .rectangle(posX, posY, this.tileSize.width, this.tileSize.height, tileColor)
          .setOrigin(0)
          .setStrokeStyle(2, 0x4b6d33)
          .setInteractive({ useHandCursor: true });

        rect.on('pointerdown', () => {
          tile.state = tile.state === 'empty' ? 'planted' : 'empty';
          this.saveSystem.saveGame(this.farmTiles);
          this.scene.restart();
        });
      });
    };

    const resetSave = (): void => {
      this.saveSystem.clearSave();
      this.farmTiles = this.saveSystem.loadGame().farmTiles;
      this.scene.restart();
    };

    resetButton.on('pointerdown', resetSave);

    this.input.keyboard?.on('keydown-R', resetSave);

    renderGrid();

    subtitle.setText('Click tiles to toggle state. Save is automatic. Press R to reset.');
  }
}
