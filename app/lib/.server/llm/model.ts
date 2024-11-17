// @ts-nocheck
// Preventing TS checks with files presented in the video for a better presentation.
import { getAPIKey, getBaseURL } from '~/lib/.server/llm/api-key';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { ollama } from 'ollama-ai-provider';
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createMistral } from '@ai-sdk/mistral';

export function getAnthropicModel(apiKey: string, model: string) {
  const anthropic = createAnthropic({
    apiKey,
  });

  return anthropic(model);
}
export function getOpenAILikeModel(baseURL:string,apiKey: string, model: string) {
  const openai = createOpenAI({
    baseURL,
    apiKey,
  });

  return openai(model);
}
export function getOpenAIModel(apiKey: string, model: string) {
  const openai = createOpenAI({
    apiKey,
  });

  return openai(model);
}

export function getMistralModel(apiKey: string, model: string) {
  const mistral = createMistral({
    apiKey
  });

  return mistral(model);
}

export function getGoogleModel(apiKey: string, model: string) {
  const google = createGoogleGenerativeAI({
    apiKey,
  });

  return google(model);
}

export function getGroqModel(apiKey: string, model: string) {
  const openai = createOpenAI({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey,
  });

  return openai(model);
}

export function getOllamaModel(baseURL: string, model: string) {
  let Ollama = ollama(model, {
    numCtx: 32768,
  });

  Ollama.config.baseURL = `${baseURL}/api`;
  return Ollama;
}

export function getDeepseekModel(apiKey: string, model: string){
  const openai = createOpenAI({
    baseURL: 'https://api.deepseek.com/beta',
    apiKey,
  });

  return openai(model);
}

export function getOpenRouterModel(apiKey: string, model: string) {
  const openRouter = createOpenRouter({
    apiKey
  });

  return openRouter.chat(model);
}

export function getLMStudioModel(baseURL: string, model: string) {
  const lmstudio = createOpenAI({
    baseUrl: `${baseURL}/v1`,
    apiKey: "",
  });

  return lmstudio(model);
}

export function getXAIModel(apiKey: string, model: string) {
  const openai = createOpenAI({
    baseURL: 'https://api.x.ai/v1',
    apiKey,
  });

  return openai(model);
}
export function getModel(provider: string, model: string, env: Env, apiKeys?: Record<string, string>) {
  const maxRetries = 3;
  let retryCount = 0;

  const initializeModel = async () => {
    try {
      const apiKey = getAPIKey(env, provider, apiKeys);
      const baseURL = getBaseURL(env, provider);

      // Add initialization check
      const modelInstance = await (async () => {
        switch (provider) {
          case 'Anthropic':
            return getAnthropicModel(apiKey, model);
          case 'OpenAI':
            return getOpenAIModel(apiKey, model);
          case 'Groq':
            return getGroqModel(apiKey, model);
          case 'OpenRouter':
            return getOpenRouterModel(apiKey, model);
          case 'Google':
            return getGoogleModel(apiKey, model);
          case 'OpenAILike':
            return getOpenAILikeModel(baseURL,apiKey, model);
          case 'Deepseek':
            return getDeepseekModel(apiKey, model);
          case 'Mistral':
            return  getMistralModel(apiKey, model);
          case 'LMStudio':
            return getLMStudioModel(baseURL, model);
          case 'xAI':
            return getXAIModel(apiKey, model);
          default:
            if (provider === 'Ollama') {
              // Special handling for Ollama models
              return getOllamaModel(baseURL, model);
            }
            throw new Error(`Unsupported provider: ${provider}`);
        }
      })();

      // Verify model is properly initialized
      if (!modelInstance) {
        throw new Error('Model initialization failed');
      }

      return modelInstance;
    } catch (error) {
      if (retryCount < maxRetries) {
        retryCount++;
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        return initializeModel();
      }
      throw error;
    }
  };

  return initializeModel();
}
