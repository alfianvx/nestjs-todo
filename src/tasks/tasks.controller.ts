import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from 'src/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { QueryTaskDto } from './dto/query-task.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @ApiOperation({
    summary: 'Get all users task',
  })
  @ApiResponse({ status: 200, description: 'Task list berhasil diambil' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryTaskDto) {
    return this.tasksService.findAll(user.id, query);
  }

  @ApiOperation({ summary: 'Ambil detail task berdasarkan id' })
  @ApiParam({ name: 'id', example: 1, description: 'ID task' })
  @ApiResponse({ status: 200, description: 'Detail task berhasil diambil' })
  @ApiResponse({ status: 404, description: 'Task tidak ditemukan' })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.findOne(id, user.id);
  }

  @ApiOperation({ summary: 'Buat task baru' })
  @ApiResponse({ status: 201, description: 'Task berhasil dibuat' })
  @Post()
  create(@Body() createTaskDto: CreateTaskDto, @CurrentUser() user: AuthUser) {
    return this.tasksService.create(createTaskDto, user.id);
  }

  @ApiParam({ name: 'id', example: 1, description: 'ID task' })
  @ApiResponse({ status: 200, description: 'Task berhasil diupdate' })
  @ApiResponse({ status: 404, description: 'Task tidak ditemukan' })
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTaskDto: UpdateTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.update(id, updateTaskDto, user.id);
  }

  @ApiOperation({ summary: 'Hapus task berdasarkan id' })
  @ApiParam({ name: 'id', example: 1, description: 'ID task' })
  @ApiResponse({ status: 200, description: 'Task berhasil dihapus' })
  @ApiResponse({ status: 404, description: 'Task tidak ditemukan' })
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.tasksService.remove(id, user.id);
  }
}
