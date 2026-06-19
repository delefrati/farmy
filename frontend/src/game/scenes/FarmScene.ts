import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import type { FarmTile } from '../types/farm';
import type { PlayerEconomy } from '../types/economy';
import type { PlayerInventory } from '../types/inventory';
import type { PlayerAnimals } from '../types/animals';
import { crops, defaultCropId } from '../data/crops';
import type { CropDefinition } from '../types/crop';
import { RemoteSaveService } from '../services/RemoteSaveService';
import { getLevelFromXp, getXpToNextLevel } from '../data/progression';
import { decorations, defaultDecorationId } from '../data/decorations';
import type { DecorationDefinition } from '../types/decoration';
import {
  CARE,
  clearTileCare,
  getActiveProblems,
  initTileCare,
  isCropDead,
  removePests,
  removeWeeds,
  simulateTileCare,
  waterTile,
} from '../systems/CareSystem';

type TileVisual = {
  rect: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  subtitle: Phaser.GameObjects.Text;
};

export class FarmScene extends Phaser.Scene {
  private static readonly CHICKEN_COOP_PRICE = 120;

  private static readonly CHICKEN_COOP_UNLOCK_LEVEL = 3;

  private static readonly EGG_SECONDS = 120;

  private static readonly EGG_CAP_PER_COOP = 4;

  private readonly saveSystem = new SaveSystem();

  private readonly remoteSaveService = new RemoteSaveService();

  private farmTiles: FarmTile[] = [];

  private economy: PlayerEconomy = { coins: 100, xp: 0, level: 1 };

  private selectedCropId = defaultCropId;

  private inventory: PlayerInventory = {};

  private animals: PlayerAnimals = { chickenCoops: 0, eggs: 0, lastEggTickAt: Date.now() };

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
    let decorationMode = false;
    let selectedDecorationId = defaultDecorationId;

    const loaded = this.saveSystem.loadGame();
    this.farmTiles = loaded.farmTiles;
    this.economy = loaded.economy;
    this.inventory = loaded.inventory;
    this.animals = loaded.animals;
    this.selectedCropId = loaded.selectedCropId;

    // Advance crop care for any time that passed while the game was closed.
    this.farmTiles.forEach((tile) => {
      simulateTileCare(tile, Date.now(), growthTimeScale);
      const crop = crops.find((item) => item.id === tile.cropId);
      if (crop && isCropDead(tile, crop.growSeconds, Date.now(), growthTimeScale)) {
        tile.state = 'dead';
      }
    });

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

