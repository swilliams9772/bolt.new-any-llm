import { json } from '@remix-run/node';
import type { ActionFunction } from '@remix-run/node';
import { AgentManager } from '~/lib/.server/agent/agent-manager';

export const action: ActionFunction = async ({ request, context }) => {
  const formData = await request.formData();
  const action = formData.get('action');
  const goal = formData.get('goal')?.toString();
  const taskId = formData.get('taskId')?.toString();
  const apiKeys = JSON.parse(formData.get('apiKeys')?.toString() || '{}');

  const agentManager = new AgentManager(context.env, apiKeys);

  switch (action) {
    case 'plan':
      if (!goal) throw new Error('Goal is required');
      const task = await agentManager.planTask(goal);
      return json(task);

    case 'execute':
      if (!taskId) throw new Error('Task ID is required');
      const stream = await agentManager.executeTask(taskId);
      return new Response(stream as any, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });

    case 'status':
      if (!taskId) throw new Error('Task ID is required');
      const status = agentManager.getTask(taskId);
      return json(status);

    default:
      throw new Error('Invalid action');
  }
}; 