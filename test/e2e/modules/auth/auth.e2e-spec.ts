import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../../../src/app.module';

describe('AuthController (e2e)', () => {
  let app: NestFastifyApplication;

  const validWallet = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/nonce', () => {
    it('should return nonce and expiresAt with valid wallet', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/nonce',
        payload: { wallet: validWallet },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty('nonce');
      expect(body).toHaveProperty('expiresAt');
      expect(typeof body.nonce).toBe('string');
      expect(body.nonce).toHaveLength(64);
      expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    }, 10000);

    it('should return 400 with invalid wallet format (too short)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/nonce',
        payload: { wallet: 'G123' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 with invalid wallet format (does not start with G)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/nonce',
        payload: {
          wallet: 'XABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 with empty wallet', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/nonce',
        payload: { wallet: '' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 with missing wallet field', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/nonce',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 with additional non-whitelisted fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/nonce',
        payload: { wallet: validWallet, extra: 'field' },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
