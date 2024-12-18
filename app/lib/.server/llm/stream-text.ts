// @ts-nocheck
// Preventing TS checks with files presented in the video for a better presentation.
import { streamText as _streamText, convertToCoreMessages } from 'ai';
import { getModel } from '~/lib/.server/llm/model';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';
import { MODEL_LIST, DEFAULT_MODEL, DEFAULT_PROVIDER, MODEL_REGEX, PROVIDER_REGEX } from '~/utils/constants';
import { cacheManager } from '../cache/cache-manager';
import { createVertexAI } from '~/lib/.server/llm/vertex-ai';

interface ToolResult<Name extends string, Args, Result> {
  toolCallId: string;
  toolName: Name;
  args: Args;
  result: Result;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolResult<string, unknown, unknown>[];
  model?: string;
}

export type Messages = Message[];

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;

function extractPropertiesFromMessage(message: Message): { model: string; provider: string; content: string } {
  // Extract model
  const modelMatch = message.content.match(MODEL_REGEX);
  const model = modelMatch ? modelMatch[1] : DEFAULT_MODEL;

  // Extract provider
  const providerMatch = message.content.match(PROVIDER_REGEX);
  const provider = providerMatch ? providerMatch[1] : DEFAULT_PROVIDER;

  // Remove model and provider lines from content
  const cleanedContent = message.content
    .replace(MODEL_REGEX, '')
    .replace(PROVIDER_REGEX, '')
    .trim();

  return { model, provider, content: cleanedContent };
}

function chunkResponse(content: string, maxChunkSize: number = 1000): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  
  // Split by newlines to preserve code block structure
  const lines = content.split('\n');
  
  for (const line of lines) {
    if ((currentChunk + line).length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

export async function* streamText(
  messages: Messages, 
  env: Env, 
  options?: StreamingOptions,
  apiKeys?: Record<string, string>
) {
  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER;

  const processedMessages = messages.map((message) => {
    if (message.role === 'user') {
      const { model, provider, content } = extractPropertiesFromMessage(message);

      if (MODEL_LIST.find((m) => m.name === model)) {
        currentModel = model;
      }

      currentProvider = provider;

      return { ...message, content };
    }

    return message;
  });

  // Check cache first
  const cachedResponse = cacheManager.get(processedMessages, currentProvider, currentModel);
  if (cachedResponse) {
    // Return cached response as a stream
    const chunks = chunkResponse(cachedResponse);
    for (const chunk of chunks) {
      yield chunk;
    }
    return;
  }

  // If not in cache, proceed with API call
  let fullResponse = '';
  const stream = await _streamText({
    model: getModel(currentProvider, currentModel, env, apiKeys),
    system: getSystemPrompt(),
    maxTokens: MAX_TOKENS,
    messages: convertToCoreMessages(processedMessages),
    ...options,
    chunkSize: 512,
    onResponse: async (response) => {
      fullResponse += response;
      if (response.length > MAX_TOKENS) {
        return chunkResponse(response);
      }
      return response;
    }
  });

  // Stream the response while collecting it
  for await (const chunk of stream) {
    yield chunk;
  }

  // Cache the full response
  cacheManager.set(processedMessages, fullResponse, currentProvider, currentModel);
}
