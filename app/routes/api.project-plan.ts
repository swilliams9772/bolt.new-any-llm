import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { createVertexAI } from '~/lib/.server/llm/vertex-ai';
import { ProjectPlanner } from '~/lib/.server/planner/project-planner';

export async function action({ request, context }: ActionFunctionArgs) {
  const formData = await request.formData();
  const prompt = formData.get('prompt')?.toString();
  const existingPlan = formData.get('existingPlan')?.toString();
  const action = formData.get('action')?.toString();
  const apiKeys = JSON.parse(formData.get('apiKeys')?.toString() || '{}');

  if (!prompt) {
    throw new Response('Prompt is required', { status: 400 });
  }

  const planner = new ProjectPlanner(context.env, apiKeys);

  try {
    let stream;
    if (action === 'update' && existingPlan) {
      stream = await planner.updateProjectPlan(existingPlan, prompt);
    } else {
      stream = await planner.generateProjectPlan(prompt);
    }

    return new Response(stream as any, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Project planning error:', error);
    throw new Response('Failed to generate project plan', { status: 500 });
  }
} 