    const progressionText = this.add
      .text(24, 76, '', {
        color: '#2f4f1f',
        fontSize: '14px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const selectedSeedText = this.add
      .text(24, 92, '', {
        color: '#2f4f1f',
        fontSize: '16px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const selectedSeedMetaText = this.add
      .text(24, 110, '', {
        color: '#335a2a',
        fontSize: '13px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const decorationModeText = this.add
      .text(24, 240, '', {
        color: '#5f3b8a',
        fontSize: '12px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const statusText = this.add
      .text(24, 128, 'Click empty tile to plant. Click a crop to care (water/weeds/pests) or harvest. Sell with S.', {
        color: '#3f5f2f',
        fontSize: '14px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const inventoryText = this.add
      .text(24, 148, 'Inventory: empty', {
        color: '#2f4f1f',
        fontSize: '14px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const syncText = this.add
      .text(24, 166, 'Sync: idle | Last sync: never', {
        color: '#1f5c99',
        fontSize: '13px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const authText = this.add
      .text(24, 184, '', {
        color: '#0f4f8c',
        fontSize: '13px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const devSpeedText = this.add
      .text(24, 202, '', {
        color: '#7a3b00',
        fontSize: '13px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const animalsText = this.add
      .text(24, 258, '', {
        color: '#5b3c18',
        fontSize: '13px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const controlsHintText = this.add
      .text(24, 220, 'Shortcuts: S sell | R reset | L login | U upload | D download | G decor mode', {
        color: '#36522a',
        fontSize: '12px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    controlsHintText.setText('Shortcuts: S sell | R reset | L login | U upload | D download | G decor mode');

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

    const registerButton = this.add
      .text(24, 22, 'Register', {
        color: '#ffffff',
        backgroundColor: '#345c7a',
        fontSize: '14px',
        fontFamily: 'Arial',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const loginButton = this.add
      .text(120, 22, 'Login (L)', {
        color: '#ffffff',
        backgroundColor: '#345c7a',
        fontSize: '14px',
        fontFamily: 'Arial',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const logoutButton = this.add
      .text(220, 22, 'Logout', {
        color: '#ffffff',
        backgroundColor: '#6f3c3c',
        fontSize: '14px',
        fontFamily: 'Arial',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const decorationModeButton = this.add
      .text(890, 22, 'Decor Mode (G)', {
        color: '#ffffff',
        backgroundColor: '#5f3b8a',
        fontSize: '14px',
        fontFamily: 'Arial',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const buyCoopButton = this.add
      .text(890, 56, 'Buy Coop (A)', {
        color: '#ffffff',
        backgroundColor: '#7b4f1d',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const collectEggsButton = this.add
      .text(890, 84, 'Collect Eggs (E)', {
        color: '#ffffff',
        backgroundColor: '#7b4f1d',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
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

    const getDecoration = (decorationId: string | undefined): DecorationDefinition | undefined => {
      if (!decorationId) {
        return undefined;
      }

      return decorations.find((decoration) => decoration.id === decorationId);
    };

    const getSelectedDecoration = (): DecorationDefinition => {
      const selected = getDecoration(selectedDecorationId);
      return selected ?? decorations[0];
    };

    const refreshSelectedSeedLabel = (): void => {
      const selected = getSelectedCrop();
      selectedSeedText.setText(`Selected seed: ${selected.name} (Cost: ${selected.seedPrice})`);
      selectedSeedMetaText.setText(
        `Sell: ${selected.sellPrice} | Profit: ${selected.sellPrice - selected.seedPrice} | Growth: ${selected.growSeconds}s | XP: +${selected.xp}`,
      );

      const selectedDecoration = getSelectedDecoration();
      const modeLabel = decorationMode ? 'ON' : 'OFF';
      decorationModeText.setText(
        `Decor Mode: ${modeLabel} | Decor: ${selectedDecoration.name} (${selectedDecoration.price} coins) | Hotkey: G`,
      );
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

    const refreshHud = (): void => {
      hudText.setText(`Coins: ${this.economy.coins} | XP: ${this.economy.xp} | Level: ${this.economy.level}`);
      const missingXp = getXpToNextLevel(this.economy.xp, this.economy.level);
      progressionText.setText(`Next level in ${missingXp} XP`);
    };

    const saveCurrent = (): void => {
      this.saveSystem.saveGame({
        economy: this.economy,
        inventory: this.inventory,
        animals: this.animals,
        selectedCropId: this.selectedCropId,
        farmTiles: this.farmTiles,
      });
    };

    const buildCurrentSave = () => {
      return this.saveSystem.saveGame({
        economy: this.economy,
        inventory: this.inventory,
        animals: this.animals,
        selectedCropId: this.selectedCropId,
        farmTiles: this.farmTiles,
      });
    };

    const toTimestamp = (iso: string): number => {
      const parsed = Date.parse(iso);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const getInventoryLabel = (): string => {
      const entries = Object.entries(this.inventory).filter(([, amount]) => amount > 0);
      if (entries.length === 0) {
        return 'Inventory: empty';
      }

      const text = entries.map(([cropId, amount]) => `${cropId} x${amount}`).join(' | ');
      return `Inventory: ${text}`;
    };

    const refreshAnimalsLabel = (): void => {
      animalsText.setText(
        `Animals: Chicken coops ${this.animals.chickenCoops} | Eggs ready ${this.animals.eggs}`,
      );
    };

    const updateEggProduction = (): void => {
      if (this.animals.chickenCoops <= 0) {
        return;
      }

      const now = Date.now();
      const elapsedSeconds = Math.max(0, (now - this.animals.lastEggTickAt) / 1000);
      const producedCycles = Math.floor(elapsedSeconds / FarmScene.EGG_SECONDS);
      if (producedCycles <= 0) {
        return;
      }

      const maxEggs = this.animals.chickenCoops * FarmScene.EGG_CAP_PER_COOP;
      const availableSpace = Math.max(maxEggs - this.animals.eggs, 0);
      if (availableSpace <= 0) {
        return;
      }

      const eggsToAdd = Math.min(producedCycles, availableSpace);
      this.animals.eggs += eggsToAdd;
      this.animals.lastEggTickAt += eggsToAdd * FarmScene.EGG_SECONDS * 1000;

      refreshAnimalsLabel();
      saveCurrent();
    };

    const buyChickenCoop = (): void => {
      if (this.economy.level < FarmScene.CHICKEN_COOP_UNLOCK_LEVEL) {
        this.statusMessage = `Chicken coop unlocks at level ${FarmScene.CHICKEN_COOP_UNLOCK_LEVEL}.`;
        statusText.setText(this.statusMessage);
        return;
      }

      if (this.economy.coins < FarmScene.CHICKEN_COOP_PRICE) {
        this.statusMessage = 'Not enough coins to buy a chicken coop.';
        statusText.setText(this.statusMessage);
        return;
      }

      this.economy.coins -= FarmScene.CHICKEN_COOP_PRICE;
      this.animals.chickenCoops += 1;
      this.animals.lastEggTickAt = Date.now();
      this.statusMessage = `Chicken coop purchased. -${FarmScene.CHICKEN_COOP_PRICE} coins.`;

      refreshHud();
      refreshAnimalsLabel();
      saveCurrent();
      statusText.setText(this.statusMessage);
    };

    const collectEggs = (): void => {
      updateEggProduction();

      if (this.animals.eggs <= 0) {
        this.statusMessage = 'No eggs ready yet.';
        statusText.setText(this.statusMessage);
        return;
      }

      const eggsCollected = this.animals.eggs;
      this.inventory.egg = (this.inventory.egg ?? 0) + eggsCollected;
      this.animals.eggs = 0;
      this.animals.lastEggTickAt = Date.now();

      this.economy.xp += eggsCollected * 2;
      this.economy.level = getLevelFromXp(this.economy.xp);

      this.statusMessage = `Collected ${eggsCollected} eggs. +${eggsCollected * 2} XP.`;

      refreshHud();
      refreshAnimalsLabel();
      inventoryText.setText(getInventoryLabel());
      saveCurrent();
      statusText.setText(this.statusMessage);
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

    const refreshAuthLabel = (): void => {
      const authSummary = this.remoteSaveService.getAuthSummary();
      authText.setText(`Auth: ${authSummary}`);
    };

    const setSyncLabel = (state: 'idle' | 'syncing' | 'success' | 'error', message?: string): void => {
      const authSummary = this.remoteSaveService.getAuthSummary();

      if (state === 'syncing') {
        syncText.setText(`Sync: in progress... | User: ${authSummary}`);
        return;
      }

      if (message) {
        syncText.setText(`Sync: ${message} | Last sync: ${lastSyncLabel} | User: ${authSummary}`);
        return;
      }

      syncText.setText(`Sync: ${state} | Last sync: ${lastSyncLabel} | User: ${authSummary}`);
    };

    const promptCredentials = (): { email: string; password: string } | null => {
      const email = window.prompt('Email')?.trim() ?? '';
      if (!email) {
        return null;
      }

      const password = window.prompt('Password (min 6 chars)') ?? '';
      if (!password) {
        return null;
      }

      return { email, password };
    };

    const register = async (): Promise<void> => {
      const credentials = promptCredentials();
      if (!credentials) {
        return;
      }

      try {
        await this.remoteSaveService.register(credentials.email, credentials.password);
        this.statusMessage = 'Registration successful and logged in.';
        refreshAuthLabel();
        setSyncLabel('idle', 'ready');
      } catch (error) {
        this.statusMessage = `Register failed: ${String(error)}`;
      }

      statusText.setText(this.statusMessage);
    };

    const login = async (): Promise<void> => {
      const credentials = promptCredentials();
      if (!credentials) {
        return;
      }

      try {
        await this.remoteSaveService.login(credentials.email, credentials.password);
        this.statusMessage = 'Login successful.';
        refreshAuthLabel();
        setSyncLabel('idle', 'ready');
      } catch (error) {
        this.statusMessage = `Login failed: ${String(error)}`;
      }

      statusText.setText(this.statusMessage);
    };

    const logout = (): void => {
      this.remoteSaveService.logout();
      this.statusMessage = 'Logged out.';
      refreshAuthLabel();
      setSyncLabel('idle', 'auth required');
      statusText.setText(this.statusMessage);
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

    const renderDecorationSelector = (): void => {
      this.add
        .text(430, 94, 'Decorations:', {
          color: '#4f2f77',
          fontSize: '14px',
          fontFamily: 'Arial',
        })
        .setDepth(2);

      decorations.forEach((decoration, index) => {
        const isSelected = decoration.id === selectedDecorationId;
        const isUnlocked = this.economy.level >= decoration.unlockLevel;

        const button = this.add
          .text(520 + index * 150, 92, `${decoration.name}\nL${decoration.unlockLevel}`, {
            color: '#ffffff',
            backgroundColor: isSelected ? '#5f3b8a' : isUnlocked ? '#7751a1' : '#777777',
            fontSize: '11px',
            fontFamily: 'Arial',
            padding: { x: 8, y: 5 },
            align: 'center',
          })
          .setInteractive({ useHandCursor: true })
          .setDepth(2);

        button.on('pointerdown', () => {
          if (!isUnlocked) {
            this.statusMessage = `${decoration.name} unlocks at level ${decoration.unlockLevel}.`;
            statusText.setText(this.statusMessage);
            return;
          }

          selectedDecorationId = decoration.id;
          refreshSelectedSeedLabel();
          this.statusMessage = `${decoration.name} selected.`;
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
      refreshHud();
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

        const remoteSave = await this.remoteSaveService.downloadSave();
        if (remoteSave && toTimestamp(remoteSave.savedAt) > toTimestamp(currentSave.savedAt)) {
          this.statusMessage = 'Upload blocked: remote save is newer. Download first.';
          setSyncLabel('error', 'upload blocked by newer remote');
          statusText.setText(this.statusMessage);
          return;
        }

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
        const localSave = this.saveSystem.loadGame();
        const remoteSave = await this.remoteSaveService.downloadSave();
        if (!remoteSave) {
          this.statusMessage = 'No remote save found yet.';
          setSyncLabel('idle', 'no remote save');
          statusText.setText(this.statusMessage);
          return;
        }

        if (toTimestamp(remoteSave.savedAt) < toTimestamp(localSave.savedAt)) {
          this.statusMessage = 'Download blocked: local save is newer. Upload first.';
          setSyncLabel('error', 'download blocked by newer local');
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
        const decoration = getDecoration(tile.decorationId);
        if (decoration) {
          visual.rect.setFillStyle(decoration.color);
          visual.title.setText(`Decor: ${decoration.name}`);
          visual.subtitle.setText('Decorative tile');
        } else {
          visual.rect.setFillStyle(0xc4955f);
          visual.title.setText('');
          visual.subtitle.setText('');
        }
        return;
      }

      if (tile.state === 'dead') {
        visual.rect.setFillStyle(0x5a5a5a);
        visual.title.setText('Withered');
        visual.subtitle.setText('Clear with hoe (click)');
        return;
      }

      const growth = getGrowth(tile);
      if (!growth) {
        visual.rect.setFillStyle(0x7a5230);
        visual.title.setText('Planted');
        visual.subtitle.setText('');
        return;
      }

      const problems = getActiveProblems(tile);
      const health = Math.round(tile.health ?? CARE.MAX_HEALTH);

      if (problems.length > 0) {
        visual.rect.setFillStyle(0xb06a2e);
      } else if (growth.ready) {
        visual.rect.setFillStyle(0x4e8b3a);
      } else {
        visual.rect.setFillStyle(0x7a5230);
      }

      visual.title.setText(`${growth.crop.name} • ${growth.stageLabel}`);
      const statusPart = growth.ready ? 'Ready' : `${Math.floor(growth.progress * 100)}%`;
      const problemPart = problems.length > 0 ? ` | ${problems.join(',')}` : '';
      visual.subtitle.setText(`${statusPart} | HP ${health}${problemPart}`);
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
          if (decorationMode) {
            const selectedDecoration = getSelectedDecoration();

            if (this.economy.level < selectedDecoration.unlockLevel) {
              this.statusMessage = `${selectedDecoration.name} unlocks at level ${selectedDecoration.unlockLevel}.`;
              statusText.setText(this.statusMessage);
              return;
            }

            if (tile.state !== 'empty') {
              this.statusMessage = 'Decor can only be placed on empty tiles.';
              statusText.setText(this.statusMessage);
              return;
            }

            if (tile.decorationId) {
              this.statusMessage = 'Tile already has decoration.';
              statusText.setText(this.statusMessage);
              return;
            }

            if (this.economy.coins < selectedDecoration.price) {
              this.statusMessage = `Not enough coins to place ${selectedDecoration.name}.`;
              statusText.setText(this.statusMessage);
              return;
            }

            tile.decorationId = selectedDecoration.id;
            this.economy.coins -= selectedDecoration.price;
            this.statusMessage = `${selectedDecoration.name} placed. -${selectedDecoration.price} coins.`;

            saveCurrent();
            refreshTileVisual(tile);
            refreshHud();
            statusText.setText(this.statusMessage);
            return;
          }

          const selectedCrop = getSelectedCrop();

          if (tile.state === 'dead') {
            tile.state = 'empty';
            tile.cropId = undefined;
            tile.plantedAt = undefined;
            tile.decorationId = undefined;
            clearTileCare(tile);
            this.statusMessage = 'Cleared withered crop with the hoe.';
            saveCurrent();
            refreshTileVisual(tile);
            statusText.setText(this.statusMessage);
            return;
          }

          if (tile.state === 'planted') {
            // Care-first: resolve the most urgent problem before harvesting.
            if (tile.hasPests) {
              removePests(tile);
              this.economy.xp += 1;
              this.economy.level = getLevelFromXp(this.economy.xp);
              this.statusMessage = 'Removed pests. +1 XP.';
              saveCurrent();
              refreshTileVisual(tile);
              refreshHud();
              statusText.setText(this.statusMessage);
              return;
            }

            if (tile.hasWeeds) {
              removeWeeds(tile);
              this.economy.xp += 1;
              this.economy.level = getLevelFromXp(this.economy.xp);
              this.statusMessage = 'Removed weeds. +1 XP.';
              saveCurrent();
              refreshTileVisual(tile);
              refreshHud();
              statusText.setText(this.statusMessage);
              return;
            }

            if (tile.isDry) {
              waterTile(tile, Date.now());
              this.economy.xp += 1;
              this.economy.level = getLevelFromXp(this.economy.xp);
              this.statusMessage = 'Watered crop. +1 XP.';
              saveCurrent();
              refreshTileVisual(tile);
              refreshHud();
              statusText.setText(this.statusMessage);
              return;
            }

            const growth = getGrowth(tile);
            if (!growth?.ready) {
              this.statusMessage = 'Crop is still growing. Wait until it is ready.';
              statusText.setText(this.statusMessage);
              return;
            }

            const cropId = growth.crop.id;
            this.inventory[cropId] = (this.inventory[cropId] ?? 0) + 1;
            const previousLevel = this.economy.level;
            // Health scales the XP reward between 40% and 100%.
            const healthFactor = Math.max(0, Math.min(1, (tile.health ?? CARE.MAX_HEALTH) / CARE.MAX_HEALTH));
            const xpGain = Math.max(1, Math.round(growth.crop.xp * (0.4 + 0.6 * healthFactor)));
            this.economy.xp += xpGain;
            this.economy.level = getLevelFromXp(this.economy.xp);

            tile.state = 'empty';
            tile.cropId = undefined;
            tile.plantedAt = undefined;
            clearTileCare(tile);

            if (this.economy.level > previousLevel) {
              const unlockedNames = getUnlockedCropNames(previousLevel, this.economy.level);
              const unlockSuffix = unlockedNames.length > 0 ? ` Unlocked: ${unlockedNames.join(', ')}.` : '';
              this.statusMessage = `Level up! You reached level ${this.economy.level}.${unlockSuffix}`;
              saveCurrent();
              this.scene.restart();
              return;
            }

            this.statusMessage = `${growth.crop.name} harvested. +1 in inventory. +${xpGain} XP.`;

            saveCurrent();
            refreshTileVisual(tile);
            refreshHud();
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
          tile.decorationId = undefined;
          initTileCare(tile, Date.now());
          this.economy.coins -= selectedCrop.seedPrice;
          this.statusMessage = `${selectedCrop.name} planted. -${selectedCrop.seedPrice} coins.`;

          saveCurrent();
          refreshTileVisual(tile);
          refreshHud();
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
      this.animals = reset.animals;
      this.selectedCropId = reset.selectedCropId;
      this.statusMessage = 'Save reset to default state.';
      this.scene.restart();
    };

    resetButton.on('pointerdown', resetSave);
    sellButton.on('pointerdown', sellInventory);
    registerButton.on('pointerdown', () => {
      void register();
    });
    loginButton.on('pointerdown', () => {
      void login();
    });
    logoutButton.on('pointerdown', logout);
    decorationModeButton.on('pointerdown', () => {
      decorationMode = !decorationMode;
      this.statusMessage = decorationMode ? 'Decoration mode enabled.' : 'Decoration mode disabled.';
      refreshSelectedSeedLabel();
      statusText.setText(this.statusMessage);
    });
    buyCoopButton.on('pointerdown', buyChickenCoop);
    collectEggsButton.on('pointerdown', collectEggs);
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
    this.input.keyboard?.on('keydown-L', () => {
      void login();
    });
    this.input.keyboard?.on('keydown-A', buyChickenCoop);
    this.input.keyboard?.on('keydown-E', collectEggs);
    this.input.keyboard?.on('keydown-G', () => {
      decorationMode = !decorationMode;
      this.statusMessage = decorationMode ? 'Decoration mode enabled.' : 'Decoration mode disabled.';
      refreshSelectedSeedLabel();
      statusText.setText(this.statusMessage);
    });
    this.input.keyboard?.on('keydown-OPEN_BRACKET', () => {
      const currentIndex = decorations.findIndex((item) => item.id === selectedDecorationId);
      const nextIndex = currentIndex <= 0 ? decorations.length - 1 : currentIndex - 1;
      selectedDecorationId = decorations[nextIndex].id;
      refreshSelectedSeedLabel();
      this.statusMessage = `${decorations[nextIndex].name} selected.`;
      statusText.setText(this.statusMessage);
      this.scene.restart();
    });
    this.input.keyboard?.on('keydown-CLOSE_BRACKET', () => {
      const currentIndex = decorations.findIndex((item) => item.id === selectedDecorationId);
      const nextIndex = currentIndex >= decorations.length - 1 ? 0 : currentIndex + 1;
      selectedDecorationId = decorations[nextIndex].id;
      refreshSelectedSeedLabel();
      this.statusMessage = `${decorations[nextIndex].name} selected.`;
      statusText.setText(this.statusMessage);
      this.scene.restart();
    });
    this.input.keyboard?.on('keydown-U', () => {
      void uploadRemoteSave();
    });
    this.input.keyboard?.on('keydown-D', () => {
      void downloadRemoteSave();
    });

    if (this.statusMessage) {
      statusText.setText(this.statusMessage);
    }

    refreshHud();
    inventoryText.setText(getInventoryLabel());
    refreshAnimalsLabel();
    refreshAuthLabel();
    setSyncLabel('idle');
    refreshDevSpeedLabel();
    refreshSelectedSeedLabel();
    renderSeedSelector();
    renderDecorationSelector();

    renderGrid();

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        updateEggProduction();
        let hasPlanted = false;
        this.farmTiles.forEach((tile) => {
          if (tile.state === 'planted') {
            hasPlanted = true;
            simulateTileCare(tile, Date.now(), growthTimeScale);
            const crop = getCrop(tile.cropId);
            if (crop && isCropDead(tile, crop.growSeconds, Date.now(), growthTimeScale)) {
              tile.state = 'dead';
            }
            refreshTileVisual(tile);
          }
        });
        // Persist care progression so decay/problems survive a reload even
        // when the player performs no explicit action.
        if (hasPlanted) {
          saveCurrent();
        }
      },
    });
  }
}
