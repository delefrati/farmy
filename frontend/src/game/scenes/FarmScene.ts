import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import type { FarmTile } from '../types/farm';
import type { SaveGame } from '../types/save';
import type { PlayerEconomy } from '../types/economy';
import type { PlayerInventory } from '../types/inventory';
import type { PlayerAnimals, AnimalState } from '../types/animals';
import type { AnimalDefinition } from '../types/animal';
import { crops, defaultCropId } from '../data/crops';
import type { CropDefinition } from '../types/crop';
import { RemoteSaveService } from '../services/RemoteSaveService';
import { getLevelFromXp, getXpRequiredForLevel } from '../data/progression';
import { decorations, defaultDecorationId } from '../data/decorations';
import type { DecorationDefinition } from '../types/decoration';
import { fertilizers, defaultFertilizerId } from '../data/fertilizers';
import type { FertilizerDefinition } from '../types/fertilizer';
import { animalDefinitions, getAnimalDefinition } from '../data/animals';
import type { FarmEvent, Gift, NeighborFarm } from '../types/social';
import { avatarKeyForNeighbor, formatEventTime, pushEvent, SOCIAL } from '../systems/SocialSystem';
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
import { mountDevMenu, unmountDevMenu } from '../dev/DevMenu';
import { createNineSlice } from '../ui/NineSlice';

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
      .text(24, 686, t('Farmy — mechanics prototype'), {
        color: '#3f5f2f',
        fontSize: '12px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    // Shop is now a tabbed modal (see the "Shop modal" section below) opened
    // from a single button, instead of an always-visible bottom tray. These
    // shared values place the purchasable buttons inside the modal's content
    // area at a depth above the nine-slice panel, and the arrays collect the
    // seed/decoration selector buttons so each tab can toggle its own group.
    const SHOP_CONTENT_DEPTH = 4002;
    const seedShopButtons: Phaser.GameObjects.Container[] = [];
    const decorationShopButtons: Phaser.GameObjects.Container[] = [];

    // Soft parchment cards behind the HUD text columns so the status labels read
    // on a surface instead of directly over the painted farm background. Drawn
    // at depth 0: above the bg (-10), below all HUD text/buttons (depth >= 1).
    // The grid sits lower on the canvas (y >= ~360) so these never cover tiles.
    const makeHudPanel = (x: number, y: number, w: number, h: number): void => {
      if (this.textures.exists('panel_wood')) {
        createNineSlice({
          scene: this,
          key: 'panel_wood',
          x: x + w / 2,
          y: y + h / 2,
          width: w,
          height: h,
          left: 30,
        }).setDepth(0);
        return;
      }
      this.add
        .graphics()
        .setDepth(0)
        .fillStyle(0xf1e6c4, 0.9)
        .fillRoundedRect(x, y, w, h, 14)
        .lineStyle(3, 0x6f4a25, 0.85)
        .strokeRoundedRect(x, y, w, h, 14);
    };
    makeHudPanel(8, 170, 396, 300); // status / inventory column (left)
    makeHudPanel(806, 92, 236, 268); // barn / animals (center)
    makeHudPanel(1046, 96, 230, 272); // neighbors + activity log (right)

    // Top status bar: a translucent wooden banner that gathers the toolbar
    // buttons and stat chips onto one surface (QQ Farm-style top bar) instead
    // of leaving them floating over the sky.
    this.add
      .graphics()
      .setDepth(0)
      .fillStyle(0x6b4a24, 0.34)
      .fillRoundedRect(4, 6, 1272, 106, 16)
      .lineStyle(2, 0x3a2410, 0.45)
      .strokeRoundedRect(4, 6, 1272, 106, 16);

    // Bottom info strip: a translucent parchment bar that holds the mode/hint
    // text so it reads on a surface instead of clipping off the canvas edge.
    this.add
      .graphics()
      .setDepth(0)
      .fillStyle(0xf1e6c4, 0.86)
      .fillRoundedRect(8, 772, 1264, 80, 14)
      .lineStyle(2, 0x6f4a25, 0.6)
      .strokeRoundedRect(8, 772, 1264, 80, 14);

    // ----- Floating stat chips --------------------------------------------
    // Compact rounded badges (icon + value), each its own standalone element
    // that floats at the top-left instead of being a line inside a panel. They
    // flow left to right and wrap; relayoutChips() recomputes each chip's width
    // and position after any text change so the pill always hugs its content.
    interface StatChip {
      readonly text: Phaser.GameObjects.Text;
      width: () => number;
      setPosition: (x: number, y: number) => void;
      redraw: () => void;
    }
    const CHIP_DEPTH = 6;
    const CHIP_HEIGHT = 30;
    const statChips: StatChip[] = [];
    const makeChip = (iconKey: string, fill: number, textColor: string): StatChip => {
      const padX = 10;
      const iconSize = 18;
      const iconGap = 6;
      const fillHex = `#${fill.toString(16).padStart(6, '0')}`;
      let originX = 0;
      let originY = 0;
      const bg = this.add.graphics().setDepth(CHIP_DEPTH);
      const icon = this.textures.exists(iconKey)
        ? this.add
            .image(0, 0, iconKey)
            .setOrigin(0, 0.5)
            .setDisplaySize(iconSize, iconSize)
            .setDepth(CHIP_DEPTH + 1)
        : null;
      const text = this.add
        .text(0, 0, '', { color: textColor, backgroundColor: fillHex, fontSize: '14px', fontFamily: 'Arial' })
        .setOrigin(0, 0.5)
        .setDepth(CHIP_DEPTH + 1);
      const contentLeft = (): number => padX + (icon ? iconSize + iconGap : 0);
      const width = (): number => contentLeft() + Math.ceil(text.width) + padX;
      const redraw = (): void => {
        const midY = originY + CHIP_HEIGHT / 2;
        if (icon) {
          icon.setPosition(originX + padX, midY);
        }
        text.setPosition(originX + contentLeft(), midY);
        bg.clear();
        bg.fillStyle(fill, 0.95);
        bg.fillRoundedRect(originX, originY, width(), CHIP_HEIGHT, 10);
        bg.lineStyle(2, 0x000000, 0.12);
        bg.strokeRoundedRect(originX, originY, width(), CHIP_HEIGHT, 10);
      };
      const setPosition = (x: number, y: number): void => {
        originX = x;
        originY = y;
        redraw();
      };
      const chip: StatChip = { text, width, setPosition, redraw };
      statChips.push(chip);
      return chip;
    };

    // A QQ Farm-style level widget: "Lv N" + a filled XP progress bar + the
    // remaining XP, all inside one pill. Satisfies the StatChip layout contract
    // so it flows alongside the other chips.
    interface XpChip extends StatChip {
      setProgress: (level: number, xp: number) => void;
    }
    const makeXpChip = (): XpChip => {
      const fill = 0xcdeac0;
      const padX = 10;
      const iconSize = 16;
      const barW = 110;
      const barH = 9;
      let originX = 0;
      let originY = 0;
      let frac = 0;
      const bg = this.add.graphics().setDepth(CHIP_DEPTH);
      const icon = this.textures.exists('icon_xp')
        ? this.add.image(0, 0, 'icon_xp').setOrigin(0, 0.5).setDisplaySize(iconSize, iconSize).setDepth(CHIP_DEPTH + 1)
        : null;
      const lvlText = this.add
        .text(0, 0, 'Lv 1', { color: '#23491b', backgroundColor: '#cdeac0', fontSize: '14px', fontFamily: 'Arial', fontStyle: 'bold' })
        .setOrigin(0, 0.5)
        .setDepth(CHIP_DEPTH + 1);
      const bar = this.add.graphics().setDepth(CHIP_DEPTH + 1);
      const xpText = this.add
        .text(0, 0, '0/40', { color: '#2f5a22', backgroundColor: '#cdeac0', fontSize: '11px', fontFamily: 'Arial' })
        .setOrigin(0, 0.5)
        .setDepth(CHIP_DEPTH + 1);
      const barLeft = (): number => padX + iconSize + 6 + 40 + 8; // icon + gap + reserved "Lv NN" + gap
      const xpLeft = (): number => barLeft() + barW + 8;
      const width = (): number => xpLeft() + Math.ceil(xpText.width) + padX;
      const redraw = (): void => {
        const midY = originY + CHIP_HEIGHT / 2;
        if (icon) {
          icon.setPosition(originX + padX, midY);
        }
        lvlText.setPosition(originX + padX + iconSize + 6, midY);
        xpText.setPosition(originX + xpLeft(), midY);
        bg.clear();
        bg.fillStyle(fill, 0.95);
        bg.fillRoundedRect(originX, originY, width(), CHIP_HEIGHT, 10);
        bg.lineStyle(2, 0x000000, 0.12);
        bg.strokeRoundedRect(originX, originY, width(), CHIP_HEIGHT, 10);
        const bx = originX + barLeft();
        const by = midY - barH / 2;
        bar.clear();
        bar.fillStyle(0x3f6b2c, 1);
        bar.fillRoundedRect(bx, by, barW, barH, 4);
        if (frac > 0) {
          bar.fillStyle(0x7ad04a, 1);
          bar.fillRoundedRect(bx, by, Math.max(4, barW * frac), barH, 4);
        }
        bar.lineStyle(1, 0x000000, 0.18);
        bar.strokeRoundedRect(bx, by, barW, barH, 4);
      };
      const setPosition = (x: number, y: number): void => {
        originX = x;
        originY = y;
        redraw();
      };
      const setProgress = (level: number, xp: number): void => {
        const curBase = getXpRequiredForLevel(level);
        const nextBase = getXpRequiredForLevel(level + 1);
        const span = Math.max(nextBase - curBase, 1);
        const into = Math.max(0, xp - curBase);
        frac = Math.min(1, into / span);
        lvlText.setText(t('Lv {level}', { level }));
        xpText.setText(`${into}/${span}`);
        redraw();
      };
      const chip: XpChip = { text: xpText, width, setPosition, redraw, setProgress };
      statChips.push(chip);
      return chip;
    };
    const CHIP_X0 = 16;
    const CHIP_Y0 = 88;
    const CHIP_GAP = 8;
    const CHIP_ROW_H = 36;
    const CHIP_MAX_X = 792;
    const relayoutChips = (): void => {
      let cx = CHIP_X0;
      let cy = CHIP_Y0;
      for (const chip of statChips) {
        const w = chip.width();
        if (cx > CHIP_X0 && cx + w > CHIP_MAX_X) {
          cx = CHIP_X0;
          cy += CHIP_ROW_H;
        }
        chip.setPosition(cx, cy);
        cx += w + CHIP_GAP;
      }
    };
    const coinsChip = makeChip('icon_coin', 0xf6e3a8, '#5a3d12');
    const levelChip = makeXpChip();
    const popularityChip = makeChip('icon_popularity', 0xf3cfe0, '#7a2f5a');
    const seedChip = makeChip('icon_seed', 0xd8ecc4, '#2f4f1f');
    const dailyChip = makeChip('icon_calendar', 0xcfe8d6, '#1f5c39');


    const collectGiftsButton = this.add
      .text(40, 424, t('Collect Gifts (C)'), {
        color: '#ffffff',
        backgroundColor: '#8a3b6a',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const dogText = this.add
      .text(40, 196, '', {
        color: '#5a3a1a',
        fontSize: '13px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const claimDailyButton = this.add
      .text(210, 424, t('Claim Daily Reward (J)'), {
        color: '#ffffff',
        backgroundColor: '#2f7f4f',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const decorationModeText = this.add
      .text(24, 784, '', {
        color: '#5f3b8a',
        fontSize: '12px',
        fontFamily: 'Arial',
        wordWrap: { width: 1236 },
      })
      .setDepth(1);

    const statusText = this.add
      .text(40, 218, t('Click empty tile to plant. Click a crop to care (water/weeds/pests) or harvest. Sell with S.'), {
        color: '#3f5f2f',
        fontSize: '13px',
        fontFamily: 'Arial',
        wordWrap: { width: 312 },
      })
      .setDepth(1);

    const inventoryText = this.add
      .text(40, 278, t('Inventory: empty'), {
        color: '#2f4f1f',
        fontSize: '13px',
        fontFamily: 'Arial',
        wordWrap: { width: 312 },
      })
      .setDepth(1);

    const syncText = this.add
      .text(40, 342, 'Sync: idle | Last sync: never', {
        color: '#1f5c99',
        fontSize: '12px',
        fontFamily: 'Arial',
        wordWrap: { width: 320 },
      })
      .setDepth(1);

    const authText = this.add
      .text(40, 374, '', {
        color: '#0f4f8c',
        fontSize: '12px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const devSpeedText = this.add
      .text(40, 392, '', {
        color: '#7a3b00',
        fontSize: '12px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const pacingButton = this.add
      .text(300, 54, '', {
        color: '#ffffff',
        backgroundColor: '#5a3d8a',
        fontSize: '12px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const animalsText = this.add
      .text(842, 152, '', {
        color: '#5b3c18',
        fontSize: '13px',
        fontFamily: 'Arial',
        lineSpacing: 2,
        wordWrap: { width: 162 },
      })
      .setDepth(1);

    this.add
      .text(842, 126, t('Barn'), {
        color: '#5b3c18',
        fontSize: '15px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      })
      .setDepth(1);

    this.add
      .text(1082, 128, t('Neighbors'), {
        color: '#2f4f1f',
        fontSize: '15px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      })
      .setDepth(1);

    const visitButtons: Phaser.GameObjects.Text[] = this.neighbors.map((neighbor, index) => {
      const rowY = 156 + index * 34;
      // Small round portrait to the left of the button, when the art exists.
      const avatarKey = avatarKeyForNeighbor(neighbor.id);
      const hasAvatar = this.textures.exists(avatarKey);
      if (hasAvatar) {
        const avatar = this.add.image(1094, rowY + 9, avatarKey).setDepth(2);
        const size = 26;
        avatar.setDisplaySize(size, (avatar.height / avatar.width) * size);
      }
      return this.add
        .text(hasAvatar ? 1114 : 1082, rowY, t('Visit {name}', { name: neighbor.name }), {
          color: '#ffffff',
          backgroundColor: '#345c7a',
          fontSize: '13px',
          fontFamily: 'Arial',
          padding: { x: 8, y: 5 },
        })
        .setInteractive({ useHandCursor: true })
        .setDepth(2);
    });

    this.add
      .text(1082, 156 + this.neighbors.length * 34 + 8, t('Activity log'), {
        color: '#2f4f1f',
        fontSize: '14px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      })
      .setDepth(1);

    const eventLogText = this.add
      .text(1082, 156 + this.neighbors.length * 34 + 30, '', {
        color: '#3a5530',
        fontSize: '11px',
        fontFamily: 'Arial',
        lineSpacing: 3,
        wordWrap: { width: 158 },
      })
      .setDepth(1);

    const controlsHintText = this.add
      .text(24, 810, '', {
        color: '#36522a',
        fontSize: '12px',
        fontFamily: 'Arial',
        wordWrap: { width: 1236 },
      })
      .setDepth(1);

    controlsHintText.setText(t('Shortcuts: O shop | S sell | R reset | L login | U upload | D download | G decor | F fertilize | B buy fert | ,/. switch | A feed | E collect | M sell mature | C gifts | K dog | J daily | P pacing | Y sync. Click a locked plot to unlock it.'));

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

    const feedAnimalsButton = this.add
      .text(842, 250, t('Feed All (A)'), {
        color: '#ffffff',
        backgroundColor: '#5f7b1d',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const collectProductsButton = this.add
      .text(842, 314, t('Collect Products (E)'), {
        color: '#ffffff',
        backgroundColor: '#7b4f1d',
        fontSize: '13px',
        fontFamily: 'Arial',
        padding: { x: 8, y: 5 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const sellAnimalsButton = this.add
      .text(842, 282, t('Sell Mature (M)'), {
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
    const claimDailyIcon = addButtonIcon(claimDailyButton, 'icon_calendar');

    // ----- Shop modal -----------------------------------------------------
    // A tabbed pop-up that gathers every purchasable into one nine-slice wood
    // panel, opened from a single button. The purchase/selector buttons live at
    // SHOP_CONTENT_DEPTH (above the panel) and are toggled per tab; the chrome
    // (dimmer, panel, ribbon title, tab buttons, close) toggles with open/close.
    type ShopTab = 'animals' | 'seeds' | 'fertilizer' | 'decorations';
    type Hideable = { setVisible: (value: boolean) => unknown };

    const SHOP_PANEL_DEPTH = 3998;
    let shopOpen = false;
    let activeShopTab: ShopTab = 'seeds';

    const shopDimmer = this.add
      .rectangle(640, 430, 1280, 860, 0x000000, 0.45)
      .setDepth(3990)
      .setInteractive()
      .setVisible(false);

    const shopPanel: Phaser.GameObjects.Container | Phaser.GameObjects.Rectangle = this.textures.exists('panel_wood')
      ? createNineSlice({ scene: this, key: 'panel_wood', x: 640, y: 392, width: 920, height: 600, left: 34 })
          .setDepth(SHOP_PANEL_DEPTH)
          .setVisible(false)
      : this.add
          .rectangle(640, 392, 920, 600, 0xede0c0, 0.98)
          .setStrokeStyle(4, 0x7b4f1d)
          .setDepth(SHOP_PANEL_DEPTH)
          .setVisible(false);

    // Transparent interactive cover so clicks on the panel body don't fall
    // through to the dimmer (which closes the shop). Phaser's topOnly input
    // routing means tab/content buttons above this still receive their clicks.
    const shopBlocker = this.add
      .rectangle(640, 392, 920, 600, 0x000000, 0.001)
      .setDepth(SHOP_PANEL_DEPTH + 1)
      .setInteractive()
      .setVisible(false);

    let shopRibbon: Phaser.GameObjects.Image | null = null;
    if (this.textures.exists('panel_ribbon')) {
      shopRibbon = this.add.image(640, 150, 'panel_ribbon').setDepth(4001).setVisible(false);
      const ribbonWidth = 340;
      shopRibbon.setDisplaySize(ribbonWidth, ribbonWidth * (shopRibbon.height / shopRibbon.width));
    }

    const shopTitle = this.add
      .text(640, 138, t('Shop'), {
        color: '#5a3210',
        fontSize: '24px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(4002)
      .setVisible(false);

    const shopCloseButton = this.add
      .text(1052, 124, '\u2715', {
        color: '#ffffff',
        backgroundColor: '#a23b2a',
        fontSize: '18px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(4003)
      .setVisible(false);

    // A purchasable item card: thumbnail + title + action pill, drawn with
    // Graphics so each entry reads as a real shop item instead of a bare text
    // button. Cards live above the panel and toggle per tab. The transparent
    // zone is the click target; hovering grows the card slightly.
    interface ShopCardSpec {
      x: number;
      y: number;
      thumbKeys: string[];
      title: string;
      pillLabel: string;
      pillColor: number;
      locked: boolean;
      onClick: () => void;
    }
    const CARD_W = 178;
    const CARD_H = 138;
    const createShopCard = (spec: ShopCardSpec): Phaser.GameObjects.Container => {
      const parts: Phaser.GameObjects.GameObject[] = [];

      const bg = this.add.graphics();
      bg.fillStyle(spec.locked ? 0xe7dcc2 : 0xf6ead0, 0.98);
      bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 14);
      bg.lineStyle(3, spec.locked ? 0x9a8a6a : 0x8a5a24, 1);
      bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 14);
      parts.push(bg);

      const thumbKey = spec.thumbKeys.find((key) => this.textures.exists(key));
      if (thumbKey) {
        const thumb = this.add.image(0, -32, thumbKey).setOrigin(0.5);
        const maxDim = 54;
        thumb.setScale(Math.min(maxDim / thumb.width, maxDim / thumb.height));
        if (spec.locked) {
          thumb.setTint(0x9d9d9d);
        }
        parts.push(thumb);
      }

      parts.push(
        this.add
          .text(0, 6, spec.title, {
            color: '#4a2f12',
            fontSize: '14px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            align: 'center',
          })
          .setOrigin(0.5),
      );

      const pillW = 132;
      const pillH = 28;
      const pillY = 46;
      const pill = this.add.graphics();
      pill.fillStyle(spec.pillColor, 1);
      pill.fillRoundedRect(-pillW / 2, pillY - pillH / 2, pillW, pillH, 9);
      parts.push(pill);
      parts.push(
        this.add
          .text(0, pillY, spec.pillLabel, {
            color: '#ffffff',
            fontSize: '13px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
          })
          .setOrigin(0.5),
      );

      const zone = this.add
        .rectangle(0, 0, CARD_W, CARD_H, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true });
      parts.push(zone);

      const container = this.add
        .container(spec.x, spec.y, parts)
        .setDepth(SHOP_CONTENT_DEPTH)
        .setVisible(false);

      zone.on('pointerover', () => container.setScale(1.04));
      zone.on('pointerout', () => container.setScale(1));
      zone.on('pointerdown', spec.onClick);

      return container;
    };

    // Lay out cards in a centered grid inside the panel content area.
    const cardSlot = (index: number, perRow: number): { x: number; y: number } => {
      const colSpacing = 196;
      const rowSpacing = 150;
      const startY = 322;
      const col = index % perRow;
      const row = Math.floor(index / perRow);
      const rowStartX = 640 - ((perRow - 1) / 2) * colSpacing;
      return { x: rowStartX + col * colSpacing, y: startY + row * rowSpacing };
    };

    const animalThumbKey = (def: (typeof animalDefinitions)[number]): string =>
      def.kind === 'growing' && def.growStages && def.growStages.length > 0
        ? `animal_${def.id}_${def.growStages[def.growStages.length - 1].toLowerCase()}`
        : `animal_${def.id}`;

    // ----- Animal & guard-dog cards (Animals tab) -----
    const animalShopCards: Phaser.GameObjects.Container[] = [];
    let dogCard: Phaser.GameObjects.Container | null = null;

    animalDefinitions.forEach((def, index) => {
      const slot = cardSlot(index, 3);
      const locked = this.economy.level < def.unlockLevel;
      animalShopCards.push(
        createShopCard({
          x: slot.x,
          y: slot.y,
          thumbKeys: [animalThumbKey(def), 'icon_harvest'],
          title: t(def.name),
          pillLabel: locked
            ? t('Lv {level}', { level: def.unlockLevel })
            : t('Buy \u00b7 {price}c', { price: def.price }),
          pillColor: locked ? 0x8a8170 : 0x3f8a3a,
          locked,
          onClick: () => buyAnimal(def.id),
        }),
      );
    });

    {
      const slot = cardSlot(animalDefinitions.length, 3);
      dogCard = createShopCard({
        x: slot.x,
        y: slot.y,
        thumbKeys: ['animal_dog', 'icon_dog'],
        title: t('Guard Dog'),
        pillLabel: t('Buy \u00b7 {price}c', { price: SOCIAL.DOG_PRICE }),
        pillColor: 0x3f8a3a,
        locked: false,
        onClick: () => buyDog(),
      });
      animalShopCards.push(dogCard);
    }

    // ----- Fertilizer cards (Fertilizer tab) -----
    const fertilizerShopCards: Phaser.GameObjects.Container[] = [];
    fertilizers.forEach((fert, index) => {
      const slot = cardSlot(index, 3);
      const locked = this.economy.level < fert.unlockLevel;
      fertilizerShopCards.push(
        createShopCard({
          x: slot.x,
          y: slot.y,
          thumbKeys: ['icon_fertilizer'],
          title: t(fert.name),
          pillLabel: locked
            ? t('Lv {level}', { level: fert.unlockLevel })
            : t('Buy \u00b7 {price}c', { price: fert.price }),
          pillColor: locked ? 0x8a8170 : 0x2f7a41,
          locked,
          onClick: () => {
            selectedFertilizerId = fert.id;
            buyFertilizer();
          },
        }),
      );
    });

    const shopTabDefs: Array<{ id: ShopTab; label: string }> = [
      { id: 'seeds', label: t('Seeds') },
      { id: 'animals', label: t('Animals') },
      { id: 'fertilizer', label: t('Fertilizer') },
      { id: 'decorations', label: t('Decorations') },
    ];
    const shopTabButtons = new Map<ShopTab, Phaser.GameObjects.Text>();

    const shopTabGroup = (tab: ShopTab): Hideable[] => {
      switch (tab) {
        case 'animals':
          return animalShopCards;
        case 'seeds':
          return seedShopButtons;
        case 'fertilizer':
          return fertilizerShopCards;
        case 'decorations':
          return decorationShopButtons;
      }
    };

    const applyShopVisibility = (): void => {
      (['animals', 'seeds', 'fertilizer', 'decorations'] as ShopTab[]).forEach((tab) => {
        const visible = shopOpen && tab === activeShopTab;
        shopTabGroup(tab).forEach((object) => object.setVisible(visible));
      });
      // Guard dog vanishes from the Animals tab once it has been purchased.
      if (shopOpen && activeShopTab === 'animals' && this.hasDog) {
        dogCard?.setVisible(false);
      }
    };

    const setShopTab = (tab: ShopTab): void => {
      activeShopTab = tab;
      shopTabButtons.forEach((button, id) => {
        button.setBackgroundColor(id === tab ? '#d99a3c' : '#6f5230');
      });
      applyShopVisibility();
    };

    shopTabDefs.forEach((tab, index) => {
      const tabX = 640 + (index - (shopTabDefs.length - 1) / 2) * 178;
      const button = this.add
        .text(tabX, 240, tab.label, {
          color: '#ffffff',
          backgroundColor: '#6f5230',
          fontSize: '15px',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          padding: { x: 18, y: 9 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setDepth(4001)
        .setVisible(false);
      button.on('pointerdown', () => setShopTab(tab.id));
      shopTabButtons.set(tab.id, button);
    });

    const setShopChromeVisible = (visible: boolean): void => {
      shopDimmer.setVisible(visible);
      shopPanel.setVisible(visible);
      shopBlocker.setVisible(visible);
      shopRibbon?.setVisible(visible);
      shopTitle.setVisible(visible);
      shopCloseButton.setVisible(visible);
      shopTabButtons.forEach((button) => button.setVisible(visible));
    };

    const openShop = (): void => {
      shopOpen = true;
      setShopChromeVisible(true);
      // Open on the tab holding the player's current selection/mode so the
      // active choice is visible right away (decoration > fertilizer > seeds).
      const startTab: ShopTab = decorationMode ? 'decorations' : fertilizerMode ? 'fertilizer' : 'seeds';
      setShopTab(startTab);
    };

    const closeShop = (): void => {
      shopOpen = false;
      setShopChromeVisible(false);
      applyShopVisibility();
    };

    const toggleShop = (): void => {
      if (shopOpen) {
        closeShop();
      } else {
        openShop();
      }
    };

    shopDimmer.on('pointerdown', closeShop);
    shopCloseButton.on('pointerdown', closeShop);

    // Prominent bottom-left call-to-action that opens the shop. A warm gold pill
    // contrasts against the green farm so it reads as the primary action.
    const SHOP_BTN_W = 176;
    const SHOP_BTN_H = 56;
    const openShopParts: Phaser.GameObjects.GameObject[] = [];
    const shopBtnBg = this.add.graphics();
    // Drop shadow.
    shopBtnBg.fillStyle(0x000000, 0.28);
    shopBtnBg.fillRoundedRect(-SHOP_BTN_W / 2 + 3, -SHOP_BTN_H / 2 + 5, SHOP_BTN_W, SHOP_BTN_H, 16);
    // Body + border.
    shopBtnBg.fillStyle(0xf2a234, 1);
    shopBtnBg.fillRoundedRect(-SHOP_BTN_W / 2, -SHOP_BTN_H / 2, SHOP_BTN_W, SHOP_BTN_H, 16);
    shopBtnBg.lineStyle(3, 0x8a5210, 1);
    shopBtnBg.strokeRoundedRect(-SHOP_BTN_W / 2, -SHOP_BTN_H / 2, SHOP_BTN_W, SHOP_BTN_H, 16);
    // Top gloss highlight.
    shopBtnBg.fillStyle(0xffd884, 0.55);
    shopBtnBg.fillRoundedRect(-SHOP_BTN_W / 2 + 6, -SHOP_BTN_H / 2 + 5, SHOP_BTN_W - 12, SHOP_BTN_H / 2 - 4, 11);
    openShopParts.push(shopBtnBg);
    let shopLabelX = 0;
    if (this.textures.exists('icon_seed')) {
      const icon = this.add.image(-48, -1, 'icon_seed').setOrigin(0.5);
      const isz = 28;
      icon.setScale(Math.min(isz / icon.width, isz / icon.height));
      openShopParts.push(icon);
      shopLabelX = 14;
    }
    openShopParts.push(
      this.add
        .text(shopLabelX, 0, t('Shop'), {
          color: '#ffffff',
          fontSize: '22px',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#7a3d0a',
          strokeThickness: 4,
        })
        .setOrigin(0.5),
    );
    // A transparent interactive child zone is the click target (the same proven
    // pattern as the shop cards). Giving the Container itself a Geom.Rectangle
    // hit area mis-registers under the FIT canvas scale, so we avoid it here.
    const openShopZone = this.add
      .rectangle(0, 0, SHOP_BTN_W, SHOP_BTN_H, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    openShopParts.push(openShopZone);
    const openShopButton = this.add.container(102, 668, openShopParts).setDepth(3);
    openShopZone.on('pointerover', () => openShopButton.setScale(1.05));
    openShopZone.on('pointerout', () => openShopButton.setScale(1));
    openShopZone.on('pointerdown', toggleShop);
    // ----- end Shop modal -------------------------------------------------

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
      seedChip.text.setText(
        t('{name} · {cost}c → {sell}c · +{xp}xp · {grow}s', {
          name: t(selected.name),
          cost: selected.seedPrice,
          sell: selected.sellPrice,
          xp: selected.xp,
          grow: selected.growSeconds,
        }),
      );
      relayoutChips();

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
      coinsChip.text.setText(t('{coins}', { coins: this.economy.coins }));
      levelChip.setProgress(this.economy.level, this.economy.xp);
      popularityChip.text.setText(t('{pop} ♥ · {gifts} gifts', { pop: this.popularity, gifts: this.giftInbox.length }));
      dogText.setText(
        this.hasDog
          ? t('\u{1F415} Guard dog: ON (protecting your farm)')
          : t('\u{1F415} Guard dog: none'),
      );
      applyShopVisibility();

      const now = Date.now();
      const available = isRewardAvailable(this.daily, now);
      const nextReward = rewardForStreak(available ? this.daily.streak + 1 : this.daily.streak);
      dailyChip.text.setText(
        available
          ? t('Reward ready: {label} (streak {streak})', { label: t(nextReward.label), streak: this.daily.streak + 1 })
          : t('Claimed · streak {streak}', { streak: this.daily.streak }),
      );
      claimDailyButton.setVisible(available);
      claimDailyIcon?.setVisible(available);
      relayoutChips();
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

    // --- Animated on-farm animal sprites -----------------------------------
    // Each owned animal is drawn as a sprite standing in the front-left yard.
    // The animation/texture is chosen from the animal's live state (idle /
    // hungry / ready / dead), falling back to the existing static art whenever
    // a given state's strip isn't present.
    const ANIMAL_YARD = { x0: 74, y0: 566, dx: 96, dyRow: 104, perRow: 4, size: 84 };
    const animalSlot = (index: number): { x: number; y: number } => {
      const col = index % ANIMAL_YARD.perRow;
      const row = Math.floor(index / ANIMAL_YARD.perRow);
      return {
        x: ANIMAL_YARD.x0 + col * ANIMAL_YARD.dx,
        y: ANIMAL_YARD.y0 + row * ANIMAL_YARD.dyRow,
      };
    };

    type AnimalView = {
      sprite: Phaser.GameObjects.Sprite;
      visual: string;
      // Per-sprite idle "life": a subtle breathing bob plus a self-rescheduling
      // accent timer (small head/kick fidget, or an occasional full peck). Kept
      // here so they can be cancelled when the animal leaves the idle state or
      // is destroyed. Randomized per animal so a yard full of chickens never
      // animates in lockstep.
      bob?: Phaser.Tweens.Tween;
      accent?: Phaser.Time.TimerEvent;
      anchorY?: number;
      slotX?: number;
      slotY?: number;
    };
    const animalSprites = new Map<string, AnimalView>();
    let dogSprite: Phaser.GameObjects.Sprite | null = null;

    const animalBaseKey = (animal: AnimalState, def: AnimalDefinition): string => {
      if (def.kind === 'growing') {
        return `animal_${def.id}_${getGrowthStageLabel(animal, def).toLowerCase()}`;
      }
      return `animal_${def.id}`;
    };

    type AnimalStateKind = 'idle' | 'hungry' | 'ready' | 'dead';
    type AnimalVisual = { key: string; anim: boolean; specific: boolean; state: AnimalStateKind };

    const resolveAnimalVisual = (
      animal: AnimalState,
      def: AnimalDefinition,
      now: number,
    ): AnimalVisual | null => {
      const base = animalBaseKey(animal, def);
      let state: AnimalStateKind;
      if (animal.dead) {
        state = 'dead';
      } else if (def.kind === 'productive' && animal.storedProduct > 0) {
        state = 'ready';
      } else if (!isFed(animal, now)) {
        state = 'hungry';
      } else {
        state = 'idle';
      }

      const candidates: { key: string; anim: boolean; specific: boolean }[] = [];
      if (state === 'dead') {
        candidates.push({ key: `animal_${def.id}_dead`, anim: false, specific: true });
      } else {
        candidates.push({ key: `${base}_${state}`, anim: true, specific: true });
      }
      candidates.push({ key: `${base}_idle`, anim: true, specific: false });
      candidates.push({ key: base, anim: false, specific: false });

      for (const cand of candidates) {
        const present = cand.anim ? this.anims.exists(cand.key) : this.textures.exists(cand.key);
        if (present) {
          return { ...cand, state };
        }
      }
      return null;
    };

    // Tuning for the layered idle "life". All motion is desynchronized per
    // animal via randomized periods/delays so the yard never moves in unison.
    const IDLE_MOTION = {
      bobPx: 2,
      bobMinMs: 1600,
      bobMaxMs: 2400,
      accentMinMs: 2500,
      accentMaxMs: 6000,
      // Chance an accent is a full "peck" (plays the strip once) vs a cheap
      // procedural head/kick fidget. The rest of the time it's just a fidget.
      peckChance: 0.35,
      fidgetAngle: 6,
      fidgetMs: 150,
    } as const;

    // Cancel a sprite's idle bob + accent scheduler and restore its rest pose.
    const stopIdleMotion = (view: AnimalView): void => {
      if (view.bob) {
        view.bob.stop();
        view.bob = undefined;
      }
      if (view.accent) {
        view.accent.remove(false);
        view.accent = undefined;
      }
      if (view.anchorY !== undefined) {
        view.sprite.setY(view.anchorY);
      }
      view.sprite.setAngle(0);
    };

    // Start the subtle breathing bob and the random accent scheduler for an
    // animal that just entered the idle state. Idempotent.
    const startIdleMotion = (view: AnimalView, idleKey: string): void => {
      if (view.bob || !view.sprite.active) {
        return;
      }
      const sprite = view.sprite;
      const anchorY = view.anchorY ?? sprite.y;
      view.anchorY = anchorY;

      // Always-on gentle vertical bob ("breathing"). Vertical only, so it never
      // fights the angle-based fidget below.
      view.bob = this.tweens.add({
        targets: sprite,
        y: anchorY - IDLE_MOTION.bobPx,
        duration: Phaser.Math.Between(IDLE_MOTION.bobMinMs, IDLE_MOTION.bobMaxMs),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1200),
        ease: 'Sine.InOut',
      });

      const scheduleAccent = (): void => {
        view.accent = this.time.delayedCall(
          Phaser.Math.Between(IDLE_MOTION.accentMinMs, IDLE_MOTION.accentMaxMs),
          () => {
            // Bail if the animal left idle (motion cancelled) meanwhile.
            if (!view.bob || !sprite.active) {
              return;
            }
            if (this.anims.exists(idleKey) && Math.random() < IDLE_MOTION.peckChance) {
              // Big accent: play the strip once, then settle back on the rest
              // frame. Guarded so a state change mid-peck doesn't get stomped.
              sprite.play({ key: idleKey, repeat: 0 });
              sprite.once(`animationcomplete-${idleKey}`, () => {
                if (view.bob && sprite.active) {
                  sprite.setTexture(idleKey, 0);
                }
              });
            } else {
              // Small accent: a quick head/kick wobble.
              this.tweens.add({
                targets: sprite,
                angle: Phaser.Math.Between(-IDLE_MOTION.fidgetAngle, IDLE_MOTION.fidgetAngle),
                duration: IDLE_MOTION.fidgetMs,
                yoyo: true,
                ease: 'Sine.InOut',
              });
            }
            scheduleAccent();
          },
        );
      };
      scheduleAccent();
    };

    const applyAnimalVisual = (view: AnimalView, vis: AnimalVisual, baseSize: number): void => {
      const sprite = view.sprite;
      // The idle state is rendered as a held resting pose with occasional
      // accents (see startIdleMotion), NOT a continuous loop — so a yard of
      // animals stays calm and only fidgets/pecks now and then, out of sync.
      const idleAccented = vis.anim && vis.state === 'idle';
      const visualId = `${vis.key}|${vis.anim ? 'a' : 't'}|${vis.state}`;
      if (view.visual !== visualId) {
        view.visual = visualId;
        stopIdleMotion(view);
        if (idleAccented) {
          sprite.anims.stop();
          sprite.setTexture(vis.key, 0);
        } else if (vis.anim) {
          sprite.play(vis.key);
        } else {
          sprite.anims.stop();
          sprite.setTexture(vis.key);
        }
        // Keep a stable on-screen height regardless of each strip's native size.
        const h = sprite.height || baseSize;
        sprite.setScale(baseSize / h);
        // Convey state even when the state-specific art is missing: a hungry
        // animal looks washed-out, a deceased one greys out and keels over.
        if (vis.state === 'dead') {
          if (vis.specific) {
            sprite.clearTint().setAngle(0).setAlpha(1);
          } else {
            sprite.setTint(0x6f6f6f).setAngle(80).setAlpha(0.95);
          }
        } else if (vis.state === 'hungry' && !vis.specific) {
          sprite.setTint(0xccba8c).setAngle(0).setAlpha(1);
        } else {
          sprite.clearTint().setAngle(0).setAlpha(1);
        }
        if (idleAccented) {
          startIdleMotion(view, vis.key);
        }
      }
    };

    const syncAnimalSprites = (): void => {
      const now = Date.now();
      const live = new Set(this.animals.animals.map((a) => a.id));
      for (const [id, view] of animalSprites) {
        if (!live.has(id)) {
          stopIdleMotion(view);
          view.sprite.destroy();
          animalSprites.delete(id);
        }
      }

      this.animals.animals.forEach((animal, index) => {
        const def = getAnimalDefinition(animal.defId);
        if (!def) {
          return;
        }
        const vis = resolveAnimalVisual(animal, def, now);
        let view = animalSprites.get(animal.id);
        if (!vis) {
          if (view) {
            stopIdleMotion(view);
            view.sprite.destroy();
            animalSprites.delete(animal.id);
          }
          return;
        }
        const slot = animalSlot(index);
        if (!view) {
          const sprite = this.add
            .sprite(slot.x, slot.y, vis.key)
            .setOrigin(0.5, 1)
            .setDepth(2500 + index);
          view = { sprite, visual: '' };
          animalSprites.set(animal.id, view);
        }
        // Only reposition when the slot actually changes (e.g. an animal was
        // added/removed and indices shifted). Repositioning every tick would
        // overwrite the breathing bob's vertical offset. When it does move,
        // re-anchor the motion by forcing a visual re-apply.
        if (view.slotX !== slot.x || view.slotY !== slot.y) {
          view.sprite.setPosition(slot.x, slot.y);
          view.slotX = slot.x;
          view.slotY = slot.y;
          view.anchorY = slot.y;
          view.visual = '';
        }
        view.sprite.setDepth(2500 + index);
        const size = ANIMAL_YARD.size * (def.kind === 'growing' ? 1.15 : 1);
        applyAnimalVisual(view, vis, size);
      });

      // Guard dog: stored as a boolean flag, not in the animals array.
      const dogArt = this.anims.exists('animal_dog_idle') || this.textures.exists('animal_dog');
      if (this.hasDog && dogArt) {
        if (!dogSprite) {
          const initKey = this.textures.exists('animal_dog') ? 'animal_dog' : 'animal_dog_idle';
          dogSprite = this.add.sprite(42, 742, initKey).setOrigin(0.5, 1).setDepth(2490);
        }
        if (this.anims.exists('animal_dog_idle')) {
          if (dogSprite.anims.getName() !== 'animal_dog_idle') {
            dogSprite.play('animal_dog_idle');
          }
        } else {
          dogSprite.setTexture('animal_dog');
        }
        const dh = dogSprite.height || 70;
        dogSprite.setScale(70 / dh);
      } else if (dogSprite) {
        dogSprite.destroy();
        dogSprite = null;
      }
    };

    const refreshAnimalsLabel = (): void => {
      syncAnimalSprites();
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
      seedShopButtons.length = 0;

      crops.forEach((crop, index) => {
        const isSelected = crop.id === this.selectedCropId;
        const isUnlocked = this.economy.level >= crop.unlockLevel;
        const slot = cardSlot(index, 4);
        const lastStage = crop.stages[crop.stages.length - 1];

        const pillLabel = !isUnlocked
          ? t('Lv {level}', { level: crop.unlockLevel })
          : isSelected
            ? t('Selected \u2713')
            : t('Plant \u00b7 {price}c', { price: crop.seedPrice });
        const pillColor = !isUnlocked ? 0x8a8170 : isSelected ? 0x2f6f9f : 0x4b8d52;

        const card = createShopCard({
          x: slot.x,
          y: slot.y,
          thumbKeys: [`crop_${crop.id}_${lastStage}`, 'icon_seed'],
          title: t(crop.name),
          pillLabel,
          pillColor,
          locked: !isUnlocked,
          onClick: () => {
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
          },
        });
        seedShopButtons.push(card);
      });
    };

    const renderDecorationSelector = (): void => {
      decorationShopButtons.length = 0;

      decorations.forEach((decoration, index) => {
        const isSelected = decoration.id === selectedDecorationId;
        const isUnlocked = this.economy.level >= decoration.unlockLevel;
        const slot = cardSlot(index, 4);

        const pillLabel = !isUnlocked
          ? t('Lv {level}', { level: decoration.unlockLevel })
          : isSelected
            ? t('Selected \u2713')
            : t('Select');
        const pillColor = !isUnlocked ? 0x8a8170 : isSelected ? 0x5f3b8a : 0x7751a1;

        const card = createShopCard({
          x: slot.x,
          y: slot.y,
          thumbKeys: [`decor_${decoration.id}`, 'icon_harvest'],
          title: t(decoration.name),
          pillLabel,
          pillColor,
          locked: !isUnlocked,
          onClick: () => {
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
          },
        });
        decorationShopButtons.push(card);
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
    claimDailyButton.on('pointerdown', claimDaily);
    pacingButton.on('pointerdown', cyclePacing);
    fertilizerModeButton.on('pointerdown', () => {
      fertilizerMode = !fertilizerMode;
      this.statusMessage = fertilizerMode ? t('Fertilizer mode enabled.') : t('Fertilizer mode disabled.');
      refreshSelectedSeedLabel();
      statusText.setText(this.statusMessage);
    });
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
    this.input.keyboard?.on('keydown-O', toggleShop);
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

    if (isDevMode) {
      // Dev-only overlay for fast validation: edit values and run shortcuts,
      // then persist + restart so the change is fully reflected. Hidden from
      // production builds (import.meta.env.DEV is false there).
      const applyDev = (): void => {
        saveCurrent();
        this.scene.restart();
      };

      const setCount = (bag: PlayerInventory, id: string, value: number): void => {
        const count = Math.max(0, Math.floor(value));
        if (count <= 0) {
          delete bag[id];
        } else {
          bag[id] = count;
        }
      };

      const makeAllCropsReady = (): void => {
        const now = Date.now();
        this.farmTiles.forEach((tile) => {
          if (tile.state !== 'planted') {
            return;
          }
          const crop = getCrop(tile.cropId);
          if (!crop) {
            return;
          }
          // Back-date planting so growth reads as complete under the current
          // pacing scale, and clear any care problems so it isn't flagged dead.
          tile.plantedAt = now - Math.ceil((crop.growSeconds * 1000) / effectiveScale()) - 1000;
          tile.health = CARE.MAX_HEALTH;
          tile.isDry = false;
          tile.hasWeeds = false;
          tile.hasPests = false;
          tile.wateredAt = now;
          tile.careUpdatedAt = now;
        });
      };

      const clearAllTiles = (): void => {
        this.farmTiles.forEach((tile) => {
          tile.state = 'empty';
          tile.cropId = undefined;
          tile.plantedAt = undefined;
          tile.decorationId = undefined;
          tile.season = undefined;
          tile.fertilizedStage = undefined;
          clearTileCare(tile);
        });
      };

      const matureAllAnimals = (): void => {
        const now = Date.now();
        this.animals.animals.forEach((animal) => {
          const def = getAnimalDefinition(animal.defId);
          if (!def) {
            return;
          }
          animal.fedUntil = now + 10 * 60 * 1000;
          if (def.kind === 'growing') {
            animal.matured = true;
            animal.growthMs = (def.growSeconds ?? 0) * 1000;
          } else {
            animal.storedProduct = def.produceCap ?? animal.storedProduct;
          }
        });
      };

      const productFields = animalDefinitions
        .filter((def) => def.kind === 'productive' && def.productId)
        .map((def) => ({
          label: t(def.productLabel ?? def.productId ?? def.name),
          get: () => this.inventory[def.productId as string] ?? 0,
          set: (v: number) => setCount(this.inventory, def.productId as string, v),
        }));

      mountDevMenu({
        onChange: applyDev,
        sections: [
          {
            title: 'Economy',
            fields: [
              { label: 'Coins', get: () => this.economy.coins, set: (v) => { this.economy.coins = Math.max(0, Math.floor(v)); } },
              { label: 'XP', get: () => this.economy.xp, set: (v) => { this.economy.xp = Math.max(0, Math.floor(v)); this.economy.level = getLevelFromXp(this.economy.xp); } },
              { label: 'Level', get: () => this.economy.level, set: (v) => { const lvl = Math.max(1, Math.floor(v)); this.economy.level = lvl; this.economy.xp = Math.max(this.economy.xp, getXpRequiredForLevel(lvl)); } },
              { label: 'Popularity', get: () => this.popularity, set: (v) => { this.popularity = Math.max(0, Math.floor(v)); } },
            ],
            actions: [
              { label: '+1k coins', run: () => { this.economy.coins += 1000; } },
              { label: 'Max level', run: () => { this.economy.level = 15; this.economy.xp = getXpRequiredForLevel(15); } },
              { label: 'Toggle dog', run: () => { this.hasDog = !this.hasDog; } },
              { label: '+1 gift', run: () => { this.giftInbox.push({ id: `gift-dev-${Date.now()}`, fromName: 'Dev', flowerId: 'rose', at: Date.now() }); } },
            ],
          },
          {
            title: 'Inventory',
            fields: [
              ...crops.map((crop) => ({
                label: t(crop.name),
                get: () => this.inventory[crop.id] ?? 0,
                set: (v: number) => setCount(this.inventory, crop.id, v),
              })),
              ...productFields,
            ],
          },
          {
            title: 'Fertilizers',
            fields: fertilizers.map((fert) => ({
              label: t(fert.name),
              get: () => this.fertilizers[fert.id] ?? 0,
              set: (v: number) => setCount(this.fertilizers, fert.id, v),
            })),
          },
          {
            title: 'Animals',
            actions: [
              ...animalDefinitions.map((def) => ({
                label: `Add ${t(def.name)}`,
                run: () => { this.animals.animals.push(createAnimalInstance(def.id, Date.now())); },
              })),
              { label: 'Mature all', run: matureAllAnimals },
              { label: 'Starve all', run: () => { const past = Date.now() - 1; this.animals.animals.forEach((a) => { if (!a.dead) { a.fedUntil = past; a.starveMs = ANIMAL.STARVE_SECONDS * 1000 * 0.95; } }); } },
              { label: 'Kill all', run: () => { this.animals.animals.forEach((a) => { a.dead = true; }); } },
              { label: 'Remove all', run: () => { this.animals.animals = []; } },
            ],
          },
          {
            title: 'Land & Crops',
            actions: [
              { label: 'Unlock all land', run: () => { this.farmTiles.forEach((tile) => { tile.locked = false; }); } },
              { label: 'Ripen crops', run: makeAllCropsReady },
              { label: 'Clear tiles', run: clearAllTiles },
            ],
          },
          {
            title: 'Save',
            actions: [
              { label: 'Reset save', run: resetSave, apply: false },
            ],
          },
        ],
      });

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, unmountDevMenu);
      this.events.once(Phaser.Scenes.Events.DESTROY, unmountDevMenu);
    }

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
