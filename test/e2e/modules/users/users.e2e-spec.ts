import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import * as request from 'supertest';
import { UsersModule } from '../../../../src/modules/users/users.module';
import { UsersService } from '../../../../src/modules/users/users.service';
import { ConfigModule } from '@nestjs/config';

/**
 * E2E tests for GET /users/me (API-04) and PATCH /users/me (API-05).
 *
 * JwtAuthGuard is mocked here since it is owned by API-03.
 * We test that:
 *  - With a valid (mocked) token → 200 + expected body
 *  - Without a token → 401
 */
describe('UsersController (e2e)', () => {
    let app: INestApplication;

    const testWallet = 'GABC123XYZ456DEF789ABCDEF0123456789ABCDEF0123456789ABCDEFGHIJ';

    const mockUserProfile = {
        wallet: testWallet,
        name: null,
        avatar: null,
        preferences: { notifications: true, theme: 'system', language: 'en' },
        createdAt: '2026-02-19T14:00:00.000Z',
    };

    const mockUpdatedProfile = {
        wallet: testWallet,
        name: 'Maria Garcia',
        avatar: null,
        preferences: { notifications: true, theme: 'system', language: 'en' },
        updatedAt: '2026-02-20T10:00:00.000Z',
    };

    const mockUsersService = {
        getOrCreateProfile: jest.fn().mockResolvedValue(mockUserProfile),
        updateProfile: jest.fn().mockResolvedValue(mockUpdatedProfile),
    };

    // Mock guard that simulates API-03's JwtAuthGuard behavior:
    // sets req.user = { wallet } when the Authorization header is present.
    const mockJwtAuthGuard = {
        canActivate: jest.fn((context) => {
            const req = context.switchToHttp().getRequest();
            const authHeader = req.headers['authorization'];
            if (!authHeader?.startsWith('Bearer ')) return false;
            req.user = { wallet: testWallet };
            return true;
        }),
    };

    beforeAll(async () => {
        // Dynamically import the guard so the test doesn't break if the
        // file doesn't exist yet (API-03 not merged).
        let JwtAuthGuard: any;
        try {
            const guardModule = await import('../../../../src/common/guards/jwt-auth.guard');
            JwtAuthGuard = guardModule.JwtAuthGuard;
        } catch {
            // Guard not yet implemented (API-03 pending) — use mock
            JwtAuthGuard = class MockJwtAuthGuard { };
        }

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ isGlobal: true }),
                UsersModule,
            ],
        })
            .overrideProvider(UsersService)
            .useValue(mockUsersService)
            .overrideGuard(JwtAuthGuard)
            .useValue(mockJwtAuthGuard)
            .compile();

        app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        jest.clearAllMocks();
        mockUsersService.getOrCreateProfile.mockResolvedValue(mockUserProfile);
        mockUsersService.updateProfile.mockResolvedValue(mockUpdatedProfile);
        mockJwtAuthGuard.canActivate.mockImplementation((context) => {
            const req = context.switchToHttp().getRequest();
            const authHeader = req.headers['authorization'];
            if (!authHeader?.startsWith('Bearer ')) return false;
            req.user = { wallet: testWallet };
            return true;
        });
    });

    // ---------------------------------------------------------------------------
    // GET /users/me (API-04)
    // ---------------------------------------------------------------------------
    describe('GET /users/me', () => {
        it('should return 200 with user profile when a valid token is provided', async () => {
            const response = await request(app.getHttpServer())
                .get('/users/me')
                .set('Authorization', 'Bearer valid.jwt.token')
                .expect(200);

            expect(response.body).toEqual({
                success: true,
                data: mockUserProfile,
                message: 'User retrieved successfully',
            });
            expect(mockUsersService.getOrCreateProfile).toHaveBeenCalledWith(testWallet);
        });

        it('should return 401 when no token is provided', async () => {
            await request(app.getHttpServer())
                .get('/users/me')
                .expect(401);

            expect(mockUsersService.getOrCreateProfile).not.toHaveBeenCalled();
        });

        it('should return 401 when Authorization header is malformed', async () => {
            await request(app.getHttpServer())
                .get('/users/me')
                .set('Authorization', 'InvalidScheme token123')
                .expect(401);
        });
    });

    // ---------------------------------------------------------------------------
    // PATCH /users/me (API-05)
    // ---------------------------------------------------------------------------
    describe('PATCH /users/me', () => {
        it('should return 401 when no authorization token is provided', async () => {
            await request(app.getHttpServer())
                .patch('/users/me')
                .send({ name: 'Maria Garcia' })
                .expect(401);

            expect(mockUsersService.updateProfile).not.toHaveBeenCalled();
        });

        it('should return 200 with updated profile when valid token is provided', async () => {
            const response = await request(app.getHttpServer())
                .patch('/users/me')
                .set('Authorization', 'Bearer valid.jwt.token')
                .send({ name: 'Maria Garcia' })
                .expect(200);

            expect(response.body).toHaveProperty('wallet', testWallet);
            expect(response.body).toHaveProperty('name', 'Maria Garcia');
            expect(response.body).toHaveProperty('preferences');
            expect(response.body).toHaveProperty('updatedAt');
            expect(mockUsersService.updateProfile).toHaveBeenCalledWith(
                testWallet,
                expect.objectContaining({ name: 'Maria Garcia' }),
            );
        });
    });
});
