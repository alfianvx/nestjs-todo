import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  logger = new Logger(AdminService.name);
  constructor(private readonly prisma: PrismaService) {}

  async findAllUser() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        password: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    this.logger.log(`Found ${users.length} users`);

    return users;
  }

  async findAllTasks() {
    const tasks = await this.prisma.task.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    this.logger.log(`Found ${tasks.length} tasks`);

    return tasks;
  }
}
