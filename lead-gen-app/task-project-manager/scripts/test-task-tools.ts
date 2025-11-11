import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { TaskService } from '../src/services/task-service.js';
import { query, closePool } from '../src/db/client.js';

async function runSmokeTest() {
  const userId = randomUUID();
  const service = new TaskService(userId);

  console.log('🧪 Starting Task Manager smoke test');
  console.log(`Using test user: ${userId}`);

  try {
    await query('DELETE FROM task_items WHERE user_id = $1', [userId]);

    const created = await service.addTask({
      title: 'Smoke Test Task',
      description: 'Verify TaskService flows end-to-end',
      dueDate: new Date(Date.now() + 86_400_000).toISOString(),
      impact: 4,
      effort: 2,
      confidence: 3,
      estimatedMinutes: 45,
      tags: ['smoke', 'automation'],
    });

    console.log('✅ addTask:', {
      id: created.id,
      priorityLevel: created.priorityLevel,
      priorityScore: created.priorityScore,
      status: created.status,
    });

    const updated = await service.updateTask({
      taskId: created.id,
      status: 'in_progress',
      estimatedMinutes: 60,
      blockedReason: null,
    });

    console.log('✅ updateTask:', {
      status: updated.status,
      estimate: updated.estimatedMinutes,
      priorityLevel: updated.priorityLevel,
    });

    const focus = await service.getFocusList();
    console.log('✅ getFocusList summary:', focus.summary);
    console.log('   Sections:', focus.sections.map((section) => ({
      label: section.label,
      count: section.items.length,
    })));

    const recommendations = await service.getPriorityRecommendations(5);
    console.log('✅ getPriorityRecommendations:', {
      count: recommendations.length,
      top: recommendations[0],
    });

    const completed = await service.completeTask(created.id);
    console.log('✅ completeTask:', {
      status: completed.status,
      completedAt: completed.completedAt,
    });

    const report = await service.getProgressReport({ timeframe: 'day' });
    console.log('✅ getProgressReport:', {
      period: report.periodLabel,
      metrics: report.metrics.map((metric) => ({
        label: metric.label,
        value: metric.value,
      })),
      completed: report.completed.length,
      upcoming: report.upcoming.length,
    });

    await service.removeTask(created.id);
    console.log('✅ removeTask: task deleted');

    await query('DELETE FROM task_items WHERE user_id = $1', [userId]);

    console.log('🎉 Smoke test completed successfully');
  } catch (error) {
    console.error('❌ Smoke test failed:', error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

runSmokeTest().catch((error) => {
  console.error('❌ Smoke test crashed:', error);
  closePool().catch(() => {
    /* ignore */
  });
  process.exit(1);
});
