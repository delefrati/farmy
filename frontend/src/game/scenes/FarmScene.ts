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
import { fertilizers, defaultFertilizerId } from '../data/fertilizers';
import type { FertilizerDefinition } from '../types/fertilizer';
import { animalDefinitions, getAnimalDefinition } from '../data/animals';
import type { FarmEvent, Gift, NeighborFarm } from '../types/social';
import { formatEventTime, pushEvent, SOCIAL } from '../systems/SocialSystem';
import {
  ANIMAL,
  createAnimalInstance,
  feedAnimal,
  foodRemainingSeconds,
  getGrowthStageLabel,
  isFed,
  simulateAnimal,
} from '../systems/AnimalSystem';
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
  private readonly saveSystem = new SaveSystem();

  private readonly remoteSaveService = new RemoteSaveService();

  private farmTiles: FarmTile[] = [];

  private economy: PlayerEconomy = { coins: 100, xp: 0, level: 1 };

  private selectedCropId = defaultCropId;

  private inventory: PlayerInventory = {};

  private fertilizers: PlayerInventory = {};

  private animals: PlayerAnimals = { animals: [] };

  private neighbors: NeighborFarm[] = [];

  private farmEvents: FarmEvent[] = [];

  private popularity = 0;

  private giftInbox: Gift[] = [];

  private hasDog = false;

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
    let fertilizerMode = false;
    let selectedFertilizerId = defaultFertilizerId;

    const loaded = this.saveSystem.loadGame();
    this.farmTiles = loaded.farmTiles;
    this.economy = loaded.economy;
    this.inventory = loaded.inventory;
    this.fertilizers = loaded.fertilizers;
    this.animals = loaded.animals;
    this.neighbors = loaded.neighbors;
    this.farmEvents = loaded.events;
    this.popularity = loaded.popularity;
    this.giftInbox = loaded.giftInbox;
    this.hasDog = loaded.hasDog;
    this.selectedCropId = loaded.selectedCropId;

    // Advance crop care for any time that passed while the game was closed.
    this.farmTiles.forEach((tile) => {
      simulateTileCare(tile, Date.now(), growthTimeScale);
      const crop = crops.find((item) => item.id === tile.cropId);
      if (crop && isCropDead(tile, crop.growSeconds, Date.now(), growthTimeScale)) {
        tile.state = 'dead';
      }
    });

    // Advance animals for any time that passed while the game was closed.
    this.animals.animals.forEach((animal) => {
      const def = getAnimalDefinition(animal.defId);
      if (def) {
        simulateAnimal(animal, def, Date.now(), growthTimeScale);
      }
    });

    const tileVisuals = new Map<string, TileVisual>();

    this.add
      .text(24, 836, 'Farmy — mechanics prototype', {
        color: '#3f5f2f',
        fontSize: '12px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const hudText = this.add
      .text(24, 100, '', {
        color: '#2f4f1f',
        backgroundColor: '#9fdd7a',
        fontSize: '16px',
        fontFamily: 'Arial',
        padding: { x: 2, y: 1 },
      })
      .setDepth(1);

    const popularityText = this.add
      .text(360, 100, '', {
        color: '#8a3b6a',
        fontSize: '15px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const collectGiftsButton = this.add
      .text(360, 122, 'Collect Gifts (C)', {
        color: '#ffffff',
        backgroundColor: '#8a3b6a',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const dogText = this.add
      .text(360, 150, '', {
        color: '#5a3a1a',
        fontSize: '13px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const buyDogButton = this.add
      .text(360, 170, `Buy Guard Dog (K) - ${SOCIAL.DOG_PRICE}c`, {
        color: '#ffffff',
        backgroundColor: '#6a4a2a',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const progressionText = this.add
      .text(24, 122, '', {
        color: '#2f4f1f',
        fontSize: '14px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const selectedSeedText = this.add
      .text(24, 144, '', {
        color: '#2f4f1f',
        fontSize: '16px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const selectedSeedMetaText = this.add
      .text(24, 164, '', {
        color: '#335a2a',
        fontSize: '13px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const decorationModeText = this.add
      .text(24, 286, '', {
        color: '#5f3b8a',
        fontSize: '12px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const statusText = this.add
      .text(24, 188, 'Click empty tile to plant. Click a crop to care (water/weeds/pests) or harvest. Sell with S.', {
        color: '#3f5f2f',
        fontSize: '14px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const inventoryText = this.add
      .text(24, 210, 'Inventory: empty', {
        color: '#2f4f1f',
        fontSize: '14px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const syncText = this.add
      .text(24, 230, 'Sync: idle | Last sync: never', {
        color: '#1f5c99',
        fontSize: '13px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const authText = this.add
      .text(24, 248, '', {
        color: '#0f4f8c',
        fontSize: '13px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const devSpeedText = this.add
      .text(24, 266, '', {
        color: '#7a3b00',
        fontSize: '13px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const animalsText = this.add
      .text(820, 150, '', {
        color: '#5b3c18',
        fontSize: '13px',
        fontFamily: 'Arial',
        lineSpacing: 2,
      })
      .setDepth(1);

    this.add
      .text(820, 124, 'Barn', {
        color: '#5b3c18',
        fontSize: '15px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      })
      .setDepth(1);

    this.add
      .text(1058, 116, 'Neighbors', {
        color: '#2f4f1f',
        fontSize: '15px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      })
      .setDepth(1);

    const visitButtons: Phaser.GameObjects.Text[] = this.neighbors.map((neighbor, index) =>
      this.add
        .text(1058, 142 + index * 34, `Visit ${neighbor.name}`, {
          color: '#ffffff',
          backgroundColor: '#345c7a',
          fontSize: '13px',
          fontFamily: 'Arial',
          padding: { x: 8, y: 5 },
        })
        .setInteractive({ useHandCursor: true })
        .setDepth(2),
    );

    this.add
      .text(1058, 142 + this.neighbors.length * 34 + 6, 'Activity log', {
        color: '#2f4f1f',
        fontSize: '14px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      })
      .setDepth(1);

    const eventLogText = this.add
      .text(1058, 142 + this.neighbors.length * 34 + 28, '', {
        color: '#3a5530',
        fontSize: '11px',
        fontFamily: 'Arial',
        lineSpacing: 3,
        wordWrap: { width: 210 },
      })
      .setDepth(1);

    const controlsHintText = this.add
      .text(24, 304, 'Shortcuts: S sell | R reset | L login | U upload | D download | G decor | F fertilize | B buy fert | ,/. switch | A feed | E collect | M sell mature | C gifts | K dog', {
        color: '#36522a',
        fontSize: '12px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    controlsHintText.setText('Shortcuts: S sell | R reset | L login | U upload | D download | G decor | F fertilize | B buy fert | ,/. switch | A feed | E collect | M sell mature | C gifts | K dog');

    this.add
      .rectangle(640, 640, 816, 420, 0x6c9a4b)
      .setStrokeStyle(4, 0x4b6d33)
      .setDepth(0);

    const resetButton = this.add
      .text(790, 14, 'Reset Save (R)', {
        color: '#ffffff',
        backgroundColor: '#955728',
        fontSize: '16px',
        fontFamily: 'Arial',
        padding: { x: 12, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const sellButton = this.add
      .text(630, 14, 'Sell Inventory (S)', {
        color: '#ffffff',
        backgroundColor: '#2f7a41',
        fontSize: '16px',
        fontFamily: 'Arial',
        padding: { x: 12, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const uploadButton = this.add
      .text(470, 14, 'Upload Save (U)', {
        color: '#ffffff',
        backgroundColor: '#1f5c99',
        fontSize: '16px',
        fontFamily: 'Arial',
        padding: { x: 12, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const downloadButton = this.add
      .text(300, 14, 'Download Save (D)', {
        color: '#ffffff',
        backgroundColor: '#1f5c99',
        fontSize: '16px',
        fontFamily: 'Arial',
        padding: { x: 12, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const registerButton = this.add
      .text(24, 14, 'Register', {
        color: '#ffffff',
        backgroundColor: '#345c7a',
        fontSize: '14px',
        fontFamily: 'Arial',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const loginButton = this.add
      .text(120, 14, 'Login (L)', {
        color: '#ffffff',
        backgroundColor: '#345c7a',
        fontSize: '14px',
        fontFamily: 'Arial',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const logoutButton = this.add
      .text(210, 14, 'Logout', {
        color: '#ffffff',
        backgroundColor: '#6f3c3c',
        fontSize: '14px',
        fontFamily: 'Arial',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const decorationModeButton = this.add
      .text(24, 54, 'Decor Mode (G)', {
        color: '#ffffff',
        backgroundColor: '#5f3b8a',
        fontSize: '14px',
        fontFamily: 'Arial',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const buyChickenButton = this.add
      .text(820, 54, 'Buy Chicken', {
        color: '#ffffff',
        backgroundColor: '#7b4f1d',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const buyCalfButton = this.add
      .text(940, 54, 'Buy Calf', {
        color: '#ffffff',
        backgroundColor: '#7b4f1d',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const feedAnimalsButton = this.add
      .text(1040, 54, 'Feed All (A)', {
        color: '#ffffff',
        backgroundColor: '#5f7b1d',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const collectProductsButton = this.add
      .text(820, 88, 'Collect Products (E)', {
        color: '#ffffff',
        backgroundColor: '#7b4f1d',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const sellAnimalsButton = this.add
      .text(1010, 88, 'Sell Mature (M)', {
        color: '#ffffff',
        backgroundColor: '#2f7a41',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const fertilizerModeButton = this.add
      .text(175, 54, 'Fertilizer (F)', {
        color: '#ffffff',
        backgroundColor: '#2f6f3b',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const buyFertilizerButton = this.add
      .text(305, 54, 'Buy Fertilizer (B)', {
        color: '#ffffff',
        backgroundColor: '#2f6f3b',
        fontSize: '12px',
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

    const getFertilizer = (fertilizerId: string | undefined): FertilizerDefinition | undefined => {
      if (!fertilizerId) {
        return undefined;
      }

      return fertilizers.find((fertilizer) => fertilizer.id === fertilizerId);
    };

    const getSelectedFertilizer = (): FertilizerDefinition => {
      const selected = getFertilizer(selectedFertilizerId);
      return selected ?? fertilizers[0];
    };

    // Sell value for any inventory item: crops use their sellPrice, animal
    // products use the producing animal's product sell value.
    const animalProductValues: Record<string, number> = {};
    animalDefinitions.forEach((def) => {
      if (def.kind === 'productive' && def.productId && def.productSellValue) {
        animalProductValues[def.productId] = def.productSellValue;
      }
    });

    const getItemSellValue = (itemId: string): number => {
      const crop = getCrop(itemId);
      if (crop) {
        return crop.sellPrice;
      }
      return animalProductValues[itemId] ?? 0;
    };

    const refreshSelectedSeedLabel = (): void => {
      const selected = getSelectedCrop();
      selectedSeedText.setText(`Selected seed: ${selected.name} (Cost: ${selected.seedPrice})`);
      selectedSeedMetaText.setText(
        `Sell: ${selected.sellPrice} | Profit: ${selected.sellPrice - selected.seedPrice} | Growth: ${selected.growSeconds}s | XP: +${selected.xp}`,
      );

      const selectedDecoration = getSelectedDecoration();
      const modeLabel = decorationMode ? 'ON' : 'OFF';
      const selectedFertilizer = getSelectedFertilizer();
      const fertLabel = fertilizerMode ? 'ON' : 'OFF';
      const fertOwned = this.fertilizers[selectedFertilizer.id] ?? 0;
      decorationModeText.setText(
        `Decor: ${modeLabel} ${selectedDecoration.name} (${selectedDecoration.price}c) [G] | ` +
          `Fert: ${fertLabel} ${selectedFertilizer.name} -${selectedFertilizer.reduceSeconds}s ` +
          `(${selectedFertilizer.price}c, own ${fertOwned}) [F toggle, B buy, ,/. switch]`,
      );
    };

    const getGrowth = (
      tile: FarmTile,
    ): { crop: CropDefinition; stageLabel: string; stageIndex: number; progress: number; ready: boolean } | undefined => {
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
        stageIndex,
        progress,
        ready: progress >= 1,
      };
    };

    const refreshHud = (): void => {
      hudText.setText(`Coins: ${this.economy.coins} | XP: ${this.economy.xp} | Level: ${this.economy.level}`);
      const missingXp = getXpToNextLevel(this.economy.xp, this.economy.level);
      progressionText.setText(`Next level in ${missingXp} XP`);
      popularityText.setText(`\u2605 Popularity: ${this.popularity} | Gifts waiting: ${this.giftInbox.length}`);
      dogText.setText(
        this.hasDog
          ? '\u{1F415} Guard dog: ON (protecting your farm)'
          : '\u{1F415} Guard dog: none',
      );
      buyDogButton.setVisible(!this.hasDog);
    };

    const buyDog = (): void => {
      if (this.hasDog) {
        this.statusMessage = 'You already have a guard dog.';
        statusText.setText(this.statusMessage);
        return;
      }
      if (this.economy.coins < SOCIAL.DOG_PRICE) {
        this.statusMessage = `Not enough coins for a guard dog (need ${SOCIAL.DOG_PRICE}).`;
        statusText.setText(this.statusMessage);
        return;
      }

      this.economy.coins -= SOCIAL.DOG_PRICE;
      this.hasDog = true;
      this.farmEvents = pushEvent(
        this.farmEvents,
        'system',
        `You bought a guard dog for ${SOCIAL.DOG_PRICE} coins. Your farm is now protected.`,
        Date.now(),
      );
      this.statusMessage = 'Guard dog hired. Your farm is now protected.';

      refreshHud();
      refreshEventLog();
      saveCurrent();
      statusText.setText(this.statusMessage);
    };

    const collectGifts = (): void => {
      if (this.giftInbox.length === 0) {
        this.statusMessage = 'No gifts waiting. Gift a flower to a neighbor to get one back.';
        statusText.setText(this.statusMessage);
        return;
      }

      const count = this.giftInbox.length;
      const gained = count * SOCIAL.POPULARITY_PER_GIFT;
      this.popularity += gained;
      this.giftInbox = [];
      this.farmEvents = pushEvent(
        this.farmEvents,
        'system',
        `You collected ${count} flower gift(s). +${gained} popularity.`,
        Date.now(),
      );
      this.statusMessage = `Collected ${count} gift(s). +${gained} popularity.`;

      refreshHud();
      refreshEventLog();
      saveCurrent();
      statusText.setText(this.statusMessage);
    };

    const refreshEventLog = (): void => {
      if (this.farmEvents.length === 0) {
        eventLogText.setText('No activity yet. Visit a neighbor!');
        return;
      }

      const now = Date.now();
      const lines = this.farmEvents
        .slice(0, 8)
        .map((event) => `• [${formatEventTime(event.at, now)}] ${event.message}`);
      eventLogText.setText(lines.join('\n'));
    };

    const visitNeighbor = (neighborId: string): void => {
      saveCurrent();
      this.scene.start('NeighborScene', { neighborId });
    };

    const saveCurrent = (): void => {
      this.saveSystem.saveGame({
        economy: this.economy,
        inventory: this.inventory,
        fertilizers: this.fertilizers,
        animals: this.animals,
        selectedCropId: this.selectedCropId,
        farmTiles: this.farmTiles,
        neighbors: this.neighbors,
        events: this.farmEvents,
        popularity: this.popularity,
        giftInbox: this.giftInbox,
        hasDog: this.hasDog,
      });
    };

    const buildCurrentSave = () => {
      return this.saveSystem.saveGame({
        economy: this.economy,
        inventory: this.inventory,
        fertilizers: this.fertilizers,
        animals: this.animals,
        selectedCropId: this.selectedCropId,
        farmTiles: this.farmTiles,
        neighbors: this.neighbors,
        events: this.farmEvents,
        popularity: this.popularity,
        giftInbox: this.giftInbox,
        hasDog: this.hasDog,
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

    const simulateAllAnimals = (): void => {
      const now = Date.now();
      this.animals.animals.forEach((animal) => {
        const def = getAnimalDefinition(animal.defId);
        if (def) {
          simulateAnimal(animal, def, now, growthTimeScale);
        }
      });
    };

    const refreshAnimalsLabel = (): void => {
      if (this.animals.animals.length === 0) {
        animalsText.setText('Animals: none yet.\nBuy a Chicken (eggs) or a Calf (raise & sell).');
        return;
      }

      const now = Date.now();
      const lines = this.animals.animals.map((animal) => {
        const def = getAnimalDefinition(animal.defId);
        if (!def) {
          return '? unknown animal';
        }

        const fed = isFed(animal, now);
        const foodPart = fed ? `fed ${Math.ceil(foodRemainingSeconds(animal, now))}s` : 'HUNGRY';

        if (def.kind === 'productive') {
          const cap = def.produceCap ?? 0;
          return `${def.name}: ${animal.storedProduct}/${cap} ${def.productLabel ?? 'product'} | ${foodPart}`;
        }

        const stage = getGrowthStageLabel(animal, def);
        const state = animal.matured ? 'READY to sell' : stage;
        return `${def.name}: ${state} | ${foodPart}`;
      });

      animalsText.setText(`Animals (${this.animals.animals.length}):\n${lines.join('\n')}`);
    };

    const buyAnimal = (defId: string): void => {
      const def = getAnimalDefinition(defId);
      if (!def) {
        return;
      }

      if (this.economy.level < def.unlockLevel) {
        this.statusMessage = `${def.name} unlocks at level ${def.unlockLevel}.`;
        statusText.setText(this.statusMessage);
        return;
      }

      if (this.economy.coins < def.price) {
        this.statusMessage = `Not enough coins to buy a ${def.name}.`;
        statusText.setText(this.statusMessage);
        return;
      }

      this.economy.coins -= def.price;
      this.animals.animals.push(createAnimalInstance(def.id, Date.now()));
      this.statusMessage = `${def.name} purchased. -${def.price} coins. Feed it to start.`;

      refreshHud();
      refreshAnimalsLabel();
      saveCurrent();
      statusText.setText(this.statusMessage);
    };

    const feedAllAnimals = (): void => {
      simulateAllAnimals();

      if (this.animals.animals.length === 0) {
        this.statusMessage = 'No animals to feed.';
        statusText.setText(this.statusMessage);
        return;
      }

      const now = Date.now();
      let fedCount = 0;
      let spent = 0;

      this.animals.animals.forEach((animal) => {
        const def = getAnimalDefinition(animal.defId);
        if (!def) {
          return;
        }
        if (this.economy.coins < def.feedPrice) {
          return;
        }
        this.economy.coins -= def.feedPrice;
        spent += def.feedPrice;
        feedAnimal(animal, def, now);
        fedCount += 1;
      });

      if (fedCount === 0) {
        this.statusMessage = 'Not enough coins to feed any animal.';
        statusText.setText(this.statusMessage);
        return;
      }

      this.economy.xp += fedCount * ANIMAL.FEED_XP;
      this.economy.level = getLevelFromXp(this.economy.xp);
      this.statusMessage = `Fed ${fedCount} animal(s). -${spent} coins. +${fedCount * ANIMAL.FEED_XP} XP.`;

      refreshHud();
      refreshAnimalsLabel();
      saveCurrent();
      statusText.setText(this.statusMessage);
    };

    const collectProducts = (): void => {
      simulateAllAnimals();

      let collected = 0;
      this.animals.animals.forEach((animal) => {
        const def = getAnimalDefinition(animal.defId);
        if (!def || def.kind !== 'productive' || !def.productId) {
          return;
        }
        if (animal.storedProduct > 0) {
          this.inventory[def.productId] = (this.inventory[def.productId] ?? 0) + animal.storedProduct;
          collected += animal.storedProduct;
          animal.storedProduct = 0;
        }
      });

      if (collected <= 0) {
        this.statusMessage = 'No animal products ready yet.';
        statusText.setText(this.statusMessage);
        return;
      }

      const xpGain = collected * ANIMAL.COLLECT_XP_PER_PRODUCT;
      this.economy.xp += xpGain;
      this.economy.level = getLevelFromXp(this.economy.xp);
      this.statusMessage = `Collected ${collected} product(s). +${xpGain} XP.`;

      refreshHud();
      refreshAnimalsLabel();
      inventoryText.setText(getInventoryLabel());
      saveCurrent();
      statusText.setText(this.statusMessage);
    };

    const sellMaturedAnimals = (): void => {
      simulateAllAnimals();

      let totalCoins = 0;
      let soldCount = 0;
      this.animals.animals = this.animals.animals.filter((animal) => {
        const def = getAnimalDefinition(animal.defId);
        if (def && def.kind === 'growing' && animal.matured) {
          totalCoins += def.sellValue ?? 0;
          soldCount += 1;
          return false;
        }
        return true;
      });

      if (soldCount <= 0) {
        this.statusMessage = 'No mature animals ready to sell.';
        statusText.setText(this.statusMessage);
        return;
      }

      this.economy.coins += totalCoins;
      const xpGain = Math.max(1, Math.round(totalCoins / ANIMAL.SELL_XP_DIVISOR));
      this.economy.xp += xpGain;
      this.economy.level = getLevelFromXp(this.economy.xp);
      this.statusMessage = `Sold ${soldCount} mature animal(s) for +${totalCoins} coins. +${xpGain} XP.`;

      refreshHud();
      refreshAnimalsLabel();
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
        .text(24, 340, 'Seed Shop:', {
          color: '#1f3f10',
          fontSize: '16px',
          fontFamily: 'Arial',
        })
        .setDepth(2);

      crops.forEach((crop, index) => {
        const isSelected = crop.id === this.selectedCropId;
        const isUnlocked = this.economy.level >= crop.unlockLevel;

        const button = this.add
          .text(130 + index * 140, 334, `${crop.name}\nL${crop.unlockLevel}`, {
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
        .text(24, 390, 'Decorations:', {
          color: '#4f2f77',
          fontSize: '14px',
          fontFamily: 'Arial',
        })
        .setDepth(2);

      decorations.forEach((decoration, index) => {
        const isSelected = decoration.id === selectedDecorationId;
        const isUnlocked = this.economy.level >= decoration.unlockLevel;

        const button = this.add
          .text(130 + index * 150, 384, `${decoration.name}\nL${decoration.unlockLevel}`, {
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
      const remaining: PlayerInventory = {};

      entries.forEach(([itemId, amount]) => {
        const unitValue = getItemSellValue(itemId);
        if (unitValue > 0) {
          totalCoins += unitValue * amount;
        } else {
          // Keep items that have no sell value (don't wipe them).
          remaining[itemId] = amount;
        }
      });

      if (totalCoins <= 0) {
        this.statusMessage = 'No sellable items found in inventory.';
        statusText.setText(this.statusMessage);
        return;
      }

      this.economy.coins += totalCoins;
      this.inventory = remaining;

      saveCurrent();
      refreshHud();
      inventoryText.setText(getInventoryLabel());

      this.statusMessage = `Sold inventory for +${totalCoins} coins.`;
      statusText.setText(this.statusMessage);
    };

    const buyFertilizer = (): void => {
      const fertilizer = getSelectedFertilizer();

      if (this.economy.level < fertilizer.unlockLevel) {
        this.statusMessage = `${fertilizer.name} unlocks at level ${fertilizer.unlockLevel}.`;
        statusText.setText(this.statusMessage);
        return;
      }

      if (this.economy.coins < fertilizer.price) {
        this.statusMessage = `Not enough coins to buy ${fertilizer.name}.`;
        statusText.setText(this.statusMessage);
        return;
      }

      this.economy.coins -= fertilizer.price;
      this.fertilizers[fertilizer.id] = (this.fertilizers[fertilizer.id] ?? 0) + 1;
      this.statusMessage = `Bought ${fertilizer.name}. -${fertilizer.price} coins.`;

      saveCurrent();
      refreshHud();
      refreshSelectedSeedLabel();
      statusText.setText(this.statusMessage);
    };

    const cycleFertilizer = (direction: 1 | -1): void => {
      const currentIndex = fertilizers.findIndex((item) => item.id === selectedFertilizerId);
      const base = currentIndex < 0 ? 0 : currentIndex;
      const nextIndex = (base + direction + fertilizers.length) % fertilizers.length;
      selectedFertilizerId = fertilizers[nextIndex].id;
      refreshSelectedSeedLabel();
      this.statusMessage = `${fertilizers[nextIndex].name} selected.`;
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
        this.fertilizers = remoteSave.fertilizers;
        this.animals = remoteSave.animals;
        this.neighbors = remoteSave.neighbors;
        this.farmEvents = remoteSave.events;
        this.popularity = remoteSave.popularity;
        this.giftInbox = remoteSave.giftInbox;
        this.hasDog = remoteSave.hasDog;
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
      const totalSeasons = growth.crop.seasons ?? 1;
      const seasonPart = totalSeasons > 1 ? ` | S${tile.season ?? 1}/${totalSeasons}` : '';
      visual.subtitle.setText(`${statusPart} | HP ${health}${seasonPart}${problemPart}`);
    };

    const renderGrid = (): void => {
      const originX = 256;
      const originY = 444;

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

          if (fertilizerMode) {
            const fertilizer = getSelectedFertilizer();

            if (tile.state !== 'planted') {
              this.statusMessage = 'Fertilizer can only be used on a growing crop.';
              statusText.setText(this.statusMessage);
              return;
            }

            const growth = getGrowth(tile);
            if (!growth) {
              this.statusMessage = 'Fertilizer can only be used on a growing crop.';
              statusText.setText(this.statusMessage);
              return;
            }

            if (growth.ready) {
              this.statusMessage = 'Crop is already ready to harvest.';
              statusText.setText(this.statusMessage);
              return;
            }

            if (this.economy.level < fertilizer.unlockLevel) {
              this.statusMessage = `${fertilizer.name} unlocks at level ${fertilizer.unlockLevel}.`;
              statusText.setText(this.statusMessage);
              return;
            }

            if ((this.fertilizers[fertilizer.id] ?? 0) <= 0) {
              this.statusMessage = `No ${fertilizer.name} owned. Buy one with B.`;
              statusText.setText(this.statusMessage);
              return;
            }

            // Parity rule: fertilizer can only be applied once per growth stage.
            const lastFertilizedStage = tile.fertilizedStage ?? -1;
            if (growth.stageIndex <= lastFertilizedStage) {
              this.statusMessage = 'Already fertilized this growth stage. Wait for the next stage.';
              statusText.setText(this.statusMessage);
              return;
            }

            // Move the planted time back so the crop's remaining wait shrinks.
            // Divide by the dev speed scale so the reduction is consistent in
            // real time across 1x/10x/100x.
            const reductionMs = (fertilizer.reduceSeconds / growthTimeScale) * 1000;
            tile.plantedAt = (tile.plantedAt ?? Date.now()) - reductionMs;
            this.fertilizers[fertilizer.id] -= 1;

            const afterGrowth = getGrowth(tile);
            tile.fertilizedStage = afterGrowth ? afterGrowth.stageIndex : growth.stageIndex;

            this.statusMessage = `${fertilizer.name} applied. -${fertilizer.reduceSeconds}s growth.`;

            saveCurrent();
            refreshTileVisual(tile);
            refreshSelectedSeedLabel();
            statusText.setText(this.statusMessage);
            return;
          }

          const selectedCrop = getSelectedCrop();

          if (tile.state === 'dead') {
            tile.state = 'empty';
            tile.cropId = undefined;
            tile.plantedAt = undefined;
            tile.decorationId = undefined;
            tile.season = undefined;
            tile.fertilizedStage = undefined;
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

            // Multi-season crops regrow for the next season instead of clearing.
            const totalSeasons = growth.crop.seasons ?? 1;
            const currentSeason = tile.season ?? 1;
            let seasonSuffix = '';
            if (currentSeason < totalSeasons) {
              tile.plantedAt = Date.now();
              tile.season = currentSeason + 1;
              tile.fertilizedStage = undefined;
              initTileCare(tile, Date.now());
              seasonSuffix = ` Regrowing season ${tile.season}/${totalSeasons}.`;
            } else {
              tile.state = 'empty';
              tile.cropId = undefined;
              tile.plantedAt = undefined;
              tile.season = undefined;
              tile.fertilizedStage = undefined;
              clearTileCare(tile);
            }

            if (this.economy.level > previousLevel) {
              const unlockedNames = getUnlockedCropNames(previousLevel, this.economy.level);
              const unlockSuffix = unlockedNames.length > 0 ? ` Unlocked: ${unlockedNames.join(', ')}.` : '';
              this.statusMessage = `Level up! You reached level ${this.economy.level}.${unlockSuffix}`;
              saveCurrent();
              this.scene.restart();
              return;
            }

            this.statusMessage = `${growth.crop.name} harvested. +1 in inventory. +${xpGain} XP.${seasonSuffix}`;

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
          tile.season = 1;
          tile.fertilizedStage = undefined;
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
      this.fertilizers = reset.fertilizers;
      this.animals = reset.animals;
      this.neighbors = reset.neighbors;
      this.farmEvents = reset.events;
      this.popularity = reset.popularity;
      this.giftInbox = reset.giftInbox;
      this.hasDog = reset.hasDog;
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
    buyChickenButton.on('pointerdown', () => buyAnimal('chicken'));
    buyCalfButton.on('pointerdown', () => buyAnimal('calf'));
    feedAnimalsButton.on('pointerdown', feedAllAnimals);
    collectProductsButton.on('pointerdown', collectProducts);
    sellAnimalsButton.on('pointerdown', sellMaturedAnimals);
    visitButtons.forEach((button, index) => {
      const neighbor = this.neighbors[index];
      if (neighbor) {
        button.on('pointerdown', () => visitNeighbor(neighbor.id));
      }
    });
    collectGiftsButton.on('pointerdown', collectGifts);
    buyDogButton.on('pointerdown', buyDog);
    fertilizerModeButton.on('pointerdown', () => {
      fertilizerMode = !fertilizerMode;
      this.statusMessage = fertilizerMode ? 'Fertilizer mode enabled.' : 'Fertilizer mode disabled.';
      refreshSelectedSeedLabel();
      statusText.setText(this.statusMessage);
    });
    buyFertilizerButton.on('pointerdown', buyFertilizer);
    uploadButton.on('pointerdown', () => {
      void uploadRemoteSave();
    });
    downloadButton.on('pointerdown', () => {
      void downloadRemoteSave();
    });

    if (isDevMode) {
      const speedOne = this.add
        .text(640, 336, '1x', {
          color: '#ffffff',
          backgroundColor: '#7a3b00',
          fontSize: '13px',
          fontFamily: 'Arial',
          padding: { x: 8, y: 4 },
        })
        .setInteractive({ useHandCursor: true })
        .setDepth(2);

      const speedTen = this.add
        .text(688, 336, '10x', {
          color: '#ffffff',
          backgroundColor: '#7a3b00',
          fontSize: '13px',
          fontFamily: 'Arial',
          padding: { x: 8, y: 4 },
        })
        .setInteractive({ useHandCursor: true })
        .setDepth(2);

      const speedHundred = this.add
        .text(742, 336, '100x', {
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
    this.input.keyboard?.on('keydown-A', feedAllAnimals);
    this.input.keyboard?.on('keydown-E', collectProducts);
    this.input.keyboard?.on('keydown-M', sellMaturedAnimals);
    this.input.keyboard?.on('keydown-C', collectGifts);
    this.input.keyboard?.on('keydown-K', buyDog);
    this.input.keyboard?.on('keydown-F', () => {
      fertilizerMode = !fertilizerMode;
      this.statusMessage = fertilizerMode ? 'Fertilizer mode enabled.' : 'Fertilizer mode disabled.';
      refreshSelectedSeedLabel();
      statusText.setText(this.statusMessage);
    });
    this.input.keyboard?.on('keydown-B', buyFertilizer);
    this.input.keyboard?.on('keydown-COMMA', () => cycleFertilizer(-1));
    this.input.keyboard?.on('keydown-PERIOD', () => cycleFertilizer(1));
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
    refreshEventLog();
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
        simulateAllAnimals();
        refreshAnimalsLabel();
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
        // Persist care + animal progression so it survives a reload even when
        // the player performs no explicit action.
        if (hasPlanted || this.animals.animals.length > 0) {
          saveCurrent();
        }
      },
    });
  }
}
