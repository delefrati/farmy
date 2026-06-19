import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import type { FarmTile } from '../types/farm';
import type { PlayerEconomy } from '../types/economy';
import { crops, defaultCropId } from '../data/crops';

export class FarmScene extends Phaser.Scene {
  private readonly saveSystem = new SaveSystem();

  private farmTiles: FarmTile[] = [];

  private economy: PlayerEconomy = { coins: 100, xp: 0, level: 1 };

  private selectedCropId = defaultCropId;

  private statusMessage = '';

  private readonly tileSize = { width: 120, height: 90 };

  private readonly tileGap = 8;

  constructor() {
    super('FarmScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#9fdd7a');

    const loaded = this.saveSystem.loadGame();
    this.farmTiles = loaded.farmTiles;
    this.economy = loaded.economy;
    this.selectedCropId = loaded.selectedCropId;

    const selectedCrop = crops.find((crop) => crop.id === this.selectedCropId) ?? crops[0];
    const selectedCropPrice = selectedCrop.seedPrice;

    this.add
      .text(24, 24, 'FarmScene: Phase 5 Planting + Economy', {
        color: '#1f3f10',
        fontSize: '24px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const hudText = this.add
      .text(24, 58, `Coins: ${this.economy.coins} | XP: ${this.economy.xp} | Level: ${this.economy.level}`, {
        color: '#2f4f1f',
        fontSize: '16px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    this.add
      .text(24, 80, `Selected seed: ${selectedCrop.name} (Cost: ${selectedCropPrice})`, {
        color: '#2f4f1f',
        fontSize: '16px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const statusText = this.add
      .text(24, 102, 'Click empty tile to plant. Press R to reset save.', {
        color: '#3f5f2f',
        fontSize: '14px',
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
      const originY = 130;

      this.farmTiles.forEach((tile) => {
        const posX = originX + tile.x * (this.tileSize.width + this.tileGap);
        const posY = originY + tile.y * (this.tileSize.height + this.tileGap);
        const tileColor = tile.state === 'planted' ? 0x7a5230 : 0xc4955f;

        const rect = this.add
          .rectangle(posX, posY, this.tileSize.width, this.tileSize.height, tileColor)
          .setOrigin(0)
          .setStrokeStyle(2, 0x4b6d33)
          .setInteractive({ useHandCursor: true });

        if (tile.state === 'planted' && tile.cropId) {
          this.add
            .text(posX + 8, posY + 8, tile.cropId, {
              color: '#f6efe2',
              fontSize: '12px',
              fontFamily: 'Arial',
            })
            .setDepth(2);
        }

        rect.on('pointerdown', () => {
          if (tile.state !== 'empty') {
            this.statusMessage = 'Tile already occupied. Choose an empty tile.';
            this.scene.restart();
            return;
          }

          if (this.economy.coins < selectedCropPrice) {
            this.statusMessage = `Not enough coins to plant ${selectedCrop.name}.`;
            this.scene.restart();
            return;
          }

          tile.state = 'planted';
          tile.cropId = selectedCrop.id;
          this.economy.coins -= selectedCropPrice;
          this.statusMessage = `${selectedCrop.name} planted. -${selectedCropPrice} coins.`;

          this.saveSystem.saveGame({
            economy: this.economy,
            selectedCropId: this.selectedCropId,
            farmTiles: this.farmTiles,
          });
          this.scene.restart();
        });
      });
    };

    const resetSave = (): void => {
      this.saveSystem.clearSave();
      const reset = this.saveSystem.loadGame();
      this.farmTiles = reset.farmTiles;
      this.economy = reset.economy;
      this.selectedCropId = reset.selectedCropId;
      this.statusMessage = 'Save reset to default state.';
      this.scene.restart();
    };

    resetButton.on('pointerdown', resetSave);

    this.input.keyboard?.on('keydown-R', resetSave);

    if (this.statusMessage) {
      statusText.setText(this.statusMessage);
    }

    hudText.setText(`Coins: ${this.economy.coins} | XP: ${this.economy.xp} | Level: ${this.economy.level}`);

    renderGrid();
  }
}
