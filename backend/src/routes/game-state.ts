import { Router, type Request, type Response } from 'express';

type GameStateRedisClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
};

type GameStatePayload = {
  version: number;
  savedAt: string;
  economy: {
    coins: number;
    xp: number;
    level: number;
  };
  inventory: Record<string, number>;
  selectedCropId: string;
  farmTiles: Array<{
    id: string;
    x: number;
    y: number;
    state: 'empty' | 'planted';
    cropId?: string;
    plantedAt?: number;
  }>;
};

const KEY_PREFIX = 'farmy:game-state:';
const GRID_TILE_COUNT = 24;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const isValidGameStatePayload = (value: unknown): value is GameStatePayload => {
  if (!isRecord(value)) {
    return false;
  }

  const economy = value.economy;
  const inventory = value.inventory;
  const farmTiles = value.farmTiles;

  if (!isRecord(economy) || !isRecord(inventory) || !Array.isArray(farmTiles)) {
    return false;
  }

  if (farmTiles.length !== GRID_TILE_COUNT) {
    return false;
  }

  const hasValidEconomy =
    typeof economy.coins === 'number' &&
    typeof economy.xp === 'number' &&
    typeof economy.level === 'number';

  if (!hasValidEconomy) {
    return false;
  }

  const hasValidInventory = Object.values(inventory).every((entry) => typeof entry === 'number');
  if (!hasValidInventory) {
    return false;
  }

  const hasValidTiles = farmTiles.every((tile) => {
    if (!isRecord(tile)) {
      return false;
    }

    return (
      typeof tile.id === 'string' &&
      typeof tile.x === 'number' &&
      typeof tile.y === 'number' &&
      (tile.state === 'empty' || tile.state === 'planted') &&
      (tile.cropId === undefined || typeof tile.cropId === 'string') &&
      (tile.plantedAt === undefined || typeof tile.plantedAt === 'number')
    );
  });

  return (
    typeof value.version === 'number' &&
    typeof value.savedAt === 'string' &&
    typeof value.selectedCropId === 'string' &&
    hasValidTiles
  );
};

const getProfileId = (req: Request): string | null => {
  const profileId = req.params.profileId?.trim();
  if (!profileId) {
    return null;
  }

  return profileId;
};

export const createGameStateRoutes = (redisClient: GameStateRedisClient): Router => {
  const router = Router();

  router.get('/:profileId', async (req: Request, res: Response): Promise<void> => {
    const profileId = getProfileId(req);
    if (!profileId) {
      res.status(400).json({ success: false, error: 'profile_id_required' });
      return;
    }

    try {
      const raw = await redisClient.get(`${KEY_PREFIX}${profileId}`);
      if (!raw) {
        res.status(404).json({ success: false, error: 'game_state_not_found' });
        return;
      }

      const data = JSON.parse(raw) as unknown;
      if (!isValidGameStatePayload(data)) {
        res.status(500).json({ success: false, error: 'stored_game_state_invalid' });
        return;
      }

      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/:profileId', async (req: Request, res: Response): Promise<void> => {
    const profileId = getProfileId(req);
    if (!profileId) {
      res.status(400).json({ success: false, error: 'profile_id_required' });
      return;
    }

    if (!isValidGameStatePayload(req.body)) {
      res.status(400).json({ success: false, error: 'invalid_game_state_payload' });
      return;
    }

    try {
      await redisClient.set(`${KEY_PREFIX}${profileId}`, JSON.stringify(req.body));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  return router;
};
