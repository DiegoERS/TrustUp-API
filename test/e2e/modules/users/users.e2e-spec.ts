import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../../../../src/app.module';

describe('UsersController (e2e)', () => {
  let app: NestFastifyApplication;
  let accessToken: string;

  const testWallet = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';

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

    // Generate a valid access token using the same JwtService the guard uses
    const jwtService = moduleFixture.get<JwtService>(JwtService);
    const configService = moduleFixture.get<ConfigService>(ConfigService);

    accessToken = jwtService.sign(
      { wallet: testWallet, type: 'access' },
      {
        secret: configService.get<string>('JWT_SECRET'),
        expiresIn: '15m',
      },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('PATCH /users/me', () => {
    it('should return 401 when no authorization token is provided', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        payload: { name: 'Maria Garcia' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 200 with updated profile when valid token is provided', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Maria Garcia' },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty('wallet', testWallet);
      expect(body).toHaveProperty('name', 'Maria Garcia');
      expect(body).toHaveProperty('preferences');
      expect(body).toHaveProperty('updatedAt');
    }, 10000);
  });
});
