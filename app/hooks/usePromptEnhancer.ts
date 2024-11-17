import { useState } from 'react';
import { logger } from '~/utils/logger';

export function usePromptEnhancer() {
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [promptEnhanced, setPromptEnhanced] = useState(false);

  const resetEnhancer = () => {
    setEnhancingPrompt(false);
    setPromptEnhanced(false);
  };

  const enhancePrompt = async (
    input: string,
    setInput: (value: string) => void,
    model: string,
    provider: string,
    apiKeys?: Record<string, string>
  ) => {
    setEnhancingPrompt(true);
    setPromptEnhanced(false);

    const requestBody: any = {
      message: input,
      model,
      provider,
      enhancementType: 'comprehensive', // New field for enhancement type
      context: {
        projectType: 'web',
        preferredTechnologies: [], // Will be populated from user preferences
        complexity: 'detailed'
      }
    };

    if (apiKeys) {
      requestBody.apiKeys = apiKeys;
    }

    const response = await fetch('/api/enhancer', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const reader = response.body?.getReader();
    const originalInput = input;

    if (reader) {
      const decoder = new TextDecoder();
      let _input = '';
      let _error;

      try {
        setInput('');
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          _input += decoder.decode(value);
          logger.trace('Set input', _input);
          setInput(_input);
        }
      } catch (error) {
        _error = error;
        setInput(originalInput);
      } finally {
        if (_error) {
          logger.error(_error);
        }
        setEnhancingPrompt(false);
        setPromptEnhanced(true);
        setTimeout(() => {
          setInput(_input);
        });
      }
    }
  };

  return {
    enhancingPrompt,
    promptEnhanced,
    resetEnhancer,
    enhancePrompt,
  };
} 