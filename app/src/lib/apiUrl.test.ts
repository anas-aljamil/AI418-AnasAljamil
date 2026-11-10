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

  it('on the Expo web server (port 8081), calls the same host on port 8000', () => {
    expect(
      resolveApiUrl({
        webHostname: '192.168.1.20',
        webOrigin: 'http://192.168.1.20:8081',
        webPort: '8081',
      }),
    ).toBe('http://192.168.1.20:8000/api/v1');
  });

  it('when the API serves the page (the public link), calls its own address', () => {
    expect(
      resolveApiUrl({
        webHostname: 'calm-river.trycloudflare.com',
        webOrigin: 'https://calm-river.trycloudflare.com',
        webPort: '',
      }),
    ).toBe('https://calm-river.trycloudflare.com/api/v1');
    expect(
      resolveApiUrl({
        webHostname: 'localhost',
        webOrigin: 'http://localhost:8000',
        webPort: '8000',
      }),
    ).toBe('http://localhost:8000/api/v1');
  });
});
