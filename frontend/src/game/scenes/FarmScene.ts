import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import type { FarmTile } from '../types/farm';
import type { SaveGame } from '../types/save';
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
import { plotUnlockInfo } from '../systems/LandSystem';
import {
  applyDailyReward,
  claimDailyReward,
  createDailyState,
  isRewardAvailable,
  rewardForStreak,
  rolloverDaily,
  type DailyState,
} from '../systems/DailySystem';
import {
  defaultPacingProfileId,
  effectiveGrowthScale,
  getPacingProfile,
  pacingProfiles,
  type PacingProfileId,
} from '../systems/PacingSystem';
import {
  formatSyncHistory,
  loadSyncHistory,
  recordSyncEvent,
  type SyncHistoryEntry,
} from '../systems/SyncSystem';
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
import { cycleLocale, getLocaleLabel, onLocaleChange, t } from '../i18n';

type TileVisual = {
  rect: Phaser.GameObjects.Rectangle;
  ground: Phaser.GameObjects.Image;
  content: Phaser.GameObjects.Image;
  title: Phaser.GameObjects.Text;
  subtitle: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Image;
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

  private daily: DailyState = createDailyState(Date.now());

  private pacingProfileId: PacingProfileId = defaultPacingProfileId;

  private statusMessage = '';

  private readonly tileSize = { width: 120, height: 90 };

  constructor() {
    super('FarmScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#9fdd7a');

    // Full-scene art backdrop; falls back to the flat camera color above when
    // the texture isn't present. Sits behind everything (depth -10).
    if (this.textures.exists('bg_farm')) {
      this.add
        .image(640, 430, 'bg_farm')
        .setDisplaySize(1280, 860)
        .setDepth(-10);
    }

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
    this.daily = rolloverDaily(loaded.daily, Date.now());
    this.pacingProfileId = loaded.pacingProfileId;
    this.selectedCropId = loaded.selectedCropId;

    // Effective growth scale folds the persistent pacing profile (nostalgia
    // slows crops 40x) into the transient DEV speed multiplier so every
    // growth/care/death/fertilizer/animal call advances at the same rate.
    const effectiveScale = () => effectiveGrowthScale(growthTimeScale, this.pacingProfileId);

    // Advance crop care for any time that passed while the game was closed.
    this.farmTiles.forEach((tile) => {
      simulateTileCare(tile, Date.now(), effectiveScale());
      const crop = crops.find((item) => item.id === tile.cropId);
      if (crop && isCropDead(tile, crop.growSeconds, Date.now(), effectiveScale())) {
        tile.state = 'dead';
      }
    });

    // Advance animals for any time that passed while the game was closed.
    this.animals.animals.forEach((animal) => {
      const def = getAnimalDefinition(animal.defId);
      if (def) {
        simulateAnimal(animal, def, Date.now(), effectiveScale());
      }
    });

    const tileVisuals = new Map<string, TileVisual>();

    this.add
      .text(24, 836, t('Farmy — mechanics prototype'), {
        color: '#3f5f2f',
        fontSize: '12px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const hudText = this.add
      .text(46, 100, '', {
        color: '#2f4f1f',
        backgroundColor: '#9fdd7a',
        fontSize: '16px',
        fontFamily: 'Arial',
        padding: { x: 2, y: 1 },
      })
      .setDepth(1);

    const popularityText = this.add
      .text(382, 100, '', {
        color: '#8a3b6a',
        fontSize: '15px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const collectGiftsButton = this.add
      .text(360, 122, t('Collect Gifts (C)'), {
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
      .text(360, 170, t('Buy Guard Dog (K) - {price}c', { price: SOCIAL.DOG_PRICE }), {
        color: '#ffffff',
        backgroundColor: '#6a4a2a',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const dailyText = this.add
      .text(360, 198, '', {
        color: '#2f6f3f',
        fontSize: '13px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const claimDailyButton = this.add
      .text(360, 218, t('Claim Daily Reward (J)'), {
        color: '#ffffff',
        backgroundColor: '#2f7f4f',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const progressionText = this.add
      .text(46, 122, '', {
        color: '#2f4f1f',
        fontSize: '14px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    // Leading stat icons for the HUD lines. Each is placed in the gap opened up
    // by nudging its text line right; tolerant of missing art (skipped if the
    // texture isn't loaded). 18px square, vertically centred on its text.
    const addStatIcon = (iconKey: string, x: number, y: number): void => {
      if (!this.textures.exists(iconKey)) {
        return;
      }
      this.add
        .image(x, y, iconKey)
        .setOrigin(0.5)
        .setDisplaySize(18, 18)
        .setDepth(2);
    };
    addStatIcon('icon_coin', 33, 110);
    addStatIcon('icon_xp', 33, 130);
    addStatIcon('icon_popularity', 371, 110);

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
      .text(24, 188, t('Click empty tile to plant. Click a crop to care (water/weeds/pests) or harvest. Sell with S.'), {
        color: '#3f5f2f',
        fontSize: '14px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const inventoryText = this.add
      .text(24, 210, t('Inventory: empty'), {
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

    const pacingButton = this.add
      .text(24, 284, '', {
        color: '#ffffff',
        backgroundColor: '#5a3d8a',
        fontSize: '12px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 4 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const animalsText = this.add
      .text(820, 150, '', {
        color: '#5b3c18',
        fontSize: '13px',
        fontFamily: 'Arial',
        lineSpacing: 2,
      })
      .setDepth(1);

    this.add
      .text(820, 124, t('Barn'), {
        color: '#5b3c18',
        fontSize: '15px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      })
      .setDepth(1);

    this.add
      .text(1058, 116, t('Neighbors'), {
        color: '#2f4f1f',
        fontSize: '15px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      })
      .setDepth(1);

    const visitButtons: Phaser.GameObjects.Text[] = this.neighbors.map((neighbor, index) =>
      this.add
        .text(1058, 142 + index * 34, t('Visit {name}', { name: neighbor.name }), {
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
      .text(1058, 142 + this.neighbors.length * 34 + 6, t('Activity log'), {
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
      .text(24, 326, '', {
        color: '#36522a',
        fontSize: '12px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    controlsHintText.setText(t('Shortcuts: S sell | R reset | L login | U upload | D download | G decor | F fertilize | B buy fert | ,/. switch | A feed | E collect | M sell mature | C gifts | K dog | J daily | P pacing | Y sync. Click a locked plot to unlock it.'));

    const resetButton = this.add
      .text(790, 14, t('Reset Save (R)'), {
        color: '#ffffff',
        backgroundColor: '#955728',
        fontSize: '16px',
        fontFamily: 'Arial',
        padding: { x: 12, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const sellButton = this.add
      .text(630, 14, t('Sell Inventory (S)'), {
        color: '#ffffff',
        backgroundColor: '#2f7a41',
        fontSize: '16px',
        fontFamily: 'Arial',
        padding: { x: 12, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const uploadButton = this.add
      .text(470, 14, t('Upload Save (U)'), {
        color: '#ffffff',
        backgroundColor: '#1f5c99',
        fontSize: '16px',
        fontFamily: 'Arial',
        padding: { x: 12, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const downloadButton = this.add
      .text(300, 14, t('Download Save (D)'), {
        color: '#ffffff',
        backgroundColor: '#1f5c99',
        fontSize: '16px',
        fontFamily: 'Arial',
        padding: { x: 12, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const syncPanelButton = this.add
      .text(960, 14, t('Sync \u2699 (Y)'), {
        color: '#ffffff',
        backgroundColor: '#345c7a',
        fontSize: '14px',
        fontFamily: 'Arial',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const languageButton = this.add
      .text(1078, 14, t('Language: {lang}', { lang: getLocaleLabel() }), {
        color: '#ffffff',
        backgroundColor: '#6a4f99',
        fontSize: '14px',
        fontFamily: 'Arial',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const registerButton = this.add
      .text(24, 14, t('Register'), {
        color: '#ffffff',
        backgroundColor: '#345c7a',
        fontSize: '14px',
        fontFamily: 'Arial',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const loginButton = this.add
      .text(120, 14, t('Login (L)'), {
        color: '#ffffff',
        backgroundColor: '#345c7a',
        fontSize: '14px',
        fontFamily: 'Arial',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const logoutButton = this.add
      .text(210, 14, t('Logout'), {
        color: '#ffffff',
        backgroundColor: '#6f3c3c',
        fontSize: '14px',
        fontFamily: 'Arial',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const decorationModeButton = this.add
      .text(24, 54, t('Decor Mode (G)'), {
        color: '#ffffff',
        backgroundColor: '#5f3b8a',
        fontSize: '14px',
        fontFamily: 'Arial',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const buyChickenButton = this.add
      .text(820, 54, t('Buy Chicken'), {
        color: '#ffffff',
        backgroundColor: '#7b4f1d',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const buyCalfButton = this.add
      .text(940, 54, t('Buy Calf'), {
        color: '#ffffff',
        backgroundColor: '#7b4f1d',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const feedAnimalsButton = this.add
      .text(1040, 54, t('Feed All (A)'), {
        color: '#ffffff',
        backgroundColor: '#5f7b1d',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const collectProductsButton = this.add
      .text(820, 88, t('Collect Products (E)'), {
        color: '#ffffff',
        backgroundColor: '#7b4f1d',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const sellAnimalsButton = this.add
      .text(1010, 88, t('Sell Mature (M)'), {
        color: '#ffffff',
        backgroundColor: '#2f7a41',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const fertilizerModeButton = this.add
      .text(175, 54, t('Fertilizer (F)'), {
        color: '#ffffff',
        backgroundColor: '#2f6f3b',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const buyFertilizerButton = this.add
      .text(305, 54, t('Buy Fertilizer (B)'), {
        color: '#ffffff',
        backgroundColor: '#2f6f3b',
        fontSize: '12px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    // Prefix a text button with a small icon drawn inside extra left padding,
    // so the button grows to the right only. Tolerant of missing art: when the
    // icon texture isn't loaded the button is left untouched. Returns the icon
    // image (or null) so callers can keep its visibility in sync with a button
    // that toggles on/off.
    const addButtonIcon = (
      button: Phaser.GameObjects.Text,
      iconKey: string,
    ): Phaser.GameObjects.Image | null => {
      if (!this.textures.exists(iconKey)) {
        return null;
      }
      const pad = button.padding;
      const iconSize = Math.max(14, Math.min(20, button.height - 6));
      const gap = iconSize + 6;
      button.setPadding((pad.left ?? 0) + gap, pad.top ?? 0, pad.right ?? 0, pad.bottom ?? 0);
      const icon = this.add
        .image(button.x + 4 + iconSize / 2, button.y + button.height / 2, iconKey)
        .setOrigin(0.5)
        .setDisplaySize(iconSize, iconSize)
        .setDepth(button.depth + 1);
      return icon;
    };

    // Always-visible action buttons.
    addButtonIcon(sellButton, 'icon_sell');
    addButtonIcon(syncPanelButton, 'icon_sync');
    addButtonIcon(languageButton, 'icon_globe');
    addButtonIcon(collectGiftsButton, 'icon_gift');
    addButtonIcon(collectProductsButton, 'icon_harvest');
    addButtonIcon(sellAnimalsButton, 'icon_sell');
    addButtonIcon(fertilizerModeButton, 'icon_seed');
    // Buttons that toggle visibility: keep their icon in sync (see refreshHud).
    const buyDogIcon = addButtonIcon(buyDogButton, 'icon_dog');
    const claimDailyIcon = addButtonIcon(claimDailyButton, 'icon_calendar');

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
      selectedSeedText.setText(t('Selected seed: {name} (Cost: {cost})', { name: t(selected.name), cost: selected.seedPrice }));
      selectedSeedMetaText.setText(
        t('Sell: {sell} | Profit: {profit} | Growth: {grow}s | XP: +{xp}', { sell: selected.sellPrice, profit: selected.sellPrice - selected.seedPrice, grow: selected.growSeconds, xp: selected.xp }),
      );

      const selectedDecoration = getSelectedDecoration();
      const modeLabel = decorationMode ? t('ON') : t('OFF');
      const selectedFertilizer = getSelectedFertilizer();
      const fertLabel = fertilizerMode ? t('ON') : t('OFF');
      const fertOwned = this.fertilizers[selectedFertilizer.id] ?? 0;
      decorationModeText.setText(
        t('Decor: {decorMode} {decorName} ({decorPrice}c) [G] | Fert: {fertMode} {fertName} -{fertSec}s ({fertPrice}c, own {fertOwned}) [F toggle, B buy, ,/. switch]', {
          decorMode: modeLabel,
          decorName: t(selectedDecoration.name),
          decorPrice: selectedDecoration.price,
          fertMode: fertLabel,
          fertName: t(selectedFertilizer.name),
          fertSec: selectedFertilizer.reduceSeconds,
          fertPrice: selectedFertilizer.price,
          fertOwned,
        }),
      );
    };

    const getGrowth = (
      tile: FarmTile,
    ): { crop: CropDefinition; stageLabel: string; stageIndex: number; progress: number; ready: boolean } | undefined => {
      const crop = getCrop(tile.cropId);

      if (!crop || !tile.plantedAt) {
        return undefined;
      }

      const elapsedSeconds = Math.max(0, (Date.now() - tile.plantedAt) / 1000) * effectiveScale();
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
      hudText.setText(t('Coins: {coins} | XP: {xp} | Level: {level}', { coins: this.economy.coins, xp: this.economy.xp, level: this.economy.level }));
      const missingXp = getXpToNextLevel(this.economy.xp, this.economy.level);
      progressionText.setText(t('Next level in {xp} XP', { xp: missingXp }));
      popularityText.setText(t('Popularity: {pop} | Gifts waiting: {gifts}', { pop: this.popularity, gifts: this.giftInbox.length }));
      dogText.setText(
        this.hasDog
          ? t('\u{1F415} Guard dog: ON (protecting your farm)')
          : t('\u{1F415} Guard dog: none'),
      );
      buyDogButton.setVisible(!this.hasDog);
      buyDogIcon?.setVisible(!this.hasDog);

      const now = Date.now();
      const available = isRewardAvailable(this.daily, now);
      const nextReward = rewardForStreak(available ? this.daily.streak + 1 : this.daily.streak);
      dailyText.setText(
        available
          ? t('\u{1F381} Daily reward ready: {label} (streak {streak})', { label: t(nextReward.label), streak: this.daily.streak + 1 })
          : t('\u{1F381} Daily reward claimed. Streak: {streak}. Come back tomorrow.', { streak: this.daily.streak }),
      );
      claimDailyButton.setVisible(available);
      claimDailyIcon?.setVisible(available);
    };

    const buyDog = (): void => {
      if (this.hasDog) {
        this.statusMessage = t('You already have a guard dog.');
        statusText.setText(this.statusMessage);
        return;
      }
      if (this.economy.coins < SOCIAL.DOG_PRICE) {
        this.statusMessage = t('Not enough coins for a guard dog (need {price}).', { price: SOCIAL.DOG_PRICE });
        statusText.setText(this.statusMessage);
        return;
      }

      this.economy.coins -= SOCIAL.DOG_PRICE;
      this.hasDog = true;
      this.farmEvents = pushEvent(
        this.farmEvents,
        'system',
        t('You bought a guard dog for {price} coins. Your farm is now protected.', { price: SOCIAL.DOG_PRICE }),
        Date.now(),
      );
      this.statusMessage = t('Guard dog hired. Your farm is now protected.');

      refreshHud();
      refreshEventLog();
      saveCurrent();
      statusText.setText(this.statusMessage);
    };

    const claimDaily = (): void => {
      const now = Date.now();
      this.daily = rolloverDaily(this.daily, now);
      if (!isRewardAvailable(this.daily, now)) {
        this.statusMessage = t('Daily reward already claimed today. Come back tomorrow.');
        statusText.setText(this.statusMessage);
        return;
      }

      const result = claimDailyReward(this.daily, now);
      this.daily = result.state;
      applyDailyReward(result.reward, this.economy, this.inventory, this.fertilizers);
      this.economy.level = getLevelFromXp(this.economy.xp);
      this.farmEvents = pushEvent(
        this.farmEvents,
        'system',
        t('Daily reward (day {streak}): {label}.', { streak: result.streak, label: t(result.reward.label) }),
        now,
      );
      this.statusMessage = t('Daily reward claimed: {label} (streak {streak}).', { label: t(result.reward.label), streak: result.streak });

      refreshHud();
      refreshEventLog();
      saveCurrent();
      statusText.setText(this.statusMessage);
    };

    const collectGifts = (): void => {
      if (this.giftInbox.length === 0) {
        this.statusMessage = t('No gifts waiting. Gift a flower to a neighbor to get one back.');
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
        t('You collected {count} flower gift(s). +{gained} popularity.', { count, gained }),
        Date.now(),
      );
      this.statusMessage = t('Collected {count} gift(s). +{gained} popularity.', { count, gained });

      refreshHud();
      refreshEventLog();
      saveCurrent();
      statusText.setText(this.statusMessage);
    };

    const refreshEventLog = (): void => {
      if (this.farmEvents.length === 0) {
        eventLogText.setText(t('No activity yet. Visit a neighbor!'));
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
        daily: this.daily,
        pacingProfileId: this.pacingProfileId,
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
        daily: this.daily,
        pacingProfileId: this.pacingProfileId,
      });
    };

    const toTimestamp = (iso: string): number => {
      const parsed = Date.parse(iso);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const getInventoryLabel = (): string => {
      const entries = Object.entries(this.inventory).filter(([, amount]) => amount > 0);
      if (entries.length === 0) {
        return t('Inventory: empty');
      }

      const text = entries.map(([cropId, amount]) => `${t(getCrop(cropId)?.name ?? cropId)} x${amount}`).join(' | ');
      return t('Inventory: {text}', { text });
    };

    const simulateAllAnimals = (): void => {
      const now = Date.now();
      this.animals.animals.forEach((animal) => {
        const def = getAnimalDefinition(animal.defId);
        if (def) {
          simulateAnimal(animal, def, now, effectiveScale());
        }
      });
    };

    const refreshAnimalsLabel = (): void => {
      if (this.animals.animals.length === 0) {
        animalsText.setText(t('Animals: none yet.\nBuy a Chicken (eggs) or a Calf (raise & sell).'));
        return;
      }

      const now = Date.now();
      const lines = this.animals.animals.map((animal) => {
        const def = getAnimalDefinition(animal.defId);
        if (!def) {
          return t('? unknown animal');
        }

        const fed = isFed(animal, now);
        const foodPart = fed ? t('fed {sec}s', { sec: Math.ceil(foodRemainingSeconds(animal, now)) }) : t('HUNGRY');

        if (def.kind === 'productive') {
          const cap = def.produceCap ?? 0;
          return `${t(def.name)}: ${animal.storedProduct}/${cap} ${t(def.productLabel ?? 'product')} | ${foodPart}`;
        }

        const stage = getGrowthStageLabel(animal, def);
        const state = animal.matured ? t('READY to sell') : t(stage);
        return `${t(def.name)}: ${state} | ${foodPart}`;
      });

      animalsText.setText(t('Animals ({count}):\n{lines}', { count: this.animals.animals.length, lines: lines.join('\n') }));
    };

    const buyAnimal = (defId: string): void => {
      const def = getAnimalDefinition(defId);
      if (!def) {
        return;
      }

      if (this.economy.level < def.unlockLevel) {
        this.statusMessage = t('{name} unlocks at level {level}.', { name: t(def.name), level: def.unlockLevel });
        statusText.setText(this.statusMessage);
        return;
      }

      if (this.economy.coins < def.price) {
        this.statusMessage = t('Not enough coins to buy a {name}.', { name: t(def.name) });
        statusText.setText(this.statusMessage);
        return;
      }

      this.economy.coins -= def.price;
      this.animals.animals.push(createAnimalInstance(def.id, Date.now()));
      this.statusMessage = t('{name} purchased. -{price} coins. Feed it to start.', { name: t(def.name), price: def.price });

      refreshHud();
      refreshAnimalsLabel();
      saveCurrent();
      statusText.setText(this.statusMessage);
    };

    const feedAllAnimals = (): void => {
      simulateAllAnimals();

      if (this.animals.animals.length === 0) {
        this.statusMessage = t('No animals to feed.');
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
        this.statusMessage = t('Not enough coins to feed any animal.');
        statusText.setText(this.statusMessage);
        return;
      }

      this.economy.xp += fedCount * ANIMAL.FEED_XP;
      this.economy.level = getLevelFromXp(this.economy.xp);
      this.statusMessage = t('Fed {count} animal(s). -{spent} coins. +{xp} XP.', { count: fedCount, spent, xp: fedCount * ANIMAL.FEED_XP });

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
        this.statusMessage = t('No animal products ready yet.');
        statusText.setText(this.statusMessage);
        return;
      }

      const xpGain = collected * ANIMAL.COLLECT_XP_PER_PRODUCT;
      this.economy.xp += xpGain;
      this.economy.level = getLevelFromXp(this.economy.xp);
      this.statusMessage = t('Collected {count} product(s). +{xp} XP.', { count: collected, xp: xpGain });

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
        this.statusMessage = t('No mature animals ready to sell.');
        statusText.setText(this.statusMessage);
        return;
      }

      this.economy.coins += totalCoins;
      const xpGain = Math.max(1, Math.round(totalCoins / ANIMAL.SELL_XP_DIVISOR));
      this.economy.xp += xpGain;
      this.economy.level = getLevelFromXp(this.economy.xp);
      this.statusMessage = t('Sold {count} mature animal(s) for +{coins} coins. +{xp} XP.', { count: soldCount, coins: totalCoins, xp: xpGain });

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

      devSpeedText.setText(t('DEV Growth Speed: {scale}x', { scale: growthTimeScale }));
    };

    const applyDevSpeed = (nextScale: 1 | 10 | 100): void => {
      growthTimeScale = nextScale;
      refreshDevSpeedLabel();
      this.farmTiles.forEach((tile) => {
        if (tile.state === 'planted') {
          refreshTileVisual(tile);
        }
      });
      this.statusMessage = t('DEV speed set to {scale}x.', { scale: growthTimeScale });
      statusText.setText(this.statusMessage);
    };

    const refreshPacingLabel = (): void => {
      const profile = getPacingProfile(this.pacingProfileId);
      pacingButton.setText(t('Pacing: {name} (P)', { name: t(profile.name) }));
    };

    const cyclePacing = (): void => {
      const index = pacingProfiles.findIndex((profile) => profile.id === this.pacingProfileId);
      const next = pacingProfiles[(index + 1) % pacingProfiles.length];
      this.pacingProfileId = next.id;
      refreshPacingLabel();
      this.farmTiles.forEach((tile) => {
        if (tile.state === 'planted') {
          refreshTileVisual(tile);
        }
      });
      this.statusMessage = t('Pacing profile: {name}. {desc}', { name: t(next.name), desc: t(next.description) });
      statusText.setText(this.statusMessage);
      saveCurrent();
    };

    const refreshAuthLabel = (): void => {
      const authSummary = this.remoteSaveService.getAuthSummary();
      authText.setText(t('Auth: {summary}', { summary: authSummary }));
    };

    const setSyncLabel = (state: 'idle' | 'syncing' | 'success' | 'error', message?: string): void => {
      const authSummary = this.remoteSaveService.getAuthSummary();

      if (state === 'syncing') {
        syncText.setText(t('Sync: in progress... | User: {user}', { user: authSummary }));
        return;
      }

      if (message) {
        syncText.setText(t('Sync: {message} | Last sync: {last} | User: {user}', { message: t(message), last: t(lastSyncLabel), user: authSummary }));
        return;
      }

      syncText.setText(t('Sync: {state} | Last sync: {last} | User: {user}', { state: t(state), last: t(lastSyncLabel), user: authSummary }));
    };

    const promptCredentials = (): { email: string; password: string } | null => {
      const email = window.prompt(t('Email'))?.trim() ?? '';
      if (!email) {
        return null;
      }

      const password = window.prompt(t('Password (min 6 chars)')) ?? '';
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
        this.statusMessage = t('Registration successful and logged in.');
        refreshAuthLabel();
        setSyncLabel('idle', 'ready');
      } catch (error) {
        this.statusMessage = t('Register failed: {error}', { error: String(error) });
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
        this.statusMessage = t('Login successful.');
        refreshAuthLabel();
        setSyncLabel('idle', 'ready');
      } catch (error) {
        this.statusMessage = t('Login failed: {error}', { error: String(error) });
      }

      statusText.setText(this.statusMessage);
    };

    const logout = (): void => {
      this.remoteSaveService.logout();
      this.statusMessage = t('Logged out.');
      refreshAuthLabel();
      setSyncLabel('idle', 'auth required');
      statusText.setText(this.statusMessage);
    };

    const renderSeedSelector = (): void => {
      this.add
        .text(24, 340, t('Seed Shop:'), {
          color: '#1f3f10',
          fontSize: '16px',
          fontFamily: 'Arial',
        })
        .setDepth(2);

      crops.forEach((crop, index) => {
        const isSelected = crop.id === this.selectedCropId;
        const isUnlocked = this.economy.level >= crop.unlockLevel;

        const button = this.add
          .text(130 + index * 140, 334, `${t(crop.name)}\nL${crop.unlockLevel}`, {
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
            this.statusMessage = t('{name} unlocks at level {level}.', { name: t(crop.name), level: crop.unlockLevel });
            statusText.setText(this.statusMessage);
            return;
          }

          this.selectedCropId = crop.id;
          saveCurrent();
          refreshSelectedSeedLabel();

          this.statusMessage = t('{name} seed selected.', { name: t(crop.name) });
          statusText.setText(this.statusMessage);
          this.scene.restart();
        });
      });
    };

    const renderDecorationSelector = (): void => {
      this.add
        .text(24, 390, t('Decorations:'), {
          color: '#4f2f77',
          fontSize: '14px',
          fontFamily: 'Arial',
        })
        .setDepth(2);

      decorations.forEach((decoration, index) => {
        const isSelected = decoration.id === selectedDecorationId;
        const isUnlocked = this.economy.level >= decoration.unlockLevel;

        const button = this.add
          .text(130 + index * 150, 384, `${t(decoration.name)}\nL${decoration.unlockLevel}`, {
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
            this.statusMessage = t('{name} unlocks at level {level}.', { name: t(decoration.name), level: decoration.unlockLevel });
            statusText.setText(this.statusMessage);
            return;
          }

          selectedDecorationId = decoration.id;
          refreshSelectedSeedLabel();
          this.statusMessage = t('{name} selected.', { name: t(decoration.name) });
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
        this.statusMessage = t('Nothing to sell.');
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
        this.statusMessage = t('No sellable items found in inventory.');
        statusText.setText(this.statusMessage);
        return;
      }

      this.economy.coins += totalCoins;
      this.inventory = remaining;

      saveCurrent();
      refreshHud();
      inventoryText.setText(getInventoryLabel());

      this.statusMessage = t('Sold inventory for +{coins} coins.', { coins: totalCoins });
      statusText.setText(this.statusMessage);
    };

    const buyFertilizer = (): void => {
      const fertilizer = getSelectedFertilizer();

      if (this.economy.level < fertilizer.unlockLevel) {
        this.statusMessage = t('{name} unlocks at level {level}.', { name: t(fertilizer.name), level: fertilizer.unlockLevel });
        statusText.setText(this.statusMessage);
        return;
      }

      if (this.economy.coins < fertilizer.price) {
        this.statusMessage = t('Not enough coins to buy {name}.', { name: t(fertilizer.name) });
        statusText.setText(this.statusMessage);
        return;
      }

      this.economy.coins -= fertilizer.price;
      this.fertilizers[fertilizer.id] = (this.fertilizers[fertilizer.id] ?? 0) + 1;
      this.statusMessage = t('Bought {name}. -{price} coins.', { name: t(fertilizer.name), price: fertilizer.price });

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
      this.statusMessage = t('{name} selected.', { name: t(fertilizers[nextIndex].name) });
      statusText.setText(this.statusMessage);
    };

    // ---- P8: cloud sync conflict resolution + auditable history ----
    // The save is whole-replace only (no field merge): the player explicitly
    // picks which side wins and the losing side is backed up, so a conflict can
    // never silently destroy progress.
    let syncHistory: SyncHistoryEntry[] = loadSyncHistory();
    let conflictRemote: SaveGame | null = null;

    const formatTimestamp = (iso: string): string => {
      const ms = toTimestamp(iso);
      return ms > 0 ? new Date(ms).toLocaleString() : t('unknown');
    };

    const syncPanelBg = this.add
      .rectangle(640, 430, 580, 430, 0x12233a, 0.97)
      .setStrokeStyle(2, 0x4f87c4)
      .setDepth(50)
      .setVisible(false);

    const syncPanelTitle = this.add
      .text(366, 234, t('Cloud Sync'), {
        color: '#ffffff',
        fontSize: '18px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      })
      .setDepth(51)
      .setVisible(false);

    const syncPanelInfo = this.add
      .text(366, 268, '', {
        color: '#d8e6f5',
        fontSize: '13px',
        fontFamily: 'Arial',
        lineSpacing: 4,
        wordWrap: { width: 528 },
      })
      .setDepth(51)
      .setVisible(false);

    const syncPanelHistory = this.add
      .text(366, 392, '', {
        color: '#aac4dd',
        fontSize: '12px',
        fontFamily: 'Arial',
        lineSpacing: 3,
        wordWrap: { width: 528 },
      })
      .setDepth(51)
      .setVisible(false);

    const makePanelButton = (x: number, label: string, bg: string): Phaser.GameObjects.Text =>
      this.add
        .text(x, 600, label, {
          color: '#ffffff',
          backgroundColor: bg,
          fontSize: '13px',
          fontFamily: 'Arial',
          padding: { x: 10, y: 6 },
        })
        .setInteractive({ useHandCursor: true })
        .setDepth(51)
        .setVisible(false);

    const forceUploadButton = makePanelButton(366, t('Keep Mine \u2191 (upload)'), '#1f5c99');
    const forceDownloadButton = makePanelButton(516, t('Use Remote \u2193 (download)'), '#7a3b00');
    const restoreBackupButton = makePanelButton(706, t('Restore Backup'), '#4f6f3c');
    const closeSyncButton = makePanelButton(836, t('Close'), '#6f3c3c');

    const syncPanelObjects: Array<Phaser.GameObjects.Text | Phaser.GameObjects.Rectangle> = [
      syncPanelBg,
      syncPanelTitle,
      syncPanelInfo,
      syncPanelHistory,
      forceUploadButton,
      forceDownloadButton,
      restoreBackupButton,
      closeSyncButton,
    ];

    const refreshSyncPanel = (): void => {
      const localSave = this.saveSystem.loadGame();
      const lines = [t('Local save: {time}', { time: formatTimestamp(localSave.savedAt) })];

      if (conflictRemote) {
        lines.push(t('Remote save: {time}', { time: formatTimestamp(conflictRemote.savedAt) }));
        lines.push(t('\u26a0 Conflict detected. Choose which save to keep. The'));
        lines.push(t('   other side is backed up and can be restored.'));
      } else {
        lines.push(t('Remote save: (use a sync action to compare)'));
        lines.push(t('Choose a forced action to override the timestamp guard.'));
      }

      syncPanelInfo.setText(lines.join('\n'));
      syncPanelHistory.setText(formatSyncHistory(syncHistory));
      restoreBackupButton.setVisible(this.saveSystem.hasBackup());
    };

    const openSyncPanel = (remote?: SaveGame | null): void => {
      conflictRemote = remote ?? null;
      syncPanelObjects.forEach((object) => object.setVisible(true));
      refreshSyncPanel();
    };

    const closeSyncPanel = (): void => {
      conflictRemote = null;
      syncPanelObjects.forEach((object) => object.setVisible(false));
    };

    const pushSyncHistory = (
      action: SyncHistoryEntry['action'],
      outcome: SyncHistoryEntry['outcome'],
      detail: string,
    ): void => {
      syncHistory = recordSyncEvent(syncHistory, action, outcome, detail);
      if (syncPanelBg.visible) {
        refreshSyncPanel();
      }
    };

    const applyDownloadedSave = (remoteSave: SaveGame): void => {
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
      this.daily = remoteSave.daily;
      this.pacingProfileId = remoteSave.pacingProfileId;
      this.selectedCropId = remoteSave.selectedCropId;
    };

    const forceUpload = async (): Promise<void> => {
      if (isSyncing) {
        return;
      }

      isSyncing = true;
      setSyncLabel('syncing');
      try {
        const currentSave = buildCurrentSave();
        await this.remoteSaveService.uploadSave(currentSave);
        this.statusMessage = t('Forced upload: local save now wins on the server.');
        lastSyncLabel = new Date().toLocaleTimeString();
        setSyncLabel('success', 'forced upload');
        pushSyncHistory('upload', 'forced-upload', 'local overwrote remote');
        closeSyncPanel();
      } catch (error) {
        this.statusMessage = t('Forced upload failed: {error}', { error: String(error) });
        setSyncLabel('error', 'forced upload failed');
        pushSyncHistory('upload', 'failed', String(error));
      } finally {
        isSyncing = false;
        statusText.setText(this.statusMessage);
      }
    };

    const forceDownload = async (): Promise<void> => {
      if (isSyncing) {
        return;
      }

      isSyncing = true;
      setSyncLabel('syncing');
      try {
        const remoteSave = conflictRemote ?? (await this.remoteSaveService.downloadSave());
        if (!remoteSave) {
          this.statusMessage = t('No remote save to download.');
          setSyncLabel('idle', 'no remote save');
          pushSyncHistory('download', 'no-remote', 'remote empty');
          statusText.setText(this.statusMessage);
          return;
        }

        // Back up local progress before it is overwritten so nothing is lost.
        this.saveSystem.backupCurrentSave();
        applyDownloadedSave(remoteSave);
        this.statusMessage = t('Forced download: remote save applied. Local backed up.');
        lastSyncLabel = new Date().toLocaleTimeString();
        setSyncLabel('success', 'forced download');
        pushSyncHistory('download', 'forced-download', 'remote overwrote local (backup kept)');
        closeSyncPanel();
        this.scene.restart();
      } catch (error) {
        this.statusMessage = t('Forced download failed: {error}', { error: String(error) });
        setSyncLabel('error', 'forced download failed');
        pushSyncHistory('download', 'failed', String(error));
        statusText.setText(this.statusMessage);
      } finally {
        isSyncing = false;
      }
    };

    const restoreBackupSave = (): void => {
      const restored = this.saveSystem.restoreBackup();
      if (!restored) {
        this.statusMessage = t('No backup available to restore.');
        statusText.setText(this.statusMessage);
        return;
      }

      this.statusMessage = t('Backup restored as the active save.');
      pushSyncHistory('download', 'forced-download', 'restored local backup');
      closeSyncPanel();
      this.scene.restart();
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
          this.statusMessage = t('Upload conflict: remote save is newer. Resolve in the Sync panel.');
          setSyncLabel('error', 'upload conflict');
          pushSyncHistory('upload', 'conflict', 'remote newer than local');
          openSyncPanel(remoteSave);
          statusText.setText(this.statusMessage);
          return;
        }

        await this.remoteSaveService.uploadSave(currentSave);
        this.statusMessage = t('Save uploaded to backend.');
        lastSyncLabel = new Date().toLocaleTimeString();
        setSyncLabel('success', 'uploaded');
        pushSyncHistory('upload', 'uploaded', 'local newer or equal');
      } catch (error) {
        this.statusMessage = t('Upload failed: {error}', { error: String(error) });
        setSyncLabel('error', 'upload failed');
        pushSyncHistory('upload', 'failed', String(error));
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
          this.statusMessage = t('No remote save found yet.');
          setSyncLabel('idle', 'no remote save');
          pushSyncHistory('download', 'no-remote', 'remote empty');
          statusText.setText(this.statusMessage);
          return;
        }

        if (toTimestamp(remoteSave.savedAt) < toTimestamp(localSave.savedAt)) {
          this.statusMessage = t('Download conflict: local save is newer. Resolve in the Sync panel.');
          setSyncLabel('error', 'download conflict');
          pushSyncHistory('download', 'conflict', 'local newer than remote');
          openSyncPanel(remoteSave);
          statusText.setText(this.statusMessage);
          return;
        }

        this.saveSystem.backupCurrentSave();
        applyDownloadedSave(remoteSave);
        this.statusMessage = t('Remote save downloaded.');
        lastSyncLabel = new Date().toLocaleTimeString();
        setSyncLabel('success', 'downloaded');
        pushSyncHistory('download', 'downloaded', 'remote newer or equal');
        this.scene.restart();
      } catch (error) {
        this.statusMessage = t('Download failed: {error}', { error: String(error) });
        setSyncLabel('error', 'download failed');
        pushSyncHistory('download', 'failed', String(error));
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

      // Skin the tile with art when textures are present; otherwise leave the
      // image layers hidden so the fallback rectangle + text show through.
      const applyImage = (
        image: Phaser.GameObjects.Image,
        key: string | null,
        width: number,
        height: number,
      ): void => {
        if (key && this.textures.exists(key)) {
          image.setTexture(key);
          image.setDisplaySize(width, height);
          image.setVisible(true);
        } else {
          image.setVisible(false);
        }
      };

      const sprites = ((): { ground: string; content: string | null } => {
        if (tile.locked) {
          return { ground: 'tile_locked', content: null };
        }
        if (tile.state === 'empty') {
          const decoration = getDecoration(tile.decorationId);
          return { ground: 'tile_soil', content: decoration ? `decor_${decoration.id}` : null };
        }
        if (tile.state === 'dead') {
          return { ground: 'tile_soil', content: null };
        }
        const growthForSprite = getGrowth(tile);
        if (!growthForSprite) {
          return { ground: 'tile_soil', content: null };
        }
        return {
          ground: 'tile_soil',
          content: `crop_${growthForSprite.crop.id}_${growthForSprite.stageLabel}`,
        };
      })();

      applyImage(visual.ground, sprites.ground, this.tileSize.width, this.tileSize.height);
      applyImage(visual.content, sprites.content, this.tileSize.width - 16, this.tileSize.height - 16);

      // When the soil/locked art is showing, make the fallback colored square
      // fully transparent (but keep it VISIBLE) so the plots blend into the
      // background as overlapping transparent beds. An invisible Shape is
      // skipped by Phaser's input hit-test, so we must keep it visible and only
      // drop the fill/stroke; it reappears solid only in pure-shape fallback
      // mode (no art).
      // When the soil/locked art is showing, the fallback rect must be fully
      // transparent (no fill, no stroke) so the diamond sprites blend into the
      // background as one contiguous field. An invisible Shape is skipped by
      // Phaser's input hit-test, so we keep the rect VISIBLE and only drop the
      // paint. setRectFill applies the given fallback colour only when there is
      // no art (pure-shape mode); otherwise it stays see-through.
      const showArt = visual.ground.visible;
      const setRectFill = (color: number): void => {
        if (showArt) {
          visual.rect.setFillStyle(color, 0);
          visual.rect.setStrokeStyle();
        } else {
          visual.rect.setFillStyle(color, 1);
          visual.rect.setStrokeStyle(2, 0x4b6d33);
        }
      };

      // Show the most urgent state as a small floating icon badge; hide it when
      // the matching icon isn't loaded or there's nothing to flag.
      const setBadge = (key: string | null): void => {
        if (key && this.textures.exists(key)) {
          // setTexture resets the image to the new frame's native size, so the
          // display size must be re-applied every time the icon changes.
          visual.badge.setTexture(key).setDisplaySize(34, 34).setVisible(true);
        } else {
          visual.badge.setVisible(false);
        }
      };

      // Phase P5b: a locked plot shows its unlock price instead of being usable.
      if (tile.locked) {
        const info = plotUnlockInfo(tile);
        setRectFill(0x3a3a3a);
        // The tile_locked art already depicts a padlock, so only add the lock
        // badge as a fallback when that art isn't loaded.
        setBadge(showArt ? null : 'icon_lock');
        visual.title.setText('');
        visual.subtitle.setText(info.level > 1 ? t('Lv {level} + {cost}c', { level: info.level, cost: info.cost }) : t('{cost}c', { cost: info.cost }));
        return;
      }

      if (tile.state === 'empty') {
        const decoration = getDecoration(tile.decorationId);
        setBadge(null);
        if (decoration) {
          setRectFill(decoration.color);
          visual.title.setText(t('Decor: {name}', { name: t(decoration.name) }));
          visual.subtitle.setText(t('Decorative tile'));
        } else {
          setRectFill(0xc4955f);
          visual.title.setText('');
          visual.subtitle.setText('');
        }
        return;
      }

      if (tile.state === 'dead') {
        setRectFill(0x5a5a5a);
        setBadge(null);
        visual.title.setText(t('Withered'));
        visual.subtitle.setText(t('Clear with hoe (click)'));
        return;
      }

      const growth = getGrowth(tile);
      if (!growth) {
        setRectFill(0x7a5230);
        setBadge(null);
        visual.title.setText(t('Planted'));
        visual.subtitle.setText('');
        return;
      }

      const problems = getActiveProblems(tile);
      const health = Math.round(tile.health ?? CARE.MAX_HEALTH);

      if (problems.length > 0) {
        setRectFill(0xb06a2e);
      } else if (growth.ready) {
        setRectFill(0x4e8b3a);
      } else {
        setRectFill(0x7a5230);
      }

      // Badge priority: the most urgent care problem first, then "ready".
      if (tile.hasPests) {
        setBadge('icon_pesticide');
      } else if (tile.hasWeeds) {
        setBadge('icon_weed');
      } else if (tile.isDry) {
        setBadge('icon_water');
      } else if (growth.ready) {
        setBadge('icon_harvest');
      } else {
        setBadge(null);
      }

      visual.title.setText(t('{crop} \u2022 {stage}', { crop: t(growth.crop.name), stage: t(growth.stageLabel) }));
      const statusPart = growth.ready ? t('Ready') : `${Math.floor(growth.progress * 100)}%`;
      const totalSeasons = growth.crop.seasons ?? 1;
      const seasonPart = totalSeasons > 1 ? ` | S${tile.season ?? 1}/${totalSeasons}` : '';
      // Care problems are now shown by the icon badge, so the text stays brief.
      visual.subtitle.setText(`${statusPart} | HP ${health}${seasonPart}`);
    };

    const attemptUnlock = (tile: FarmTile): void => {
      const info = plotUnlockInfo(tile);
      if (this.economy.level < info.level) {
        this.statusMessage = t('Reach level {level} to unlock this plot.', { level: info.level });
        statusText.setText(this.statusMessage);
        return;
      }
      if (this.economy.coins < info.cost) {
        this.statusMessage = t('Need {cost} coins to unlock this plot.', { cost: info.cost });
        statusText.setText(this.statusMessage);
        return;
      }

      this.economy.coins -= info.cost;
      tile.locked = false;
      this.farmEvents = pushEvent(
        this.farmEvents,
        'system',
        t('You unlocked a new plot for {cost} coins.', { cost: info.cost }),
        Date.now(),
      );
      this.statusMessage = t('Plot unlocked! -{cost} coins. Plant something new here.', { cost: info.cost });

      saveCurrent();
      refreshTileVisual(tile);
      refreshHud();
      refreshEventLog();
      statusText.setText(this.statusMessage);
    };

    // Play a one-shot effect animation centred at (x, y), then destroy it.
    // No-op when the effect's sprite-sheet/animation isn't loaded, so the game
    // still works without the art.
    const playEffect = (key: string, x: number, y: number): void => {
      if (!this.anims.exists(key)) {
        return;
      }
      const sprite = this.add
        .sprite(x, y, key)
        // Effect frames are portrait; keep their native aspect ratio (so the
        // splash isn't squished) and scale relative to the tile width. Anchor
        // near the splash base so it sits over the tile.
        .setOrigin(0.5, 0.72)
        .setDepth(4000);
      const targetW = this.tileSize.width * 0.6;
      const aspect = sprite.height / sprite.width || 1;
      sprite.setDisplaySize(targetW, targetW * aspect);
      // Ease the pop: gently grow and fade out so the distinct concept frames
      // don't feel like they snap on/off.
      sprite.setAlpha(0.92).setScale(sprite.scaleX * 0.85, sprite.scaleY * 0.85);
      const finalScaleX = sprite.scaleX / 0.85;
      const finalScaleY = sprite.scaleY / 0.85;
      this.tweens.add({
        targets: sprite,
        scaleX: finalScaleX,
        scaleY: finalScaleY,
        ease: 'Sine.Out',
        duration: 260,
      });
      this.tweens.add({
        targets: sprite,
        alpha: 0,
        ease: 'Sine.In',
        delay: 180,
        duration: 180,
      });
      sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
      sprite.play(key);
    };

    const renderGrid = (): void => {
      // Isometric layout: the soil sprite is a diamond (top-face center at
      // source (204,130) in a 407x303 image), so tiles are placed on an iso
      // grid where neighbouring diamonds share an edge and read as one
      // contiguous field. Half-width and half-(top-face)-height are derived
      // from the sprite so the beds interlock exactly.
      const diamondW = this.tileSize.width * (394 / 407);
      const topFaceH = this.tileSize.height * (248 / 303);
      const halfW = diamondW / 2;
      const halfH = topFaceH / 2;
      const originX = 720;
      const originY = 380;

      this.farmTiles.forEach((tile) => {
        const cx = originX + (tile.x - tile.y) * halfW;
        const cy = originY + (tile.x + tile.y) * halfH;
        // Tiles further "forward" (higher x+y) sit lower on screen and must
        // draw over the ones behind them so the raised-bed walls are hidden.
        const order = tile.x + tile.y;

        const rect = this.add
          .rectangle(cx, cy, diamondW, topFaceH, 0xc4955f)
          .setOrigin(0.5)
          .setStrokeStyle(2, 0x4b6d33)
          .setDepth(order * 10 - 1);

        // Restrict clicks to the visible diamond (losangle) rather than the
        // sprite's bounding box, so the transparent corners don't steal clicks
        // from neighbouring beds.
        rect.setInteractive({
          hitArea: new Phaser.Geom.Polygon([halfW, 0, diamondW, halfH, halfW, topFaceH, 0, halfH]),
          hitAreaCallback: Phaser.Geom.Polygon.Contains,
          useHandCursor: true,
        });

        // Optional art layers, drawn over the fallback rectangle. They stay
        // hidden whenever the matching texture wasn't loaded, so the game still
        // works with no art (pure shapes) and gradually skins itself as PNGs
        // are added to public/assets. Origin is the diamond's top-face centre.
        const ground = this.add
          .image(cx, cy, '__DEFAULT')
          .setOrigin(0.501, 0.429)
          .setDepth(order * 10)
          .setVisible(false);

        const content = this.add
          .image(cx, cy + 2, '__DEFAULT')
          .setOrigin(0.5, 0.7)
          .setDepth(order * 10 + 1)
          .setVisible(false);

        const title = this.add
          .text(cx, cy - 6, '', {
            color: '#f6efe2',
            fontSize: '11px',
            fontFamily: 'Arial',
            align: 'center',
          })
          .setOrigin(0.5)
          .setDepth(3000 + order);

        const subtitle = this.add
          .text(cx, cy + 9, '', {
            color: '#f6efe2',
            fontSize: '10px',
            fontFamily: 'Arial',
            align: 'center',
          })
          .setOrigin(0.5)
          .setDepth(3000 + order);

        // Status badge: a small icon floating above the bed showing the most
        // urgent care state (locked / pests / weeds / dry / ready). Hidden when
        // there is nothing to flag. Sits above all tile art.
        const badge = this.add
          .image(cx + halfW * 0.5, cy - halfH * 0.5, '__DEFAULT')
          .setOrigin(0.5)
          .setDisplaySize(34, 34)
          .setDepth(3500 + order)
          .setVisible(false);

        tileVisuals.set(tile.id, { rect, ground, content, title, subtitle, badge });
        refreshTileVisual(tile);

        rect.on('pointerdown', () => {
          // Phase P5b: a locked plot must be unlocked before anything else.
          if (tile.locked) {
            attemptUnlock(tile);
            return;
          }

          if (decorationMode) {
            const selectedDecoration = getSelectedDecoration();

            if (this.economy.level < selectedDecoration.unlockLevel) {
              this.statusMessage = t('{name} unlocks at level {level}.', { name: t(selectedDecoration.name), level: selectedDecoration.unlockLevel });
              statusText.setText(this.statusMessage);
              return;
            }

            if (tile.state !== 'empty') {
              this.statusMessage = t('Decor can only be placed on empty tiles.');
              statusText.setText(this.statusMessage);
              return;
            }

            if (tile.decorationId) {
              this.statusMessage = t('Tile already has decoration.');
              statusText.setText(this.statusMessage);
              return;
            }

            if (this.economy.coins < selectedDecoration.price) {
              this.statusMessage = t('Not enough coins to place {name}.', { name: t(selectedDecoration.name) });
              statusText.setText(this.statusMessage);
              return;
            }

            tile.decorationId = selectedDecoration.id;
            this.economy.coins -= selectedDecoration.price;
            this.statusMessage = t('{name} placed. -{price} coins.', { name: t(selectedDecoration.name), price: selectedDecoration.price });

            saveCurrent();
            refreshTileVisual(tile);
            refreshHud();
            statusText.setText(this.statusMessage);
            return;
          }

          if (fertilizerMode) {
            const fertilizer = getSelectedFertilizer();

            if (tile.state !== 'planted') {
              this.statusMessage = t('Fertilizer can only be used on a growing crop.');
              statusText.setText(this.statusMessage);
              return;
            }

            const growth = getGrowth(tile);
            if (!growth) {
              this.statusMessage = t('Fertilizer can only be used on a growing crop.');
              statusText.setText(this.statusMessage);
              return;
            }

            if (growth.ready) {
              this.statusMessage = t('Crop is already ready to harvest.');
              statusText.setText(this.statusMessage);
              return;
            }

            if (this.economy.level < fertilizer.unlockLevel) {
              this.statusMessage = t('{name} unlocks at level {level}.', { name: t(fertilizer.name), level: fertilizer.unlockLevel });
              statusText.setText(this.statusMessage);
              return;
            }

            if ((this.fertilizers[fertilizer.id] ?? 0) <= 0) {
              this.statusMessage = t('No {name} owned. Buy one with B.', { name: t(fertilizer.name) });
              statusText.setText(this.statusMessage);
              return;
            }

            // Parity rule: fertilizer can only be applied once per growth stage.
            const lastFertilizedStage = tile.fertilizedStage ?? -1;
            if (growth.stageIndex <= lastFertilizedStage) {
              this.statusMessage = t('Already fertilized this growth stage. Wait for the next stage.');
              statusText.setText(this.statusMessage);
              return;
            }

            // Move the planted time back so the crop's remaining wait shrinks.
            // Divide by the dev speed scale so the reduction is consistent in
            // real time across 1x/10x/100x.
            const reductionMs = (fertilizer.reduceSeconds / effectiveScale()) * 1000;
            tile.plantedAt = (tile.plantedAt ?? Date.now()) - reductionMs;
            this.fertilizers[fertilizer.id] -= 1;

            const afterGrowth = getGrowth(tile);
            tile.fertilizedStage = afterGrowth ? afterGrowth.stageIndex : growth.stageIndex;

            this.statusMessage = t('{name} applied. -{sec}s growth.', { name: t(fertilizer.name), sec: fertilizer.reduceSeconds });

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
            this.statusMessage = t('Cleared withered crop with the hoe.');
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
              this.statusMessage = t('Removed pests. +1 XP.');
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
              this.statusMessage = t('Removed weeds. +1 XP.');
              saveCurrent();
              refreshTileVisual(tile);
              refreshHud();
              statusText.setText(this.statusMessage);
              return;
            }

            if (tile.isDry) {
              waterTile(tile, Date.now());
              playEffect('fx_water_splash', cx, cy);
              this.economy.xp += 1;
              this.economy.level = getLevelFromXp(this.economy.xp);
              this.statusMessage = t('Watered crop. +1 XP.');
              saveCurrent();
              refreshTileVisual(tile);
              refreshHud();
              statusText.setText(this.statusMessage);
              return;
            }

            const growth = getGrowth(tile);
            if (!growth?.ready) {
              this.statusMessage = t('Crop is still growing. Wait until it is ready.');
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
              seasonSuffix = t(' Regrowing season {n}/{total}.', { n: tile.season, total: totalSeasons });
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
              const unlockSuffix = unlockedNames.length > 0 ? t(' Unlocked: {names}.', { names: unlockedNames.map((n) => t(n)).join(', ') }) : '';
              this.statusMessage = t('Level up! You reached level {level}.{suffix}', { level: this.economy.level, suffix: unlockSuffix });
              saveCurrent();
              this.scene.restart();
              return;
            }

            this.statusMessage = t('{crop} harvested. +1 in inventory. +{xp} XP.{season}', { crop: t(growth.crop.name), xp: xpGain, season: seasonSuffix });

            saveCurrent();
            refreshTileVisual(tile);
            refreshHud();
            inventoryText.setText(getInventoryLabel());
            statusText.setText(this.statusMessage);
            return;
          }

          if (this.economy.level < selectedCrop.unlockLevel) {
            this.statusMessage = t('{name} unlocks at level {level}.', { name: t(selectedCrop.name), level: selectedCrop.unlockLevel });
            statusText.setText(this.statusMessage);
            return;
          }

          if (this.economy.coins < selectedCrop.seedPrice) {
            this.statusMessage = t('Not enough coins to plant {name}.', { name: t(selectedCrop.name) });
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
          this.statusMessage = t('{name} planted. -{price} coins.', { name: t(selectedCrop.name), price: selectedCrop.seedPrice });

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
      this.daily = reset.daily;
      this.pacingProfileId = reset.pacingProfileId;
      this.selectedCropId = reset.selectedCropId;
      this.statusMessage = t('Save reset to default state.');
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
      this.statusMessage = decorationMode ? t('Decoration mode enabled.') : t('Decoration mode disabled.');
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
    claimDailyButton.on('pointerdown', claimDaily);
    pacingButton.on('pointerdown', cyclePacing);
    fertilizerModeButton.on('pointerdown', () => {
      fertilizerMode = !fertilizerMode;
      this.statusMessage = fertilizerMode ? t('Fertilizer mode enabled.') : t('Fertilizer mode disabled.');
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
    syncPanelButton.on('pointerdown', () => openSyncPanel());
    forceUploadButton.on('pointerdown', () => {
      void forceUpload();
    });
    forceDownloadButton.on('pointerdown', () => {
      void forceDownload();
    });
    restoreBackupButton.on('pointerdown', restoreBackupSave);
    closeSyncButton.on('pointerdown', closeSyncPanel);

    languageButton.on('pointerdown', () => {
      saveCurrent();
      cycleLocale();
    });
    const offLocaleChange = onLocaleChange(() => {
      saveCurrent();
      this.scene.restart();
    });
    this.events.once('shutdown', offLocaleChange);

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
    this.input.keyboard?.on('keydown-J', claimDaily);
    this.input.keyboard?.on('keydown-P', cyclePacing);
    this.input.keyboard?.on('keydown-F', () => {
      fertilizerMode = !fertilizerMode;
      this.statusMessage = fertilizerMode ? t('Fertilizer mode enabled.') : t('Fertilizer mode disabled.');
      refreshSelectedSeedLabel();
      statusText.setText(this.statusMessage);
    });
    this.input.keyboard?.on('keydown-B', buyFertilizer);
    this.input.keyboard?.on('keydown-COMMA', () => cycleFertilizer(-1));
    this.input.keyboard?.on('keydown-PERIOD', () => cycleFertilizer(1));
    this.input.keyboard?.on('keydown-G', () => {
      decorationMode = !decorationMode;
      this.statusMessage = decorationMode ? t('Decoration mode enabled.') : t('Decoration mode disabled.');
      refreshSelectedSeedLabel();
      statusText.setText(this.statusMessage);
    });
    this.input.keyboard?.on('keydown-OPEN_BRACKET', () => {
      const currentIndex = decorations.findIndex((item) => item.id === selectedDecorationId);
      const nextIndex = currentIndex <= 0 ? decorations.length - 1 : currentIndex - 1;
      selectedDecorationId = decorations[nextIndex].id;
      refreshSelectedSeedLabel();
      this.statusMessage = t('{name} selected.', { name: t(decorations[nextIndex].name) });
      statusText.setText(this.statusMessage);
      this.scene.restart();
    });
    this.input.keyboard?.on('keydown-CLOSE_BRACKET', () => {
      const currentIndex = decorations.findIndex((item) => item.id === selectedDecorationId);
      const nextIndex = currentIndex >= decorations.length - 1 ? 0 : currentIndex + 1;
      selectedDecorationId = decorations[nextIndex].id;
      refreshSelectedSeedLabel();
      this.statusMessage = t('{name} selected.', { name: t(decorations[nextIndex].name) });
      statusText.setText(this.statusMessage);
      this.scene.restart();
    });
    this.input.keyboard?.on('keydown-U', () => {
      void uploadRemoteSave();
    });
    this.input.keyboard?.on('keydown-D', () => {
      void downloadRemoteSave();
    });
    this.input.keyboard?.on('keydown-Y', () => {
      if (syncPanelBg.visible) {
        closeSyncPanel();
      } else {
        openSyncPanel();
      }
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
    refreshPacingLabel();
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
            simulateTileCare(tile, Date.now(), effectiveScale());
            const crop = getCrop(tile.cropId);
            if (crop && isCropDead(tile, crop.growSeconds, Date.now(), effectiveScale())) {
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
