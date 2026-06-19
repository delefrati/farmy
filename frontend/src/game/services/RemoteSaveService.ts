import type { SaveGame } from '../types/save';

type GameStateResponse = {
  success: boolean;
  data?: SaveGame;
  error?: string;
};

const resolveApiBaseUrl = (): string => {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured && configured.length > 0) {
    return configured;
  }

  return '';
};

export class RemoteSaveService {
  private readonly apiBaseUrl = resolveApiBaseUrl();

  private readonly defaultProfileId = 'dev-local';

  async downloadSave(profileId = this.defaultProfileId): Promise<SaveGame | null> {
    const response = await fetch(`${this.apiBaseUrl}/api/v1/game-state/${profileId}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`download_failed_${response.status}`);
    }

    const payload = (await response.json()) as GameStateResponse;
    if (!payload.success || !payload.data) {
      throw new Error(payload.error ?? 'download_failed_invalid_payload');
    }

    return payload.data;
  }

  async uploadSave(save: SaveGame, profileId = this.defaultProfileId): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/api/v1/game-state/${profileId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(save),
    });

    if (!response.ok) {
      throw new Error(`upload_failed_${response.status}`);
    }

    const payload = (await response.json()) as GameStateResponse;
    if (!payload.success) {
      throw new Error(payload.error ?? 'upload_failed_invalid_payload');
    }
  }
}
