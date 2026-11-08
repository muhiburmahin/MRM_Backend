// Test environment. No real database or secrets are used: Prisma is replaced by a mock in e2e tests.
process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_unused';
process.env.CORS_ORIGINS = 'http://allowed.example';
process.env.AUTH_ALLOWED_ORIGINS = 'http://allowed.example';
process.env.AUTH_IP_HASH_SALT = 'unit-test-only-not-a-secret';
process.env.LOG_LEVEL = 'silent';
process.env.SWAGGER_ENABLED = 'false';
process.env.THROTTLE_LIMIT = '1000';
process.env.MAIL_ENABLED = 'false';
