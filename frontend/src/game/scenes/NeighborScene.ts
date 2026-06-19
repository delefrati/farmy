import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import { crops } from '../data/crops';
import { loveFertilizer } from '../data/fertilizers';
import type { CropDefinition } from '../types/crop';
import type { FarmTile } from '../types/farm';
import type { PlayerEconomy } from '../types/economy';
import type { PlayerInventory } from '../types/inventory';
import type { PlayerAnimals } from '../types/animals';
import type { FarmEvent, Gift, NeighborFarm } from '../types/social';
import { getLevelFromXp } from '../data/progression';
import { removePests, removeWeeds, waterTile } from '../systems/CareSystem';
import { flowerCrops, makeGift, pushEvent, rollDogCatch, SABOTAGE_ENABLED, SOCIAL } from '../systems/SocialSystem';
import { capRemaining, recordCapXp, rolloverDaily, type DailyState } from '../systems/DailySystem';

type TileVisual = {
  rect: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  subtitle: Phaser.GameObjects.Text;
};

// Phase P4 social baseline: the visit view for a single neighbor farm. The
// player can help (clear a problem) or steal (harvest a ripe crop, with limits)
// and every action is written to the shared activity log.
export class NeighborScene extends Phaser.Scene {
  private readonly saveSystem = new SaveSystem();

  private neighborId = '';

  private readonly tileSize = { width: 150, height: 110 };

  private readonly tileGap = 12;

  constructor() {
    super('NeighborScene');
  }

