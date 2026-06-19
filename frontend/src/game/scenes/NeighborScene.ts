import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import { crops } from '../data/crops';
import type { CropDefinition } from '../types/crop';
import type { FarmTile } from '../types/farm';
import type { PlayerEconomy } from '../types/economy';
import type { PlayerInventory } from '../types/inventory';
import type { PlayerAnimals } from '../types/animals';
import type { FarmEvent, NeighborFarm } from '../types/social';
import { getLevelFromXp } from '../data/progression';
import { removePests, removeWeeds, waterTile } from '../systems/CareSystem';
import { pushEvent, SOCIAL } from '../systems/SocialSystem';

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

    const neighbor = neighbors.find((item) => item.id === this.neighborId) ?? neighbors[0];

    // Steal budget is per-visit (resets each time the scene is entered).
    let stealBudget = SOCIAL.STEAL_LIMIT_PER_VISIT;
    let statusMessage = 'Click a plot: clear a problem to help, or harvest a ripe crop to steal.';

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
      .text(40, 118, 'Help clears a problem (water / weeds / pests). Stealing takes part of a ripe crop; the owner keeps the rest.', {
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
      budgetText.setText(`Steal budget this visit: ${stealBudget}/${SOCIAL.STEAL_LIMIT_PER_VISIT}`);
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

    const handleTileClick = (tile: FarmTile): void => {
      if (tile.state !== 'planted') {
        statusMessage = 'Empty plot — nothing to do here.';
        statusText.setText(statusMessage);
        return;
      }

      const crop = getCrop(tile.cropId);
      const cropName = crop?.name ?? 'crop';
      const now = Date.now();

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

        economy.coins += SOCIAL.HELP_COINS;
        economy.xp += SOCIAL.HELP_XP;
        economy.level = getLevelFromXp(economy.xp);
        events = pushEvent(
          events,
          'help',
          `You ${verb} ${neighbor.name}'s ${cropName}. +${SOCIAL.HELP_XP} XP, +${SOCIAL.HELP_COINS} coin.`,
          now,
        );
        statusMessage = `Helped ${neighbor.name}. +${SOCIAL.HELP_XP} XP, +${SOCIAL.HELP_COINS} coin.`;

        saveCurrent();
        refreshTileVisual(tile);
        refreshHud();
        refreshLog();
        statusText.setText(statusMessage);
        return;
      }

      const growth = getGrowth(tile);
      if (!growth?.ready) {
        statusMessage = `${cropName} is still growing. Come back when it is ripe.`;
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

      // Steal one unit: it goes into the player's inventory to sell later.
      if (tile.cropId) {
        inventory[tile.cropId] = (inventory[tile.cropId] ?? 0) + 1;
      }
      tile.stealRemaining = (tile.stealRemaining ?? 0) - 1;
      stealBudget -= 1;
      economy.xp += SOCIAL.STEAL_XP;
      economy.level = getLevelFromXp(economy.xp);

      // Once fully picked, the owner keeps the rest and the crop regrows so the
      // neighbor farm stays alive on future visits.
      if (tile.stealRemaining <= 0) {
        tile.plantedAt = now;
        tile.stealRemaining = SOCIAL.STEAL_LIMIT_PER_TILE;
      }

      events = pushEvent(
        events,
        'steal',
        `You took 1 ${cropName} from ${neighbor.name}. +${SOCIAL.STEAL_XP} XP.`,
        now,
      );
      statusMessage = `Took 1 ${cropName}. +${SOCIAL.STEAL_XP} XP. Budget left: ${stealBudget}.`;

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

    backButton.on('pointerdown', goBack);
    this.input.keyboard?.on('keydown-B', goBack);
    this.input.keyboard?.on('keydown-ESC', goBack);

    refreshHud();
    refreshLog();
  }
}
