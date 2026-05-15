import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: number) {
    return this.prisma.task.findMany({
      where: {
        userId,
      },
      orderBy: {
        id: 'asc',
      },
    });
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
