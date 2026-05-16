import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryTaskDto } from './dto/query-task.dto';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class TasksService {
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

    return task;
  }

  async create(createTaskDto: CreateTaskDto, userId: number) {
    return await this.prisma.task.create({
      data: {
        title: createTaskDto.title,
        done: createTaskDto.done ?? false,
        userId,
      },
    });
  }

  async update(id: number, updateTaskDto: UpdateTaskDto, userId: number) {
    const task = await this.findOne(id, userId);

    if (!task) {
      throw new NotFoundException(`Task with id ${id} not found!`);
    }

    return await this.prisma.task.update({
      where: { id },
      data: {
        title: updateTaskDto.title,
        done: updateTaskDto.done,
      },
    });
  }

  async remove(id: number, userId: number) {
    const task = await this.findOne(id, userId);

    if (!task) {
      throw new NotFoundException(`Task with id ${id} not found!`);
    }

    return await this.prisma.task.delete({
      where: { id },
    });
  }
}
