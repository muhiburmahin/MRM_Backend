import { configureApp } from './app.setup';
import type { AppConfigService } from './config/app-config.service';

describe('configureApp', () => {
  it('limits credentialed CORS to origins allow-listed for both CORS and session CSRF checks', () => {
    const app = {
      set: jest.fn(),
      use: jest.fn(),
      enableCors: jest.fn(),
      setGlobalPrefix: jest.fn(),
      enableVersioning: jest.fn(),
      useGlobalPipes: jest.fn(),
    };
    const config = {
      trustProxy: 0,
      swaggerEnabled: false,
      corsOrigins: ['https://admin.example.com', 'https://untrusted.example.com'],
      authAllowedOrigins: ['https://admin.example.com'],
    };

    configureApp(app as never, config as AppConfigService);

    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: true,
        origin: expect.any(Function),
      }),
    );

    const corsCall = app.enableCors.mock.calls[0][0];
    const originFn = corsCall.origin as (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => void;

    let allowed: boolean | undefined;
    originFn('https://admin.example.com', (_err, ok) => {
      allowed = ok;
    });
    expect(allowed).toBe(true);

    let vercelAllowed: boolean | undefined;
    originFn('https://my-preview-app.vercel.app', (_err, ok) => {
      vercelAllowed = ok;
    });
    expect(vercelAllowed).toBe(true);

    let mrmAllowed: boolean | undefined;
    originFn('https://mrminfotech.com', (_err, ok) => {
      mrmAllowed = ok;
    });
    expect(mrmAllowed).toBe(true);

    let wwwAllowed: boolean | undefined;
    originFn('https://www.mrminfotech.com', (_err, ok) => {
      wwwAllowed = ok;
    });
    expect(wwwAllowed).toBe(true);

    let defaultVercelAllowed: boolean | undefined;
    originFn('https://mrminfotech-frontend.vercel.app', (_err, ok) => {
      defaultVercelAllowed = ok;
    });
    expect(defaultVercelAllowed).toBe(true);

    let foreignAllowed: boolean | undefined = true;
    originFn('https://malicious-site.com', (_err, ok) => {
      foreignAllowed = ok;
    });
    expect(foreignAllowed).toBe(false);
  });
});