  init(data: { neighborId?: string }): void {
    this.neighborId = data.neighborId ?? '';
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#cfe8b0');

    const save = this.saveSystem.loadGame();
    const economy: PlayerEconomy = save.economy;
    const inventory: PlayerInventory = save.inventory;
    const fertilizers: PlayerInventory = save.fertilizers;
    const animals: PlayerAnimals = save.animals;
    const neighbors: NeighborFarm[] = save.neighbors;
    let events: FarmEvent[] = save.events;
    const popularity: number = save.popularity;
    let giftInbox: Gift[] = save.giftInbox;
    let daily: DailyState = rolloverDaily(save.daily, Date.now());

    const neighbor = neighbors.find((item) => item.id === this.neighborId) ?? neighbors[0];

    // Steal budget is per-visit (resets each time the scene is entered).
    let stealBudget = SOCIAL.STEAL_LIMIT_PER_VISIT;
    // Love fertilizer is also per-visit: a friendly speed-up for growing crops.
    let loveBudget = SOCIAL.LOVE_LIMIT_PER_VISIT;
    let sabotageMode = false;
    let statusMessage = 'Click a plot: clear a problem to help, speed a growing crop with Love Fertilizer, or harvest a ripe crop to steal.';

    const tileVisuals = new Map<string, TileVisual>();

    const getCrop = (cropId: string | undefined): CropDefinition | undefined =>
      cropId ? crops.find((crop) => crop.id === cropId) : undefined;

    const getGrowth = (
      tile: FarmTile,
    ): { crop: CropDefinition; progress: number; ready: boolean } | undefined => {
      const crop = getCrop(tile.cropId);
      if (!crop || !tile.plantedAt) {
        return undefined;
      }
      const elapsedSeconds = Math.max(0, (Date.now() - tile.plantedAt) / 1000);
      const progress = Math.min(elapsedSeconds / crop.growSeconds, 1);
      return { crop, progress, ready: progress >= 1 };
    };

    if (!neighbor) {
      this.add.text(40, 40, 'No neighbor to visit.', {
        color: '#3f5f2f',
        fontSize: '18px',
        fontFamily: 'Arial',
      });
      return;
    }

    this.add
      .text(40, 28, `Visiting ${neighbor.name}'s farm`, {
        color: '#2f4f1f',
        fontSize: '22px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      })
      .setDepth(1);

    const hudText = this.add
      .text(40, 66, '', {
        color: '#2f4f1f',
        fontSize: '16px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const budgetText = this.add
      .text(40, 92, '', {
        color: '#7a3b00',
        fontSize: '14px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    this.add
      .text(40, 118, 'Help clears a problem (water / weeds / pests). A growing crop gets Love Fertilizer. Stealing takes part of a ripe crop; the owner keeps the rest.', {
        color: '#3f5f2f',
        fontSize: '13px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    const statusText = this.add
      .text(40, 144, statusMessage, {
        color: '#3f5f2f',
        fontSize: '14px',
        fontFamily: 'Arial',
      })
      .setDepth(1);

    // Phase P5: protection visibility — make the guard dog state obvious before
    // the player risks a steal or sabotage.
    this.add
      .text(
        40,
        216,
        neighbor.hasDog
          ? `\u{1F415} ${neighbor.name} has a guard dog. Stealing or sabotage may be caught and fined.`
          : `No guard dog here. ${neighbor.name}'s farm is unprotected.`,
        {
          color: neighbor.hasDog ? '#8a2f2f' : '#3f5f2f',
          fontSize: '13px',
          fontFamily: 'Arial',
          fontStyle: neighbor.hasDog ? 'bold' : 'normal',
        },
      )
      .setDepth(1);

    const backButton = this.add
      .text(40, 178, '\u2190 Back to my farm (B / Esc)', {
        color: '#ffffff',
        backgroundColor: '#345c7a',
        fontSize: '15px',
        fontFamily: 'Arial',
        padding: { x: 12, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    const giftButton = this.add
      .text(320, 178, 'Gift a Flower (F)', {
        color: '#ffffff',
        backgroundColor: '#8a3b6a',
        fontSize: '15px',
        fontFamily: 'Arial',
        padding: { x: 12, y: 6 },
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    // Phase P5: optional sabotage. Gated entirely behind the product flag so it
    // can be disabled without touching the rest of the visit flow.
    const sabotageButton = SABOTAGE_ENABLED
      ? this.add
          .text(520, 178, 'Sabotage: OFF (X)', {
            color: '#ffffff',
            backgroundColor: '#7a3b3b',
            fontSize: '15px',
            fontFamily: 'Arial',
            padding: { x: 12, y: 6 },
          })
          .setInteractive({ useHandCursor: true })
          .setDepth(2)
      : undefined;

    this.add
      .text(960, 70, 'Activity log', {
        color: '#2f4f1f',
        fontSize: '15px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      })
      .setDepth(1);

    const logText = this.add
      .text(960, 96, '', {
        color: '#3a5530',
        fontSize: '12px',
        fontFamily: 'Arial',
        lineSpacing: 3,
      })
      .setDepth(1);

    const refreshHud = (): void => {
      hudText.setText(`Coins: ${economy.coins} | XP: ${economy.xp} | Level: ${economy.level}`);
      budgetText.setText(
        `Steal budget this visit: ${stealBudget}/${SOCIAL.STEAL_LIMIT_PER_VISIT} | ` +
          `Love fertilizer left: ${loveBudget}/${SOCIAL.LOVE_LIMIT_PER_VISIT} | ` +
          `Daily XP left — help: ${capRemaining(daily, 'help')}, steal: ${capRemaining(daily, 'steal')}`,
      );
    };

    const refreshLog = (): void => {
      if (events.length === 0) {
        logText.setText('No activity yet.');
        return;
      }
      const lines = events.slice(0, 10).map((event) => `\u2022 ${event.message}`);
      logText.setText(lines.join('\n'));
    };

    const saveCurrent = (): void => {
      this.saveSystem.saveGame({
        economy,
        inventory,
        fertilizers,
        animals,
        selectedCropId: save.selectedCropId,
        farmTiles: save.farmTiles,
        neighbors,
        events,
        popularity,
        giftInbox,
        hasDog: save.hasDog,
        daily,
        pacingProfileId: save.pacingProfileId,
      });
    };

    const refreshTileVisual = (tile: FarmTile): void => {
      const visual = tileVisuals.get(tile.id);
      if (!visual) {
        return;
      }

      if (tile.state !== 'planted') {
        visual.rect.setFillStyle(0xc4955f);
        visual.title.setText('');
        visual.subtitle.setText('Empty plot');
        return;
      }

      const growth = getGrowth(tile);
      const crop = growth?.crop ?? getCrop(tile.cropId);
      const cropName = crop?.name ?? 'Crop';

      const hasProblem = Boolean(tile.isDry || tile.hasWeeds || tile.hasPests);
      const stealable = Boolean(growth?.ready && (tile.stealRemaining ?? 0) > 0);

      if (hasProblem) {
        visual.rect.setFillStyle(0xb06a2e);
      } else if (stealable) {
        visual.rect.setFillStyle(0x4e8b3a);
      } else {
        visual.rect.setFillStyle(0x7a5230);
      }

      visual.title.setText(cropName);

      if (tile.hasPests) {
        visual.subtitle.setText('Pests \u2022 click to help');
      } else if (tile.hasWeeds) {
        visual.subtitle.setText('Weeds \u2022 click to help');
      } else if (tile.isDry) {
        visual.subtitle.setText('Dry \u2022 click to help');
      } else if (stealable) {
        visual.subtitle.setText(`Ripe \u2022 steal x${tile.stealRemaining ?? 0}`);
      } else if (growth) {
        visual.subtitle.setText(`Growing \u2022 ${Math.floor(growth.progress * 100)}%`);
      } else {
        visual.subtitle.setText('Growing');
      }
    };

    // Phase P5: a guarded farm has a chance to catch the player in the act and
    // fine them coins. Returns true when caught so the caller aborts its action.
    const tryGuardCatch = (actionLabel: string): boolean => {
      if (!neighbor.hasDog || !rollDogCatch()) {
        return false;
      }
      const now = Date.now();
      const fine = Math.min(economy.coins, SOCIAL.DOG_FINE);
      economy.coins -= fine;
      events = pushEvent(
        events,
        'caught',
        `${neighbor.name}'s dog caught you ${actionLabel}! Fine: ${fine} coins.`,
        now,
      );
      statusMessage = `Caught by ${neighbor.name}'s dog while ${actionLabel}! Lost ${fine} coins.`;
      saveCurrent();
      refreshHud();
      refreshLog();
      statusText.setText(statusMessage);
      return true;
    };

    const handleTileClick = (tile: FarmTile): void => {
      if (tile.state !== 'planted') {
        statusMessage = 'Empty plot — nothing to do here.';
        statusText.setText(statusMessage);
        return;
      }

      const crop = getCrop(tile.cropId);
      const cropName = crop?.name ?? 'crop';
      const now = Date.now();

      // Phase P5: sabotage mode places a bug or weed instead of helping/stealing.
      if (sabotageMode) {
        if (tryGuardCatch('sabotaging')) {
          return;
        }
        let placed = '';
        if (!tile.hasPests) {
          tile.hasPests = true;
          placed = 'bugs';
        } else if (!tile.hasWeeds) {
          tile.hasWeeds = true;
          placed = 'weeds';
        } else {
          statusMessage = `${neighbor.name}'s ${cropName} is already infested.`;
          statusText.setText(statusMessage);
          return;
        }
        tile.careUpdatedAt = now;
        events = pushEvent(
          events,
          'sabotage',
          `You planted ${placed} on ${neighbor.name}'s ${cropName}.`,
          now,
        );
        statusMessage = `Planted ${placed} on ${neighbor.name}'s ${cropName}.`;
        saveCurrent();
        refreshTileVisual(tile);
        refreshLog();
        statusText.setText(statusMessage);
        return;
      }

      // Help first: resolve the most urgent problem (pests > weeds > dry).
      if (tile.hasPests || tile.hasWeeds || tile.isDry) {
        let verb = '';
        if (tile.hasPests) {
          removePests(tile);
          verb = 'removed pests from';
        } else if (tile.hasWeeds) {
          removeWeeds(tile);
          verb = 'pulled weeds from';
        } else {
          waterTile(tile, now);
          verb = 'watered';
        }

        // Phase P6: helping always clears the problem, but the XP/coin reward
        // stops once the player hits the daily help cap (anti-abuse).
        const capped = capRemaining(daily, 'help') < SOCIAL.HELP_XP;
        if (capped) {
          events = pushEvent(
            events,
            'help',
            `You ${verb} ${neighbor.name}'s ${cropName}. Daily help limit reached — no reward.`,
            now,
          );
          statusMessage = `Helped ${neighbor.name}, but the daily help limit is reached — no XP/coins.`;
        } else {
          economy.coins += SOCIAL.HELP_COINS;
          economy.xp += SOCIAL.HELP_XP;
          economy.level = getLevelFromXp(economy.xp);
          daily = recordCapXp(daily, 'help', SOCIAL.HELP_XP);
          events = pushEvent(
            events,
            'help',
            `You ${verb} ${neighbor.name}'s ${cropName}. +${SOCIAL.HELP_XP} XP, +${SOCIAL.HELP_COINS} coin.`,
            now,
          );
          statusMessage = `Helped ${neighbor.name}. +${SOCIAL.HELP_XP} XP, +${SOCIAL.HELP_COINS} coin.`;
        }

        saveCurrent();
        refreshTileVisual(tile);
        refreshHud();
        refreshLog();
        statusText.setText(statusMessage);
        return;
      }

      const growth = getGrowth(tile);
      if (!growth) {
        statusMessage = 'Nothing to do on this empty plot.';
        statusText.setText(statusMessage);
        return;
      }

      if (!growth.ready) {
        // Still growing: offer the friendly Love Fertilizer speed-up instead of
        // turning the player away. It is a help-style gesture (capped reward),
        // limited per visit, and never steals anything.
        if (loveBudget <= 0) {
          statusMessage = 'No Love Fertilizer left for this visit. Come back later.';
          statusText.setText(statusMessage);
          return;
        }

        const reduceMs = loveFertilizer.reduceSeconds * 1000;
        tile.plantedAt = Math.min(now, (tile.plantedAt ?? now) - reduceMs);
        loveBudget -= 1;

        const capped = capRemaining(daily, 'help') < SOCIAL.HELP_XP;
        if (capped) {
          events = pushEvent(
            events,
            'help',
            `You used Love Fertilizer on ${neighbor.name}'s ${cropName}. Daily help limit reached — no reward.`,
            now,
          );
          statusMessage = `Sped up ${neighbor.name}'s ${cropName}, but the daily help limit is reached — no XP/coins.`;
        } else {
          economy.coins += SOCIAL.HELP_COINS;
          economy.xp += SOCIAL.HELP_XP;
          economy.level = getLevelFromXp(economy.xp);
          daily = recordCapXp(daily, 'help', SOCIAL.HELP_XP);
          events = pushEvent(
            events,
            'help',
            `You used Love Fertilizer on ${neighbor.name}'s ${cropName} (-${loveFertilizer.reduceSeconds}s). +${SOCIAL.HELP_XP} XP, +${SOCIAL.HELP_COINS} coin.`,
            now,
          );
          statusMessage = `Love Fertilizer on ${neighbor.name}'s ${cropName}. +${SOCIAL.HELP_XP} XP, +${SOCIAL.HELP_COINS} coin. Left: ${loveBudget}.`;
        }

        saveCurrent();
        refreshTileVisual(tile);
        refreshHud();
        refreshLog();
        statusText.setText(statusMessage);
        return;
      }

      if ((tile.stealRemaining ?? 0) <= 0) {
        statusMessage = 'Nothing left to steal from this plot.';
        statusText.setText(statusMessage);
        return;
      }

      if (stealBudget <= 0) {
        statusMessage = 'You have taken all you can this visit. Come back later.';
        statusText.setText(statusMessage);
        return;
      }

      // Phase P5: a guard dog may catch you before the harvest succeeds.
      if (tryGuardCatch('stealing')) {
        return;
      }

      // Steal one unit: it goes into the player's inventory to sell later.
      if (tile.cropId) {
        inventory[tile.cropId] = (inventory[tile.cropId] ?? 0) + 1;
      }
      tile.stealRemaining = (tile.stealRemaining ?? 0) - 1;
      stealBudget -= 1;

      // Phase P6: the crop is always taken, but stealing stops paying XP once
      // the daily steal cap is reached (anti-abuse).
      const stealCapped = capRemaining(daily, 'steal') < SOCIAL.STEAL_XP;
      if (!stealCapped) {
        economy.xp += SOCIAL.STEAL_XP;
        economy.level = getLevelFromXp(economy.xp);
        daily = recordCapXp(daily, 'steal', SOCIAL.STEAL_XP);
      }

      // Once fully picked, the owner keeps the rest and the crop regrows so the
      // neighbor farm stays alive on future visits.
      if (tile.stealRemaining <= 0) {
        tile.plantedAt = now;
        tile.stealRemaining = SOCIAL.STEAL_LIMIT_PER_TILE;
      }

      events = pushEvent(
        events,
        'steal',
        stealCapped
          ? `You took 1 ${cropName} from ${neighbor.name}. Daily steal limit reached — no XP.`
          : `You took 1 ${cropName} from ${neighbor.name}. +${SOCIAL.STEAL_XP} XP.`,
        now,
      );
      statusMessage = stealCapped
        ? `Took 1 ${cropName} (daily steal XP limit reached). Budget left: ${stealBudget}.`
        : `Took 1 ${cropName}. +${SOCIAL.STEAL_XP} XP. Budget left: ${stealBudget}.`;

      saveCurrent();
      refreshTileVisual(tile);
      refreshHud();
      refreshLog();
      statusText.setText(statusMessage);
    };

    const originX = 300;
    const originY = 300;
    neighbor.tiles.forEach((tile) => {
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
          fontSize: '13px',
          fontFamily: 'Arial',
        })
        .setDepth(2);

      const subtitle = this.add
        .text(posX + 8, posY + 28, '', {
          color: '#f6efe2',
          fontSize: '12px',
          fontFamily: 'Arial',
        })
        .setDepth(2);

      tileVisuals.set(tile.id, { rect, title, subtitle });
      refreshTileVisual(tile);

      rect.on('pointerdown', () => handleTileClick(tile));
    });

    const goBack = (): void => {
      saveCurrent();
      this.scene.start('FarmScene');
    };

    const giftFlower = (): void => {
      // Find the first flower the player actually has in stock.
      const flower = flowerCrops().find((crop) => (inventory[crop.id] ?? 0) > 0);
      if (!flower) {
        statusMessage = 'No flowers to gift. Grow a Rose or Sunflower on your farm first.';
        statusText.setText(statusMessage);
        return;
      }

      const now = Date.now();
      inventory[flower.id] = (inventory[flower.id] ?? 0) - 1;
      economy.xp += SOCIAL.GIFT_OUT_XP;
      economy.level = getLevelFromXp(economy.xp);

      // The neighbor reciprocates with a flower of their own, which lands in the
      // player's inbox and raises popularity once collected back home.
      giftInbox = [makeGift(neighbor.name, flower.id, now), ...giftInbox];
      events = pushEvent(
        events,
        'system',
        `You gave a ${flower.name} to ${neighbor.name}. They sent one back!`,
        now,
      );
      statusMessage = `Gave a ${flower.name} to ${neighbor.name}. A gift is waiting back home.`;

      saveCurrent();
      refreshHud();
      refreshLog();
      statusText.setText(statusMessage);
    };

    backButton.on('pointerdown', goBack);
    giftButton.on('pointerdown', giftFlower);
    this.input.keyboard?.on('keydown-F', giftFlower);
    this.input.keyboard?.on('keydown-B', goBack);
    this.input.keyboard?.on('keydown-ESC', goBack);

    const toggleSabotage = (): void => {
      if (!sabotageButton) {
        return;
      }
      sabotageMode = !sabotageMode;
      sabotageButton.setText(`Sabotage: ${sabotageMode ? 'ON' : 'OFF'} (X)`);
      sabotageButton.setBackgroundColor(sabotageMode ? '#b23b3b' : '#7a3b3b');
      statusMessage = sabotageMode
        ? 'Sabotage mode ON — click a planted plot to plant bugs/weeds.'
        : 'Sabotage mode OFF. Click a plot to help or steal.';
      statusText.setText(statusMessage);
    };

    if (sabotageButton) {
      sabotageButton.on('pointerdown', toggleSabotage);
      this.input.keyboard?.on('keydown-X', toggleSabotage);
    }

    refreshHud();
    refreshLog();
  }
}
