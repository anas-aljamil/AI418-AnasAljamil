import { resolveApiUrl } from './apiUrl';

describe('finding the backend', () => {
  it('prefers EXPO_PUBLIC_API_URL and adds /api/v1 once', () => {
    expect(resolveApiUrl({ envUrl: 'http://10.0.0.5:8000/', hostUri: '192.168.1.20:8081' })).toBe(
      'http://10.0.0.5:8000/api/v1',
    );
    expect(resolveApiUrl({ envUrl: 'https://abc.example/api/v1' })).toBe(
      'https://abc.example/api/v1',
    );
  });

  it('in Expo Go, uses the computer that serves the app, on port 8000', () => {
    expect(resolveApiUrl({ hostUri: '192.168.1.20:8081' })).toBe('http://192.168.1.20:8000/api/v1');
    expect(resolveApiUrl({ hostUri: '[::1]:8081' })).toBe('http://[::1]:8000/api/v1');
  });

  it('in a browser, uses the page host; otherwise localhost', () => {
    expect(resolveApiUrl({ webHostname: 'lab-pc.local' })).toBe('http://lab-pc.local:8000/api/v1');
    expect(resolveApiUrl({})).toBe('http://localhost:8000/api/v1');
  });
});
