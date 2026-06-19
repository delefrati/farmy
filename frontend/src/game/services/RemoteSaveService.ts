import type { SaveGame } from '../types/save';

type GameStateResponse = {
  success: boolean;
  data?: SaveGame;
  error?: string;
};

const PROFILE_ID_STORAGE_KEY = 'farmy.profileId';
const PROFILE_TOKEN_STORAGE_KEY = 'farmy.profileToken';
const PROFILE_TOKEN_HEADER = 'x-profile-token';

const resolveApiBaseUrl = (): string => {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured && configured.length > 0) {
    return configured;
  }

  return '';
};

export class RemoteSaveService {
  private readonly apiBaseUrl = resolveApiBaseUrl();

  private readonly defaultProfileId = this.resolveProfileId();

  private readonly profileToken = this.resolveProfileToken();

  private resolveProfileId(): string {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get('profile')?.trim();
      if (fromQuery) {
        localStorage.setItem(PROFILE_ID_STORAGE_KEY, fromQuery);
        return fromQuery;
      }

      const fromStorage = localStorage.getItem(PROFILE_ID_STORAGE_KEY)?.trim();
      if (fromStorage) {
        return fromStorage;
      }
    }

    const fromEnv = import.meta.env.VITE_PROFILE_ID?.trim();
    if (fromEnv) {
      return fromEnv;
    }

    return 'dev-local';
  }

  getProfileId(): string {
    return this.defaultProfileId;
  }

  getTokenPreview(): string {
    return `${this.profileToken.slice(0, 4)}...${this.profileToken.slice(-4)}`;
  }

  private resolveProfileToken(): string {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get('token')?.trim();
      if (fromQuery && fromQuery.length >= 6) {
        localStorage.setItem(PROFILE_TOKEN_STORAGE_KEY, fromQuery);
        return fromQuery;
      }

      const fromStorage = localStorage.getItem(PROFILE_TOKEN_STORAGE_KEY)?.trim();
      if (fromStorage && fromStorage.length >= 6) {
        return fromStorage;
      }
    }

    const fromEnv = import.meta.env.VITE_PROFILE_TOKEN?.trim();
    if (fromEnv && fromEnv.length >= 6) {
      return fromEnv;
    }

    const generated = `dev-${Math.random().toString(36).slice(2, 12)}`;
    if (typeof window !== 'undefined') {
      localStorage.setItem(PROFILE_TOKEN_STORAGE_KEY, generated);
    }
    return generated;
  }

  private authHeaders(): Record<string, string> {
    return {
      [PROFILE_TOKEN_HEADER]: this.profileToken,
    };
  }

  async downloadSave(profileId = this.defaultProfileId): Promise<SaveGame | null> {
    const response = await fetch(`${this.apiBaseUrl}/api/v1/game-state/${profileId}`, {
      headers: this.authHeaders(),
    });

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
        ...this.authHeaders(),
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
