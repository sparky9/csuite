import type {
  TaskCreateInput,
  TaskListResponse,
  TaskUpdateInput,
  PriorityRecommendation,
  ProgressReport,
  ProgressReportInput,
} from '../types/index.js';
import {
  createTask,
  updateTask,
  listTasksForFocus,
  getPriorityRecommendations,
  markTaskCompleted,
  deleteTask,
} from '../db/tasks.js';
import { buildFocusView } from './view-builder.js';
import { buildProgressReport } from './progress-report.js';
import { Logger } from '../utils/logger.js';

export class TaskService {
  constructor(private readonly userId: string) {}

  async addTask(input: TaskCreateInput) {
    const task = await createTask(this.userId, input);

    Logger.info('Task created', {
      userId: this.userId,
      taskId: task.id,
      priority: task.priorityLevel,
    });

    return task;
  }

  async updateTask(input: TaskUpdateInput) {
    const task = await updateTask(this.userId, input);
    if (!task) {
      throw new Error('Task not found or not owned by user');
    }

    Logger.info('Task updated', {
      userId: this.userId,
      taskId: task.id,
      priority: task.priorityLevel,
    });

    return task;
  }

  async getFocusList(): Promise<TaskListResponse> {
    const tasks = await listTasksForFocus(this.userId);
    return buildFocusView(tasks);
  }

  async getPriorityRecommendations(limit?: number): Promise<PriorityRecommendation[]> {
    return getPriorityRecommendations(this.userId, limit);
  }

  async completeTask(taskId: string) {
    const result = await markTaskCompleted(this.userId, taskId);
    if (!result) {
      throw new Error('Task not found');
    }

    Logger.info('Task completed', {
      userId: this.userId,
      taskId,
    });

    return result;
  }

  async removeTask(taskId: string) {
    const deleted = await deleteTask(this.userId, taskId);
    if (!deleted) {
      throw new Error('Task not found');
    }

    Logger.info('Task deleted', {
      userId: this.userId,
      taskId,
    });

    return { status: 'success' } as const;
  }

  async getProgressReport(input: ProgressReportInput = {}): Promise<ProgressReport> {
    return buildProgressReport(this.userId, input);
  }
}
