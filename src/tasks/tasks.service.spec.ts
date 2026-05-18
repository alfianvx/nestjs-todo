import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('TasksService', () => {
  // `describe` groups related tests. In NestJS projects it's common to have one describe block per

  let service: TasksService;
  // A variable to hold the instance of TasksService resolved from the testing module.

  const prismaMock = {
    // A manual mock of the PrismaService surface we use in tests. This keeps tests fast and
    // deterministic by controlling DB responses.
    task: {
      findMany: jest.fn(), // mock for prisma.task.findMany (returns array of tasks)
      count: jest.fn(), // mock for prisma.task.count (returns numbers used for pagination)
      findFirst: jest.fn(), // mock for prisma.task.findFirst (returns a single task or null)
      create: jest.fn(), // mock for prisma.task.create (returns created task)
      update: jest.fn(), // mock for prisma.task.update (returns updated task)
      delete: jest.fn(), // mock for prisma.task.delete (returns deleted task)
    },
    $transaction: jest.fn(), // mock for prisma.$transaction (used to run multiple queries atomically)
  };

  beforeEach(async () => {
    // `beforeEach` runs before every `it` test. We use it to build a fresh TestingModule so tests
    // are isolated and to reset mocks/state.
    const module: TestingModule = await Test.createTestingModule({
      // `createTestingModule` builds a lightweight Nest module that supports DI. Register providers
      // (services, repositories, mocks) here so module.get(...) can resolve them.
      providers: [
        TasksService, // the provider we're testing — register it so DI can inject dependencies
        {
          provide: PrismaService,
          useValue: prismaMock, // replace PrismaService with our manual mock (useValue)
        },
      ],
    }).compile();

    // Resolve the service instance from the compiled testing module. This is equivalent to
    // Nest resolving the provider in a running app but scoped to our test module.
    service = module.get<TasksService>(TasksService);

    // Clear mock call history/state between tests to avoid cross-test interference.
    jest.clearAllMocks();

    // Provide a default behavior for $transaction so code using it (like Promise.all([...])) works
    // in tests. Here we simulate running multiple prisma calls in parallel and returning their results.
    prismaMock.$transaction.mockImplementation((queries) =>
      Promise.all(queries),
    );
  });

  // find all
  describe('findAll', () => {
    // `it` defines an individual test case. Tests should be small and assert one behavior.
    it('should return all tasks', async () => {
      const userId = 1;

      const moctkTasks = [
        {
          id: 1,
          title: 'Learn NestJS',
          description: null,
          done: false,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Configure the mocks to return expected values for this test case.
      // `mockResolvedValue` makes the jest.fn() return a fulfilled promise with the given value.
      prismaMock.task.findMany.mockResolvedValue(moctkTasks);
      prismaMock.task.count.mockResolvedValue(1);

      // Call the service method under test.
      const result = await service.findAll(userId, {
        page: 1,
        limit: 10,
      });

      // Assert the returned shape and content. `toEqual` does deep equality.
      expect(result).toEqual({
        items: moctkTasks,
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });

      // Ensure the service called Prisma with the expected query parameters. This verifies the
      // service builds queries correctly (filters, pagination, ordering).
      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: {
          userId,
        },
        skip: 0,
        take: 10,
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Verify the service invoked count to compute pagination metadata.
      expect(prismaMock.task.count).toHaveBeenCalledWith({
        where: {
          userId,
        },
      });
    });

    // find all with filter
    it('should filter task by done and search', async () => {
      const userId = 1;

      // set up mocks for a filtered empty result
      prismaMock.task.findMany.mockResolvedValue([]);
      prismaMock.task.count.mockResolvedValue(0);

      // call service with filter params (search and done)
      await service.findAll(userId, {
        page: 2,
        limit: 5,
        search: 'nestjs',
        done: false,
      });

      // check that the built query includes the OR search conditions and the done filter
      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          done: false,
          OR: [
            {
              title: {
                contains: 'nestjs',
                mode: 'insensitive',
              },
            },
            {
              description: {
                contains: 'nestjs',
                mode: 'insensitive',
              },
            },
          ],
        },
        skip: 5,
        take: 5,
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  });

  // find one
  describe('findOne', () => {
    it('should return task if found', async () => {
      const task = {
        id: 1,
        title: 'Learn NestJS',
        description: null,
        done: false,
        userId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // make findFirst resolve with the task — simulates record existing in DB
      prismaMock.task.findFirst.mockResolvedValue(task);

      // call the service and assert return value
      const result = await service.findOne(1, 1);

      expect(result).toEqual(task);
      // assert prisma was called with correct where clause
      expect(prismaMock.task.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          userId: 1,
        },
      });
    });

    it('should throw NotFoundException if task not found', async () => {
      // simulate no record found
      prismaMock.task.findFirst.mockResolvedValue(null);

      // When testing async functions that should throw, use `await expect(...).rejects.toThrow()`
      await expect(service.findOne(999, 1)).rejects.toThrow(NotFoundException);
    });
  });

  // create
  describe('create', () => {
    it('should create task', async () => {
      const userId = 1;

      const createdTask = {
        id: 1,
        title: 'Learn NestJS',
        description: 'learning by doing',
        done: false,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // stub the prisma create call to return the createdTask
      prismaMock.task.create.mockResolvedValue(createdTask);

      // call the service with DTO-like data and assert it returns the created task
      const result = await service.create(
        {
          title: 'Learn NestJS',
          description: 'learning by doing',
        },
        userId,
      );

      expect(result).toEqual(createdTask);

      // verify that the service passed the correct payload to prisma.create
      expect(prismaMock.task.create).toHaveBeenCalledWith({
        data: {
          title: 'Learn NestJS',
          description: 'learning by doing',
          done: false,
          userId,
        },
      });
    });
  });

  // update
  describe('update', () => {
    it('should update task', async () => {
      const userId = 1;

      const existingTask = {
        id: 1,
        title: 'Task Lama',
        description: null,
        done: false,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedTask = {
        ...existingTask,
        title: 'Task Baru',
        done: true,
      };

      // findFirst should return an existing task (authorization/ownership check in service)
      prismaMock.task.findFirst.mockResolvedValue(existingTask);
      // update should return the new task
      prismaMock.task.update.mockResolvedValue(updatedTask);

      const result = await service.update(
        1,
        {
          title: 'Task Baru',
          done: true,
        },
        userId,
      );

      expect(result).toEqual(updatedTask);

      // Ensure the update was called with the expected `where` and `data` shape
      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: {
          id: 1,
        },
        data: {
          title: 'Task Baru',
          description: undefined,
          done: true,
        },
      });
    });

    it('should throw NotFoundException when updating missing task', async () => {
      // Simulate task not found during the pre-update existence check
      prismaMock.task.findFirst.mockResolvedValue(null);

      await expect(
        service.update(
          999,
          {
            title: 'Task Tidak Ada',
          },
          1,
        ),
      ).rejects.toThrow(NotFoundException);

      // Ensure prisma.update was not called when the task does not exist
      expect(prismaMock.task.update).not.toHaveBeenCalled();
    });
  });

  // remove
  describe('remove', () => {
    it('should delete task', async () => {
      const userId = 1;

      const existingTask = {
        id: 1,
        title: 'Task Hapus',
        description: null,
        done: false,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Simulate the find and delete behavior of prisma
      prismaMock.task.findFirst.mockResolvedValue(existingTask);
      prismaMock.task.delete.mockResolvedValue(existingTask);

      const result = await service.remove(1, userId);

      // The service was implemented to return an object describing the deletion
      expect(result).toEqual({
        deleted: true,
        task: existingTask,
      });

      // Verify the delete call used the correct where clause
      expect(prismaMock.task.delete).toHaveBeenCalledWith({
        where: {
          id: 1,
        },
      });
    });

    it('should throw NotFoundException when deleting missing task', async () => {
      prismaMock.task.findFirst.mockResolvedValue(null);

      await expect(service.remove(999, 1)).rejects.toThrow(NotFoundException);

      // Deleting should not be attempted if the task does not exist
      expect(prismaMock.task.delete).not.toHaveBeenCalled();
    });
  });
});
