import { api, refreshOnce, request } from './api-client';
import { type Me, authStore } from '../state/auth.store';

// `GET /me` is what turns a token into a session: it carries the user, the memberships, the
// operating mode and the feature map the whole shell reads.
export async function loadMe(): Promise<Me> {
  const me = await api.get<Me>('/me');
  authStore.getState().setMe(me);
  return me;
}

// Called once on a cold start. The access token lives in memory only, so the refresh cookie is the
// only thing that survives a reload; if it is gone or spent, the caller is simply anonymous.
//
// The refresh comes first because there is certainly no access token yet. Calling `/me` and letting
// it 401 would reach the same place, one wasted round trip later and with a 401 in the browser's
// console on every reload — which then has to be explained to everyone who opens the devtools.
export async function restoreSession(): Promise<void> {
  if (!(await refreshOnce())) {
    authStore.getState().clear();
    return;
  }
  try {
    await loadMe();
  } catch {
    authStore.getState().clear();
  }
}

export async function signIn(email: string, password: string): Promise<Me> {
  const { accessToken } = await request<{ accessToken: string }>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  authStore.getState().setToken(accessToken);
  return loadMe();
}

export async function signOut(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    authStore.getState().clear();
  }
}
