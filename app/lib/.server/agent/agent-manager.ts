import type { Message } from 'ai';
import { streamText } from '../llm/stream-text';
import type { ToolResult } from '~/types/agent';

export interface AgentTask {
  id: string;
  goal: string;
  subtasks: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  result?: string;
}

export class AgentManager {
  private tasks: Map<string, AgentTask> = new Map();
  private env: Env;
  private apiKeys?: Record<string, string>;

  constructor(env: Env, apiKeys?: Record<string, string>) {
    this.env = env;
    this.apiKeys = apiKeys;
  }

  async planTask(goal: string): Promise<AgentTask> {
    const planningMessages: Message[] = [
      {
        role: 'user',
        content: `Plan the following task into subtasks: ${goal}\nRespond in a JSON array of subtasks.`
      }
    ];

    let subtasksJson = '';
    const stream = await streamText(planningMessages, this.env, {}, this.apiKeys);
    for await (const chunk of stream) {
      subtasksJson += chunk;
    }

    const subtasks = JSON.parse(subtasksJson);
    const task: AgentTask = {
      id: crypto.randomUUID(),
      goal,
      subtasks,
      status: 'pending'
    };

    this.tasks.set(task.id, task);
    return task;
  }

  async executeTask(taskId: string): Promise<AsyncGenerator<string>> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');

    task.status = 'in-progress';
    
    async function* executeSubtasks(this: AgentManager) {
      for (const subtask of task.subtasks) {
        const messages: Message[] = [
          {
            role: 'user',
            content: `Execute this subtask: ${subtask}\nContext: ${task.goal}`
          }
        ];

        const stream = await streamText(messages, this.env, {}, this.apiKeys);
        for await (const chunk of stream) {
          yield chunk;
        }
      }

      task.status = 'completed';
    }

    return executeSubtasks.call(this);
  }

  getTask(taskId: string): AgentTask | undefined {
    return this.tasks.get(taskId);
  }
} 