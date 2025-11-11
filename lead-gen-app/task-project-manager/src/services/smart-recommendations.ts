import Anthropic from '@anthropic-ai/sdk';
import type { TaskListItem, PriorityRecommendation } from '../types/index.js';
import { Logger } from '../utils/logger.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

interface ContextualRecommendation {
  taskId: string;
  title: string;
  reasoning: string;
  suggestedNextSteps: string[];
  estimatedFocusTime: string;
  blockerAnalysis?: string;
}

export interface SmartRecommendationResult {
  topRecommendations: ContextualRecommendation[];
  workloadInsight: string;
  focusStrategy: string;
}

/**
 * Generate intelligent, context-aware task recommendations using Claude
 * Goes beyond simple priority scoring to understand workflow patterns
 */
export async function generateSmartRecommendations(
  tasks: TaskListItem[],
  userContext?: {
    currentTime?: 'morning' | 'afternoon' | 'evening';
    energy?: 'high' | 'medium' | 'low';
    availableTime?: number; // minutes
  }
): Promise<SmartRecommendationResult> {
  if (!tasks.length) {
    return {
      topRecommendations: [],
      workloadInsight: 'No active tasks found.',
      focusStrategy: 'Consider adding tasks to get started.',
    };
  }

  try {
    const taskSummaries = tasks.slice(0, 20).map((task) => ({
      id: task.taskId,
      title: task.title,
      priority: task.priorityLevel,
      score: task.priorityScore,
      status: task.status,
      dueDate: task.dueDate,
      project: task.projectName,
      blocked: task.blockedReason,
      tags: task.tags,
      estimate: task.estimateMinutes,
    }));

    const contextInfo = userContext
      ? `\nCurrent context:
- Time of day: ${userContext.currentTime || 'unknown'}
- Energy level: ${userContext.energy || 'unknown'}
- Available time: ${userContext.availableTime ? `${userContext.availableTime} minutes` : 'unknown'}`
      : '';

    const systemPrompt = `You are a productivity advisor analyzing a solopreneur's task list.
Your goal is to recommend which tasks to tackle next, considering:
- Priority scores and due dates
- Task dependencies and blockers
- Energy levels and time of day
- Quick wins vs deep work
- Context switching costs

Provide practical, actionable recommendations that help the user make progress.`;

    const userPrompt = `Analyze these tasks and recommend what to work on next:

${JSON.stringify(taskSummaries, null, 2)}
${contextInfo}

Total tasks: ${tasks.length}
Urgent: ${tasks.filter((t) => t.priorityLevel === 'urgent').length}
High priority: ${tasks.filter((t) => t.priorityLevel === 'high').length}
Blocked: ${tasks.filter((t) => t.blockedReason).length}

Provide:
1. Top 3-5 task recommendations with specific reasoning
2. Overall workload insight (realistic assessment)
3. Focus strategy for the day/session

Format as JSON:
{
  "recommendations": [
    {
      "taskId": "...",
      "reasoning": "Why this task now (2-3 sentences)",
      "nextSteps": ["Step 1", "Step 2"],
      "focusTime": "estimated time needed",
      "blockerAnalysis": "if blocked, what to do"
    }
  ],
  "workloadInsight": "honest assessment of their workload",
  "focusStrategy": "recommended approach for the session"
}`;

    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      temperature: 0.4,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from Claude response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const recommendations: ContextualRecommendation[] = (parsed.recommendations || []).map((rec: any) => {
      const task = tasks.find((t) => t.taskId === rec.taskId) || tasks[0];
      return {
        taskId: rec.taskId || task.taskId,
        title: task.title,
        reasoning: rec.reasoning || 'High priority task',
        suggestedNextSteps: Array.isArray(rec.nextSteps) ? rec.nextSteps : [],
        estimatedFocusTime: rec.focusTime || 'Unknown',
        blockerAnalysis: rec.blockerAnalysis,
      };
    });

    return {
      topRecommendations: recommendations,
      workloadInsight: parsed.workloadInsight || 'Review your task list for better insights.',
      focusStrategy: parsed.focusStrategy || 'Focus on high-priority tasks first.',
    };
  } catch (error) {
    Logger.error('Smart recommendations generation failed', { error });

    // Fallback to basic recommendations
    const top3 = tasks.slice(0, 3);
    return {
      topRecommendations: top3.map((task) => ({
        taskId: task.taskId,
        title: task.title,
        reasoning: `Priority: ${task.priorityLevel} (score: ${task.priorityScore})`,
        suggestedNextSteps: ['Review task details', 'Start working'],
        estimatedFocusTime: task.estimateMinutes ? `${task.estimateMinutes} minutes` : 'Unknown',
      })),
      workloadInsight: `${tasks.length} tasks in your queue. ${tasks.filter((t) => t.priorityLevel === 'urgent').length} are urgent.`,
      focusStrategy: 'Start with highest priority tasks.',
    };
  }
}

/**
 * Analyze task for potential breakdown into subtasks
 */
export async function suggestTaskBreakdown(task: TaskListItem): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return [];
  }

  try {
    const prompt = `Task: "${task.title}"

This task seems complex. Break it down into 3-5 actionable subtasks that can be completed independently.
Return as a JSON array of strings: ["Subtask 1", "Subtask 2", ...]`;

    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
      max_tokens: 512,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      return [];
    }

    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const subtasks = JSON.parse(jsonMatch[0]);
    return Array.isArray(subtasks) ? subtasks : [];
  } catch (error) {
    Logger.error('Task breakdown suggestion failed', { error, taskId: task.taskId });
    return [];
  }
}

/**
 * Detect patterns in completed tasks to suggest optimizations
 */
export async function analyzeCompletionPatterns(
  completedTasks: TaskListItem[]
): Promise<string> {
  if (!completedTasks.length || !process.env.ANTHROPIC_API_KEY) {
    return 'Not enough data to analyze patterns yet. Keep completing tasks!';
  }

  try {
    const taskData = completedTasks.slice(0, 50).map((task) => ({
      title: task.title,
      priority: task.priorityLevel,
      estimate: task.estimateMinutes,
      completedAt: task.completedAt,
      tags: task.tags,
    }));

    const prompt = `Analyze these recently completed tasks and identify patterns:

${JSON.stringify(taskData, null, 2)}

Provide insights about:
- What types of tasks get done most?
- Any recurring themes or categories?
- Velocity trends (are they completing more/less)?
- Suggestions for improving workflow

Keep it concise (3-4 sentences).`;

    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
      max_tokens: 512,
      temperature: 0.5,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type === 'text') {
      return content.text.trim();
    }

    return 'Unable to analyze patterns at this time.';
  } catch (error) {
    Logger.error('Completion pattern analysis failed', { error });
    return 'Pattern analysis unavailable. Continue tracking your tasks.';
  }
}
