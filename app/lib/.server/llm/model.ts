// @ts-nocheck
// Preventing TS checks with files presented in the video for a better presentation.
import { getAPIKey, getBaseURL } from '~/lib/.server/llm/api-key';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { ollama } from 'ollama-ai-provider';
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createMistral } from '@ai-sdk/mistral';
import { HfInference } from '@huggingface/inference';
import { createVertexAI } from '~/lib/.server/llm/vertex-ai';
import { CohereClient } from 'cohere-ai';

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
  const openai = createOpenAI({
    baseURL: baseURL || 'http://localhost:1234',
    apiKey: 'not-needed', // LM Studio doesn't require an API key
  });

  return openai(model);
}

export function getXAIModel(apiKey: string, model: string) {
  const openai = createOpenAI({
    baseURL: 'https://api.x.ai/v1',
    apiKey,
  });

  return openai(model);
}

export function getHuggingFaceModel(apiKey: string, model: string) {
  const hf = new HfInference(apiKey);
  
  return {
    chat: async function*(messages: any[]) {
      // Convert messages to HF format
      const prompt = messages.map(m => 
        `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`
      ).join('\n\n') + '\n\nAssistant:';

      try {
        const response = await hf.textGeneration({
          model: model,
          inputs: prompt,
          parameters: {
            max_new_tokens: 1024,
            temperature: 0.7,
            top_p: 0.95,
            repetition_penalty: 1.1,
            stream: true
          }
        });

        // Stream the response
        for await (const chunk of response) {
          yield { content: chunk.token.text };
        }
      } catch (error) {
        console.error('HuggingFace API error:', error);
        throw error;
      }
    }
  };
}

export function getTogetherModel(apiKey: string, model: string) {
  const together = createOpenAI({
    baseURL: 'https://api.together.xyz/v1',
    apiKey,
  });

  return together(model);
}

export function getAzureOpenAIModel(apiKey: string, model: string, baseURL: string) {
  const azureOpenAI = createOpenAI({
    apiKey,
    baseURL,
    defaultQuery: {
      'api-version': '2024-02-15-preview'
    },
    defaultHeaders: {
      'api-key': apiKey
    }
  });

  return azureOpenAI(model);
}

export function getPerplexityModel(apiKey: string, model: string) {
  const perplexity = createOpenAI({
    baseURL: 'https://api.perplexity.ai',
    apiKey,
  });

  return perplexity(model);
}

export function getVertexAIModel(apiKey: string, modelName: string, projectId: string) {
  const vertexai = createVertexAI({
    project: projectId,
    location: 'us-central1',
    credentials: {
      client_email: env.VERTEX_AI_CLIENT_EMAIL,
      private_key: env.VERTEX_AI_PRIVATE_KEY,
    }
  });

  const vertexModel = vertexai.preview.getGenerativeModel({
    model: modelName,
    generation_config: {
      max_output_tokens: 2048,
      temperature: 0.7,
      top_p: 0.95,
    },
  });

  return {
    chat: async function*(messages: any[]) {
      const formattedMessages = messages.map(m => ({
        role: m.role === 'user' ? 'USER' : 'ASSISTANT',
        content: m.content
      }));

      const response = await vertexModel.generateContentStream({
        contents: formattedMessages,
      });

      for await (const chunk of response.stream) {
        if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
          yield { content: chunk.candidates[0].content.parts[0].text };
        }
      }
    }
  };
}

export function getCohereModel(apiKey: string, model: string) {
  const cohere = new CohereClient({ token: apiKey });

  return {
    chat: async function*(messages: any[]) {
      const formattedMessages = messages.map(m => ({
        role: m.role === 'user' ? 'USER' : 'ASSISTANT',
        message: m.content
      }));

      try {
        const stream = await cohere.chatStream({
          model,
          message: formattedMessages[formattedMessages.length - 1].message,
          chatHistory: formattedMessages.slice(0, -1),
          temperature: 0.7,
        });

        for await (const chunk of stream) {
          if (chunk.eventType === 'text-generation') {
            yield { content: chunk.text };
          }
        }
      } catch (error) {
        console.error('Cohere API error:', error);
        throw error;
      }
    }
  };
}

export async function getModel(provider: string, model: string, env: Env, apiKeys?: Record<string, string>) {
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
          case 'HuggingFace':
            return getHuggingFaceModel(apiKey, model);
          case 'Together':
            return getTogetherModel(apiKey, model);
          case 'AzureOpenAI':
            return getAzureOpenAIModel(apiKey, model, baseURL);
          case 'Perplexity':
            return getPerplexityModel(apiKey, model);
          case 'VertexAI':
            return getVertexAIModel(apiKey, model, env.VERTEX_AI_PROJECT_ID);
          case 'Cohere':
            return getCohereModel(apiKey, model);
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
