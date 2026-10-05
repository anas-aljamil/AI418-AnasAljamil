/**
 * The API client's session rules (CLAUDE.md Section 8): the access token stays in memory,
 * the refresh token in the secure store; a 401 refreshes once and retries; a rejected refresh
 * ends the session; a network failure during refresh does not.
 */
import * as SecureStore from 'expo-secure-store';

import {
  api,
  ApiError,
  refreshSession,
  setSessionExpiredHandler,
  signInRequest,
  signOutRequest,
} from './client';

const user = { user_id: 9, role: 'student', full_name_ar: 'سعد', full_name_en: 'Saad' };
const tokens = (n: number) => ({
  access_token: `access-${n}`,
  access_expires_at: '2026-10-05T07:15:00Z',
  refresh_token: `refresh-${n}`,
  user,
});

function reply(status: number, body?: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    json: () => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body)),
  } as Response);
}

const fetchMock = jest.fn();
globalThis.fetch = fetchMock;
const sentAuth = (call: number) =>
  (fetchMock.mock.calls[call]?.[1] as RequestInit).headers as Record<string, string>;
const sentBody = (call: number) =>
  JSON.parse(String((fetchMock.mock.calls[call]?.[1] as RequestInit).body));

beforeEach(async () => {
  fetchMock.mockReset();
  setSessionExpiredHandler(null);
  await signOutRequest();
});

it('signs in as a native client and keeps the refresh token in the secure store', async () => {
  fetchMock.mockReturnValueOnce(reply(200, tokens(1)));
  await signInRequest('s.almutairi@university.example', 'secret');
  expect(sentBody(0)).toEqual({
    email: 's.almutairi@university.example',
    password: 'secret',
    client: 'native',
  });
  expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith('mawjood.refresh', 'refresh-1');

  fetchMock.mockReturnValueOnce(reply(200, { items: [] }));
  await api('/me/pins');
  expect(sentAuth(1).Authorization).toBe('Bearer access-1');
});

it('turns the API error shape into an ApiError with its code', async () => {
  fetchMock.mockReturnValueOnce(
    reply(401, { error: { code: 'INVALID_CREDENTIALS', message: 'The email or password…' } }),
  );
  await expect(signInRequest('a@b.example', 'x')).rejects.toMatchObject({
    status: 401,
    code: 'INVALID_CREDENTIALS',
  });
});

it('reports an unreachable server as NETWORK', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
  const error = await api('/me/pins').catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status: 0, code: 'NETWORK' });
});

it('refreshes once on 401, stores the new refresh token and retries', async () => {
  fetchMock.mockReturnValueOnce(reply(200, tokens(1)));
  await signInRequest('s@u.example', 'secret');
  fetchMock
    .mockReturnValueOnce(reply(401, { error: { code: 'UNAUTHORIZED', message: '' } }))
    .mockReturnValueOnce(reply(200, tokens(2)))
    .mockReturnValueOnce(reply(200, { items: ['ok'] }));
  await expect(api('/me/pins')).resolves.toEqual({ items: ['ok'] });
  expect(sentBody(2)).toEqual({ refresh_token: 'refresh-1' });
  expect(sentAuth(3).Authorization).toBe('Bearer access-2');
  expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith('mawjood.refresh', 'refresh-2');
});

it('shares one refresh between requests that fail at the same time', async () => {
  fetchMock.mockReturnValueOnce(reply(200, tokens(1)));
  await signInRequest('s@u.example', 'secret');
  fetchMock.mockReturnValueOnce(reply(200, tokens(2))).mockReturnValueOnce(reply(200, tokens(3)));
  await Promise.all([refreshSession(), refreshSession()]);
  expect(fetchMock).toHaveBeenCalledTimes(2); // sign-in + one refresh
});

it('ends the session when the server rejects the refresh token', async () => {
  const expired = jest.fn();
  setSessionExpiredHandler(expired);
  fetchMock.mockReturnValueOnce(reply(200, tokens(1)));
  await signInRequest('s@u.example', 'secret');
  fetchMock
    .mockReturnValueOnce(reply(401, { error: { code: 'UNAUTHORIZED', message: '' } }))
    .mockReturnValueOnce(reply(401, { error: { code: 'UNAUTHORIZED', message: '' } }));
  await expect(api('/me/pins')).rejects.toMatchObject({ status: 401 });
  expect(expired).toHaveBeenCalledTimes(1);
  expect(await SecureStore.getItemAsync('mawjood.refresh')).toBeNull();
});

it('stays signed in when the refresh fails only because the network is down', async () => {
  const expired = jest.fn();
  setSessionExpiredHandler(expired);
  fetchMock.mockReturnValueOnce(reply(200, tokens(1)));
  await signInRequest('s@u.example', 'secret');
  fetchMock
    .mockReturnValueOnce(reply(401, { error: { code: 'UNAUTHORIZED', message: '' } }))
    .mockRejectedValueOnce(new TypeError('Network request failed'));
  await expect(api('/me/pins')).rejects.toMatchObject({ code: 'NETWORK' });
  expect(expired).not.toHaveBeenCalled();
  expect(await SecureStore.getItemAsync('mawjood.refresh')).toBe('refresh-1');
});

it('forgets both tokens on sign-out', async () => {
  fetchMock.mockReturnValueOnce(reply(200, tokens(1)));
  await signInRequest('s@u.example', 'secret');
  await signOutRequest();
  expect(await SecureStore.getItemAsync('mawjood.refresh')).toBeNull();
  fetchMock.mockReturnValueOnce(reply(200, {}));
  await api('/health');
  expect(sentAuth(1).Authorization).toBeUndefined();
});
