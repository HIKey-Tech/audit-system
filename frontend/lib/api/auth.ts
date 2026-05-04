import { api } from '../api-client';
import type { UserDto } from '../types/domain';

interface ProxyAuthResult {
  user: UserDto;
}

export const authApi = {
  async login(email: string, password: string): Promise<UserDto> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const json = (await res.json()) as { success: boolean; message?: string; data?: ProxyAuthResult };
    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.message || 'Login failed');
    }
    return json.data.user;
  },

  async logout(): Promise<void> {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  },

  async me(): Promise<UserDto> {
    return api.get<UserDto>('/users/me');
  },
};
