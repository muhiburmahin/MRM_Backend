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
        origin: ['https://admin.example.com'],
        credentials: true,
      }),
    );
  });
});
