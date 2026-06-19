import type { SaveGame } from '../types/save';

type GameStateResponse = {
  success: boolean;
  data?: SaveGame;
  error?: string;
};

type AuthResponse = {
  success: boolean;
  data?: {
    token: string;
    user: {
      id: string;
      email: string;
    };
  };
  error?: string;
};

type AuthUser = {
  id: string;
  email: string;
};

const AUTH_TOKEN_STORAGE_KEY = 'farmy.authToken';
const AUTH_USER_STORAGE_KEY = 'farmy.authUser';

const resolveApiBaseUrl = (): string => {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured && configured.length > 0) {
    return configured;
  }

  return '';
};

export class RemoteSaveService {
  private readonly apiBaseUrl = resolveApiBaseUrl();

  private authToken: string | null = this.loadTokenFromStorage();

  private authUser: AuthUser | null = this.loadUserFromStorage();

  private loadTokenFromStorage(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    return token && token.trim().length > 0 ? token : null;
  }

  private loadUserFromStorage(): AuthUser | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as AuthUser;
      if (typeof parsed.id === 'string' && typeof parsed.email === 'string') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  private persistAuthSession(token: string, user: AuthUser): void {
    this.authToken = token;
    this.authUser = user;

    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    }
  }

  isAuthenticated(): boolean {
    return Boolean(this.authToken && this.authUser);
  }

  getAuthSummary(): string {
    if (!this.authUser) {
      return 'anonymous';
    }

    return this.authUser.email;
  }

  logout(): void {
    this.authToken = null;
    this.authUser = null;

    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    }
  }

  private authHeaders(): Record<string, string> {
    if (!this.authToken) {
      return {};
    }

    return {
      authorization: `Bearer ${this.authToken}`,
    };
  }

  private ensureAuthenticated(): void {
    if (!this.authToken) {
      throw new Error('auth_required');
    }
  }

  async register(email: string, password: string): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(`register_failed_${response.status}`);
    }

    const payload = (await response.json()) as AuthResponse;
    if (!payload.success || !payload.data) {
      throw new Error(payload.error ?? 'register_failed_invalid_payload');
    }

    this.persistAuthSession(payload.data.token, payload.data.user);
  }

  async login(email: string, password: string): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(`login_failed_${response.status}`);
    }

    const payload = (await response.json()) as AuthResponse;
    if (!payload.success || !payload.data) {
      throw new Error(payload.error ?? 'login_failed_invalid_payload');
    }

    this.persistAuthSession(payload.data.token, payload.data.user);
  }

  async downloadSave(): Promise<SaveGame | null> {
    this.ensureAuthenticated();

    const response = await fetch(`${this.apiBaseUrl}/api/v1/game-state/me`, {
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

  async uploadSave(save: SaveGame): Promise<void> {
    this.ensureAuthenticated();

    const response = await fetch(`${this.apiBaseUrl}/api/v1/game-state/me`, {
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
