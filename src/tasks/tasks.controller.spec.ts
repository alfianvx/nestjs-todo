import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
// Use default import for supertest so the imported value is a callable function.
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

describe('TasksController (integration)', () => {
  let app: INestApplication;

  // Mock TasksService to avoid DB calls; only methods used by controller are mocked here.
  const tasksMock = {
    findAll: jest.fn().mockResolvedValue({
      items: [],
      meta: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    }),
    findOne: jest.fn().mockResolvedValue({
      id: 1,
      title: 'Task Example',
      description: null,
      done: false,
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  } as unknown as Partial<TasksService>;

  // Stub JwtAuthGuard so we don't need real JWT tokens in integration tests.
  // This stub injects a `user` object on the request and allows the request.
  const authGuardMock = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = { id: 1, email: 'test@t.com' };
      return true;
    },
  };

  beforeAll(async () => {
    // Create a testing module that mounts the controller and replaces providers with mocks.
    const moduleBuilder = Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: tasksMock }],
    });

    // More reliable guard override using the testing module builder helper
    moduleBuilder.overrideGuard(JwtAuthGuard).useValue(authGuardMock as any);

    const module: TestingModule = await moduleBuilder.compile();

    // Initialize a real (in-memory) Nest application to hit HTTP endpoints via supertest.
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /tasks should return 200 and items', async () => {
    // Use supertest to call the controller's route and assert the response.
    const res = await request(app.getHttpServer()).get('/tasks').expect(200);

    expect(res.body).toHaveProperty('items');
    // Ensure controller passed current user id and a query object to the service.
    expect(tasksMock.findAll).toHaveBeenCalledWith(1, expect.any(Object));
  });

  it('GET /tasks/:id should return single task', async () => {
    const res = await request(app.getHttpServer()).get('/tasks/1').expect(200);

    expect(res.body).toHaveProperty('id', 1);
    // Verify controller forwarded the route param and current user id to service.findOne
    expect(tasksMock.findOne).toHaveBeenCalledWith(1, 1);
  });
});
