import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
// Import supertest in a way that works for both CJS and ESM runtimes used by different Jest configs
// eslint-disable-next-line @typescript-eslint/no-var-requires
const _req = require('supertest') as any;
const request = _req.default ?? _req;
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Task Manager API E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let accessToken: string;
  let refreshToken: string;
  let createdTaskId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await prisma.task.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.task.deleteMany();
    await prisma.user.deleteMany();

    await app.close();
  });

  describe('Auth', () => {
    it('should register user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user@mail.com',
          password: 'password123',
          name: 'User Satu',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.email).toBe('user@mail.com');
      expect(response.body.data.user.role).toBe('USER');

      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
    });

    it('should not register with duplicate email', async () => {
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'user@mail.com',
        password: 'password123',
        name: 'User Satu',
      });

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user@mail.com',
          password: 'password123',
          name: 'User Satu',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email sudah terdaftar');
    });

    it('should login user', async () => {
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'user@mail.com',
        password: 'password123',
        name: 'User Satu',
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'user@mail.com',
          password: 'password123',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
    });

    it('should reject login with wrong password', async () => {
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'user@mail.com',
        password: 'password123',
        name: 'User Satu',
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'user@mail.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email atau password salah');
    });

    it('should get current user with access token', async () => {
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user@mail.com',
          password: 'password123',
          name: 'User Satu',
        });

      accessToken = registerResponse.body.data.accessToken;

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('user@mail.com');
      expect(response.body.data.role).toBe('USER');
    });

    it('should refresh token', async () => {
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user@mail.com',
          password: 'password123',
          name: 'User Satu',
        });

      refreshToken = registerResponse.body.data.refreshToken;

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should logout user', async () => {
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'user@mail.com',
          password: 'password123',
          name: 'User Satu',
        });

      accessToken = registerResponse.body.data.accessToken;

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.loggedOut).toBe(true);
    });
  });

  describe('Tasks', () => {
    beforeEach(async () => {
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'taskuser@mail.com',
          password: 'password123',
          name: 'Task User',
        });

      accessToken = registerResponse.body.data.accessToken;
    });

    it('should reject task access without token', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(401);
    });

    it('should create task', async () => {
      const response = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Belajar E2E',
          description: 'Testing endpoint NestJS',
          done: false,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.title).toBe('Belajar E2E');
      expect(response.body.data.done).toBe(false);

      createdTaskId = response.body.data.id;
    });

    it('should reject invalid task body', async () => {
      const response = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Ok',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(400);
    });

    it('should get paginated tasks', async () => {
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Belajar Pagination',
          description: 'Test pagination',
          done: false,
        });

      const response = await request(app.getHttpServer())
        .get('/tasks?page=1&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('should search tasks', async () => {
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Belajar Prisma',
          description: 'Database ORM',
          done: false,
        });

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Belajar Swagger',
          description: 'API docs',
          done: false,
        });

      const response = await request(app.getHttpServer())
        .get('/tasks?search=prisma')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].title).toBe('Belajar Prisma');
    });

    it('should filter tasks by done status', async () => {
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Task Belum Selesai',
          done: false,
        });

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Task Sudah Selesai',
          done: true,
        });

      const response = await request(app.getHttpServer())
        .get('/tasks?done=true')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].done).toBe(true);
    });

    it('should get task by id', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Task Detail',
          description: 'Ambil detail task',
          done: false,
        });

      createdTaskId = createResponse.body.data.id;

      const response = await request(app.getHttpServer())
        .get(`/tasks/${createdTaskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(createdTaskId);
      expect(response.body.data.title).toBe('Task Detail');
    });

    it('should update task', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Task Lama',
          done: false,
        });

      createdTaskId = createResponse.body.data.id;

      const response = await request(app.getHttpServer())
        .patch(`/tasks/${createdTaskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Task Baru',
          done: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Task Baru');
      expect(response.body.data.done).toBe(true);
    });

    it('should delete task', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Task Akan Dihapus',
          done: false,
        });

      createdTaskId = createResponse.body.data.id;

      const response = await request(app.getHttpServer())
        .delete(`/tasks/${createdTaskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(true);
      expect(response.body.data.task.id).toBe(createdTaskId);
    });

    it('should not allow user to access another user task', async () => {
      const firstUserTask = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Task User Pertama',
          done: false,
        });

      const taskId = firstUserTask.body.data.id;

      const secondUserRegister = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'second@mail.com',
          password: 'password123',
          name: 'Second User',
        });

      const secondUserToken = secondUserRegister.body.data.accessToken;

      const response = await request(app.getHttpServer())
        .get(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(404);
    });
  });
});
