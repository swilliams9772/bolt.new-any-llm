import { ActionFunctionArgs } from '@remix-run/node';
import { streamText } from '~/lib/.server/llm/stream-text';
import { stripIndents } from 'common-tags';
import { TransformStream } from '@remix-run/web-streams';
import { parseStreamPart } from 'ai';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function enhancerAction({ context, request }: ActionFunctionArgs) {
  const { 
    message, 
    model, 
    provider, 
    apiKeys,
    enhancementType = 'comprehensive',
    context: promptContext = {}
  } = await request.json<{ 
    message: string;
    model: string;
    provider: string;
    apiKeys?: Record<string, string>;
    enhancementType?: 'basic' | 'comprehensive';
    context?: {
      projectType?: string;
      preferredTechnologies?: string[];
      complexity?: 'simple' | 'detailed';
    };
  }>();

  if (!model || typeof model !== 'string') {
    throw new Response('Invalid or missing model', {
      status: 400,
      statusText: 'Bad Request'
    });
  }

  if (!provider || typeof provider !== 'string') {
    throw new Response('Invalid or missing provider', {
      status: 400,
      statusText: 'Bad Request'
    });
  }

  try {
    const enhancementPrompt = getEnhancementPrompt(message, enhancementType, promptContext);
    
    const result = await streamText(
      [
        {
          role: 'user',
          content: enhancementPrompt
        },
      ],
      context.cloudflare.env,
      undefined,
      apiKeys
    );

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk);
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          try {
            const parsed = parseStreamPart(line);
            if (parsed.type === 'text') {
              controller.enqueue(encoder.encode(parsed.value));
            }
          } catch (e) {
            console.warn('Failed to parse stream part:', line);
          }
        }
      },
    });

    const transformedStream = result.toAIStream().pipeThrough(transformStream);
    return new Response(transformedStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Enhancer error:', error);
    throw new Response('Enhancement failed', { status: 500 });
  }
}

function getEnhancementPrompt(
  message: string, 
  type: string,
  context: any
): string {
  const basePrompt = stripIndents`
    As an expert developer, enhance the following prompt to create a more detailed and actionable development request.
    Consider:
    1. Technical specifications and best practices
    2. Performance considerations
    3. Accessibility requirements
    4. Security considerations
    5. Testing requirements
    6. Project structure and architecture
    7. Error handling and edge cases
    
    Project Context:
    - Type: ${context.projectType || 'web'}
    - Preferred Technologies: ${context.preferredTechnologies?.join(', ') || 'any'}
    - Desired Complexity: ${context.complexity || 'detailed'}

    Original Prompt:
    "${message}"

    Provide an enhanced version that maintains the original intent while adding necessary technical details and considerations.
    IMPORTANT: Only respond with the enhanced prompt, no explanations or additional text.
  `;

  if (type === 'comprehensive') {
    return basePrompt + stripIndents`
      Also consider:
      8. Scalability considerations
      9. Monitoring and logging requirements
      10. Documentation needs
      11. Deployment strategy
      12. Performance metrics and targets
      13. Browser/device compatibility
      14. SEO requirements
    `;
  }

  return basePrompt;
}

export { enhancerAction as action };
