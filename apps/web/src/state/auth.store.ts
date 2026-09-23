import type { FeatureStatusMap, OperatingMode, ToolGroups } from '@ei-ai/shared-types';
import { create } from 'zustand';

export interface Membership {
  workspaceId: string;
  workspaceName: string;
  workspaceRole: string;
}

export interface Me {
  user: { id: string; email: string; displayName: string; systemRole: string };
  memberships: Membership[];
  operatingMode: OperatingMode;
  toolGroups: ToolGroups;
  featureStatus: FeatureStatusMap;
}

export type AuthStatus = 'unknown' | 'anonymous' | 'authenticated';

interface AuthState {
  accessToken: string | null;
  me: Me | null;
  status: AuthStatus;
  setToken: (token: string) => void;
  setMe: (me: Me) => void;
  clear: () => void;
}

// The access token lives in memory and nowhere else. The durable credential is the refresh cookie,
// which is HttpOnly and SameSite=Strict, so a reload re-obtains the access token rather than
// reading one back out of storage where a script could find it.
export const useAuth = create<AuthState>((set) => ({
  accessToken: null,
  me: null,
  status: 'unknown',
  setToken: (accessToken) => set({ accessToken }),
  setMe: (me) => set({ me, status: 'authenticated' }),
  clear: () => set({ accessToken: null, me: null, status: 'anonymous' }),
}));

// Read outside React, by the api client's refresh path: an interceptor runs between renders and
// cannot call a hook.
export const authStore = useAuth;
