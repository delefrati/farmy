import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import type { FarmTile } from '../types/farm';
import type { PlayerEconomy } from '../types/economy';
import type { PlayerInventory } from '../types/inventory';
import { crops, defaultCropId } from '../data/crops';
import type { CropDefinition } from '../types/crop';
import { RemoteSaveService } from '../services/RemoteSaveService';

type TileVisual = {
  rect: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  subtitle: Phaser.GameObjects.Text;
};

export class FarmScene extends Phaser.Scene {
  private readonly saveSystem = new SaveSystem();

  private readonly remoteSaveService = new RemoteSaveService();

  private farmTiles: FarmTile[] = [];

  private economy: PlayerEconomy = { coins: 100, xp: 0, level: 1 };

  private selectedCropId = defaultCropId;

  private inventory: PlayerInventory = {};

  private statusMessage = '';

  private readonly tileSize = { width: 120, height: 90 };

  private readonly tileGap = 8;

  constructor() {
    super('FarmScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#9fdd7a');
    const isDevMode = import.meta.env.DEV;
    let growthTimeScale: 1 | 10 | 100 = 1;
    let isSyncing = false;
    let lastSyncLabel = 'never';

    const loaded = this.saveSystem.loadGame();
    this.farmTiles = loaded.farmTiles;
    this.economy = loaded.economy;
    this.inventory = loaded.inventory;
    this.selectedCropId = loaded.selectedCropId;

    const tileVisuals = new Map<string, TileVisual>();

    this.add
      .text(24, 24, 'FarmScene: Phase 8 Harvest + Sell Loop', {
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

    const selectedSeedText = this.add
      .text(24, 80, '', {
        color: '#2f4f1f',
        fontSize: '16px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const statusText = this.add
      .text(24, 102, 'Click empty tile to plant. Click ready crop to harvest. Sell with button or S key.', {
        color: '#3f5f2f',
        fontSize: '14px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const inventoryText = this.add
      .text(24, 122, 'Inventory: empty', {
        color: '#2f4f1f',
        fontSize: '14px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const syncText = this.add
      .text(24, 142, 'Sync: idle | Last sync: never', {
        color: '#1f5c99',
        fontSize: '13px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const devSpeedText = this.add
      .text(24, 160, '', {
        color: '#7a3b00',
        fontSize: '13px',
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

    const sellButton = this.add
      .text(620, 22, 'Sell Inventory (S)', {
        color: '#ffffff',
        backgroundColor: '#2f7a41',
        fontSize: '16px',
        fontFamily: 'Arial',
        padding: { x: 12, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const uploadButton = this.add
      .text(455, 22, 'Upload Save (U)', {
        color: '#ffffff',
        backgroundColor: '#1f5c99',
        fontSize: '16px',
        fontFamily: 'Arial',
        padding: { x: 12, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const downloadButton = this.add
      .text(280, 22, 'Download Save (D)', {
        color: '#ffffff',
        backgroundColor: '#1f5c99',
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

    const getSelectedCrop = (): CropDefinition => {
      const selected = getCrop(this.selectedCropId);
      return selected ?? crops[0];
    };

    const refreshSelectedSeedLabel = (): void => {
      const selected = getSelectedCrop();
      selectedSeedText.setText(`Selected seed: ${selected.name} (Cost: ${selected.seedPrice})`);
    };

    const getGrowth = (
      tile: FarmTile,
    ): { crop: CropDefinition; stageLabel: string; progress: number; ready: boolean } | undefined => {
      const crop = getCrop(tile.cropId);

      if (!crop || !tile.plantedAt) {
        return undefined;
      }

      const elapsedSeconds = Math.max(0, (Date.now() - tile.plantedAt) / 1000) * growthTimeScale;
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
        inventory: this.inventory,
        selectedCropId: this.selectedCropId,
        farmTiles: this.farmTiles,
      });
    };

    const buildCurrentSave = () => {
      return this.saveSystem.saveGame({
        economy: this.economy,
        inventory: this.inventory,
        selectedCropId: this.selectedCropId,
        farmTiles: this.farmTiles,
      });
    };

    const getInventoryLabel = (): string => {
      const entries = Object.entries(this.inventory).filter(([, amount]) => amount > 0);
      if (entries.length === 0) {
        return 'Inventory: empty';
      }

      const text = entries.map(([cropId, amount]) => `${cropId} x${amount}`).join(' | ');
      return `Inventory: ${text}`;
    };

    const refreshDevSpeedLabel = (): void => {
      if (!isDevMode) {
        devSpeedText.setText('');
        return;
      }

      devSpeedText.setText(`DEV Growth Speed: ${growthTimeScale}x`);
    };

    const applyDevSpeed = (nextScale: 1 | 10 | 100): void => {
      growthTimeScale = nextScale;
      refreshDevSpeedLabel();
      this.farmTiles.forEach((tile) => {
        if (tile.state === 'planted') {
          refreshTileVisual(tile);
        }
      });
      this.statusMessage = `DEV speed set to ${growthTimeScale}x.`;
      statusText.setText(this.statusMessage);
    };

    const setSyncLabel = (state: 'idle' | 'syncing' | 'success' | 'error', message?: string): void => {
      if (state === 'syncing') {
        syncText.setText('Sync: in progress...');
        return;
      }

      if (message) {
        syncText.setText(`Sync: ${message} | Last sync: ${lastSyncLabel}`);
        return;
      }

      syncText.setText(`Sync: ${state} | Last sync: ${lastSyncLabel}`);
    };

    const renderSeedSelector = (): void => {
      this.add
        .text(430, 58, 'Seed Shop:', {
          color: '#1f3f10',
          fontSize: '16px',
          fontFamily: 'Arial',
        })
        .setDepth(2);

      crops.forEach((crop, index) => {
        const isSelected = crop.id === this.selectedCropId;
        const isUnlocked = this.economy.level >= crop.unlockLevel;

        const button = this.add
          .text(520 + index * 140, 56, `${crop.name}\nL${crop.unlockLevel}`, {
            color: '#ffffff',
            backgroundColor: isSelected ? '#357a38' : isUnlocked ? '#4b6d33' : '#777777',
            fontSize: '12px',
            fontFamily: 'Arial',
            padding: { x: 8, y: 6 },
            align: 'center',
          })
          .setInteractive({ useHandCursor: true })
          .setDepth(2);

        button.on('pointerdown', () => {
          if (this.economy.level < crop.unlockLevel) {
            this.statusMessage = `${crop.name} unlocks at level ${crop.unlockLevel}.`;
            statusText.setText(this.statusMessage);
            return;
          }

          this.selectedCropId = crop.id;
          saveCurrent();
          refreshSelectedSeedLabel();

          this.statusMessage = `${crop.name} seed selected.`;
          statusText.setText(this.statusMessage);
          this.scene.restart();
        });
      });
    };

    const getUnlockedCropNames = (fromExclusiveLevel: number, toInclusiveLevel: number): string[] => {
      return crops
        .filter((crop) => crop.unlockLevel > fromExclusiveLevel && crop.unlockLevel <= toInclusiveLevel)
        .map((crop) => crop.name);
    };

    const sellInventory = (): void => {
      const entries = Object.entries(this.inventory).filter(([, amount]) => amount > 0);
      if (entries.length === 0) {
        this.statusMessage = 'Nothing to sell.';
        statusText.setText(this.statusMessage);
        return;
      }

      let totalCoins = 0;

      entries.forEach(([cropId, amount]) => {
        const crop = getCrop(cropId);
        if (!crop) {
          return;
        }

        totalCoins += crop.sellPrice * amount;
      });

      if (totalCoins <= 0) {
        this.statusMessage = 'No sellable crops found in inventory.';
        statusText.setText(this.statusMessage);
        return;
      }

      this.economy.coins += totalCoins;
      this.inventory = {};

      saveCurrent();
      hudText.setText(`Coins: ${this.economy.coins} | XP: ${this.economy.xp} | Level: ${this.economy.level}`);
      inventoryText.setText(getInventoryLabel());

      this.statusMessage = `Sold inventory for +${totalCoins} coins.`;
      statusText.setText(this.statusMessage);
    };

    const uploadRemoteSave = async (): Promise<void> => {
      if (isSyncing) {
        return;
      }

      isSyncing = true;
      setSyncLabel('syncing');
      try {
        const currentSave = buildCurrentSave();
        await this.remoteSaveService.uploadSave(currentSave);
        this.statusMessage = 'Save uploaded to backend.';
        lastSyncLabel = new Date().toLocaleTimeString();
        setSyncLabel('success', 'uploaded');
      } catch (error) {
        this.statusMessage = `Upload failed: ${String(error)}`;
        setSyncLabel('error', 'upload failed');
      } finally {
        isSyncing = false;
        statusText.setText(this.statusMessage);
      }
    };

    const downloadRemoteSave = async (): Promise<void> => {
      if (isSyncing) {
        return;
      }

      isSyncing = true;
      setSyncLabel('syncing');
      try {
        const remoteSave = await this.remoteSaveService.downloadSave();
        if (!remoteSave) {
          this.statusMessage = 'No remote save found yet.';
          setSyncLabel('idle', 'no remote save');
          statusText.setText(this.statusMessage);
          return;
        }

        this.saveSystem.replaceLocalSave(remoteSave);
        this.farmTiles = remoteSave.farmTiles;
        this.economy = remoteSave.economy;
        this.inventory = remoteSave.inventory;
        this.selectedCropId = remoteSave.selectedCropId;
        this.statusMessage = 'Remote save downloaded.';
        lastSyncLabel = new Date().toLocaleTimeString();
        setSyncLabel('success', 'downloaded');
        this.scene.restart();
      } catch (error) {
        this.statusMessage = `Download failed: ${String(error)}`;
        setSyncLabel('error', 'download failed');
        statusText.setText(this.statusMessage);
      } finally {
        isSyncing = false;
      }
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
          const selectedCrop = getSelectedCrop();

          if (tile.state === 'planted') {
            const growth = getGrowth(tile);
            if (!growth?.ready) {
              this.statusMessage = 'Crop is still growing. Wait until it is ready.';
              statusText.setText(this.statusMessage);
              return;
            }

            const cropId = growth.crop.id;
            this.inventory[cropId] = (this.inventory[cropId] ?? 0) + 1;
            const previousLevel = this.economy.level;
            this.economy.xp += growth.crop.xp;
            this.economy.level = Math.floor(this.economy.xp / 50) + 1;

            tile.state = 'empty';
            tile.cropId = undefined;
            tile.plantedAt = undefined;

            if (this.economy.level > previousLevel) {
              const unlockedNames = getUnlockedCropNames(previousLevel, this.economy.level);
              const unlockSuffix = unlockedNames.length > 0 ? ` Unlocked: ${unlockedNames.join(', ')}.` : '';
              this.statusMessage = `Level up! You reached level ${this.economy.level}.${unlockSuffix}`;
              saveCurrent();
              this.scene.restart();
              return;
            }

            this.statusMessage = `${growth.crop.name} harvested. +1 in inventory.`;

            saveCurrent();
            refreshTileVisual(tile);
            hudText.setText(`Coins: ${this.economy.coins} | XP: ${this.economy.xp} | Level: ${this.economy.level}`);
            inventoryText.setText(getInventoryLabel());
            statusText.setText(this.statusMessage);
            return;
          }

          if (this.economy.level < selectedCrop.unlockLevel) {
            this.statusMessage = `${selectedCrop.name} unlocks at level ${selectedCrop.unlockLevel}.`;
            statusText.setText(this.statusMessage);
            return;
          }

          if (this.economy.coins < selectedCrop.seedPrice) {
            this.statusMessage = `Not enough coins to plant ${selectedCrop.name}.`;
            statusText.setText(this.statusMessage);
            return;
          }

          tile.state = 'planted';
          tile.cropId = selectedCrop.id;
          tile.plantedAt = Date.now();
          this.economy.coins -= selectedCrop.seedPrice;
          this.statusMessage = `${selectedCrop.name} planted. -${selectedCrop.seedPrice} coins.`;

          saveCurrent();
          refreshTileVisual(tile);
          hudText.setText(`Coins: ${this.economy.coins} | XP: ${this.economy.xp} | Level: ${this.economy.level}`);
          inventoryText.setText(getInventoryLabel());
          statusText.setText(this.statusMessage);
        });
      });
    };

    const resetSave = (): void => {
      this.saveSystem.clearSave();
      const reset = this.saveSystem.loadGame();
      this.farmTiles = reset.farmTiles;
      this.economy = reset.economy;
      this.inventory = reset.inventory;
      this.selectedCropId = reset.selectedCropId;
      this.statusMessage = 'Save reset to default state.';
      this.scene.restart();
    };

    resetButton.on('pointerdown', resetSave);
    sellButton.on('pointerdown', sellInventory);
    uploadButton.on('pointerdown', () => {
      void uploadRemoteSave();
    });
    downloadButton.on('pointerdown', () => {
      void downloadRemoteSave();
    });

    if (isDevMode) {
      const speedOne = this.add
        .text(620, 98, '1x', {
          color: '#ffffff',
          backgroundColor: '#7a3b00',
          fontSize: '13px',
          fontFamily: 'Arial',
          padding: { x: 8, y: 4 },
        })
        .setInteractive({ useHandCursor: true })
        .setDepth(2);

      const speedTen = this.add
        .text(665, 98, '10x', {
          color: '#ffffff',
          backgroundColor: '#7a3b00',
          fontSize: '13px',
          fontFamily: 'Arial',
          padding: { x: 8, y: 4 },
        })
        .setInteractive({ useHandCursor: true })
        .setDepth(2);

      const speedHundred = this.add
        .text(720, 98, '100x', {
          color: '#ffffff',
          backgroundColor: '#7a3b00',
          fontSize: '13px',
          fontFamily: 'Arial',
          padding: { x: 8, y: 4 },
        })
        .setInteractive({ useHandCursor: true })
        .setDepth(2);

      speedOne.on('pointerdown', () => applyDevSpeed(1));
      speedTen.on('pointerdown', () => applyDevSpeed(10));
      speedHundred.on('pointerdown', () => applyDevSpeed(100));

      this.input.keyboard?.on('keydown-ONE', () => applyDevSpeed(1));
      this.input.keyboard?.on('keydown-TWO', () => applyDevSpeed(10));
      this.input.keyboard?.on('keydown-THREE', () => applyDevSpeed(100));
    }

    this.input.keyboard?.on('keydown-R', resetSave);
    this.input.keyboard?.on('keydown-S', sellInventory);
    this.input.keyboard?.on('keydown-U', () => {
      void uploadRemoteSave();
    });
    this.input.keyboard?.on('keydown-D', () => {
      void downloadRemoteSave();
    });

    if (this.statusMessage) {
      statusText.setText(this.statusMessage);
    }

    hudText.setText(`Coins: ${this.economy.coins} | XP: ${this.economy.xp} | Level: ${this.economy.level}`);
    inventoryText.setText(getInventoryLabel());
    setSyncLabel('idle');
    refreshDevSpeedLabel();
    refreshSelectedSeedLabel();
    renderSeedSelector();

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
