import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryTaskDto } from './dto/query-task.dto';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: number, query: QueryTaskDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.TaskWhereInput = {
      userId,
      ...(query.done !== undefined && { done: query.done }),
      ...(query.search && {
        OR: [
          {
            title: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          id: 'asc',
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    this.logger.log(`Found ${total} tasks for user ${userId}`);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: number, userId: number) {
    const task = await this.prisma.task.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with id ${id} not found!`);
    }

    this.logger.log(`Found task: id=${task.id} title=${task.title}`);

    return task;
  }

  async create(createTaskDto: CreateTaskDto, userId: number) {
    const task = await this.prisma.task.create({
      data: {
        title: createTaskDto.title,
        done: createTaskDto.done ?? false,
        userId,
      },
    });

    this.logger.log(`Task created: id=${task.id} title=${task.title}`);

    return task;
  }

  async update(id: number, updateTaskDto: UpdateTaskDto, userId: number) {
    const task = await this.findOne(id, userId);

    if (!task) {
      throw new NotFoundException(`Task with id ${id} not found!`);
    }

    const task_updated = await this.prisma.task.update({
      where: { id },
      data: {
        title: updateTaskDto.title,
        done: updateTaskDto.done,
      },
    });

    this.logger.log(
      `Task updated: id=${task_updated.id} title=${task_updated.title}`,
    );

    return task_updated;
  }

  async remove(id: number, userId: number) {
    const task = await this.findOne(id, userId);

    if (!task) {
      throw new NotFoundException(`Task with id ${id} not found!`);
    }

    const task_deleted = await this.prisma.task.delete({
      where: { id },
    });

    this.logger.log(
      `Task deleted: id=${task_deleted.id} title=${task_deleted.title}`,
    );

    return task_deleted;
  }
}
