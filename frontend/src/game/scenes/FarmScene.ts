import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import type { FarmTile } from '../types/farm';
import type { PlayerEconomy } from '../types/economy';
import { crops, defaultCropId } from '../data/crops';
import type { CropDefinition } from '../types/crop';

type TileVisual = {
  rect: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  subtitle: Phaser.GameObjects.Text;
};

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
    const tileVisuals = new Map<string, TileVisual>();

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

    const getCrop = (cropId: string | undefined): CropDefinition | undefined => {
      if (!cropId) {
        return undefined;
      }

      return crops.find((crop) => crop.id === cropId);
    };

    const getGrowth = (
      tile: FarmTile,
    ): { crop: CropDefinition; stageLabel: string; progress: number; ready: boolean } | undefined => {
      const crop = getCrop(tile.cropId);

      if (!crop || !tile.plantedAt) {
        return undefined;
      }

      const elapsedSeconds = Math.max(0, (Date.now() - tile.plantedAt) / 1000);
      const progress = Math.min(elapsedSeconds / crop.growSeconds, 1);
      const stageIndex = Math.min(
        Math.floor(progress * (crop.stages.length - 1)),
        crop.stages.length - 1,
      );

      return {
        crop,
        stageLabel: crop.stages[stageIndex],
        progress,
        ready: progress >= 1,
      };
    };

    const saveCurrent = (): void => {
      this.saveSystem.saveGame({
        economy: this.economy,
        selectedCropId: this.selectedCropId,
        farmTiles: this.farmTiles,
      });
    };

    const refreshTileVisual = (tile: FarmTile): void => {
      const visual = tileVisuals.get(tile.id);
      if (!visual) {
        return;
      }

      if (tile.state === 'empty') {
        visual.rect.setFillStyle(0xc4955f);
        visual.title.setText('');
        visual.subtitle.setText('');
        return;
      }

      const growth = getGrowth(tile);
      if (!growth) {
        visual.rect.setFillStyle(0x7a5230);
        visual.title.setText('Planted');
        visual.subtitle.setText('');
        return;
      }

      if (growth.ready) {
        visual.rect.setFillStyle(0x4e8b3a);
      } else {
        visual.rect.setFillStyle(0x7a5230);
      }

      visual.title.setText(`${growth.crop.name} • ${growth.stageLabel}`);
      visual.subtitle.setText(growth.ready ? 'Ready to harvest' : `${Math.floor(growth.progress * 100)}% grown`);
    };

    const renderGrid = (): void => {
      const originX = 100;
      const originY = 130;

      this.farmTiles.forEach((tile) => {
        const posX = originX + tile.x * (this.tileSize.width + this.tileGap);
        const posY = originY + tile.y * (this.tileSize.height + this.tileGap);

        const rect = this.add
          .rectangle(posX, posY, this.tileSize.width, this.tileSize.height, 0xc4955f)
          .setOrigin(0)
          .setStrokeStyle(2, 0x4b6d33)
          .setInteractive({ useHandCursor: true });

        const title = this.add
          .text(posX + 8, posY + 8, '', {
            color: '#f6efe2',
            fontSize: '12px',
            fontFamily: 'Arial',
          })
          .setDepth(2);

        const subtitle = this.add
          .text(posX + 8, posY + 26, '', {
            color: '#f6efe2',
            fontSize: '11px',
            fontFamily: 'Arial',
          })
          .setDepth(2);

        tileVisuals.set(tile.id, { rect, title, subtitle });
        refreshTileVisual(tile);

        rect.on('pointerdown', () => {
          if (tile.state !== 'empty') {
            this.statusMessage = 'Tile already occupied. Choose an empty tile.';
            statusText.setText(this.statusMessage);
            return;
          }

          if (this.economy.coins < selectedCropPrice) {
            this.statusMessage = `Not enough coins to plant ${selectedCrop.name}.`;
            statusText.setText(this.statusMessage);
            return;
          }

          tile.state = 'planted';
          tile.cropId = selectedCrop.id;
          tile.plantedAt = Date.now();
          this.economy.coins -= selectedCropPrice;
          this.statusMessage = `${selectedCrop.name} planted. -${selectedCropPrice} coins.`;

          saveCurrent();
          refreshTileVisual(tile);
          hudText.setText(`Coins: ${this.economy.coins} | XP: ${this.economy.xp} | Level: ${this.economy.level}`);
          statusText.setText(this.statusMessage);
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

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.farmTiles.forEach((tile) => {
          if (tile.state === 'planted') {
            refreshTileVisual(tile);
          }
        });
      },
    });
  }
}
