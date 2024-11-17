import { useState, useEffect, useCallback } from 'react';
import { IconButton } from '~/components/ui/IconButton';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  isListening?: boolean;
  disabled?: boolean;
}

export function VoiceInput({ onTranscript, isListening: externalIsListening, disabled }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');

        if (event.results[0].isFinal) {
          onTranscript(transcript);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognition);
    }

    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, [onTranscript]);

  const toggleListening = useCallback(() => {
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
    }
  }, [recognition, isListening]);

  // Sync with external listening state if provided
  useEffect(() => {
    if (typeof externalIsListening !== 'undefined' && externalIsListening !== isListening) {
      toggleListening();
    }
  }, [externalIsListening, isListening, toggleListening]);

  if (!recognition) {
    return null; // Hide if speech recognition is not supported
  }

  return (
    <IconButton
      icon={isListening ? "i-ph:microphone-fill" : "i-ph:microphone"}
      onClick={toggleListening}
      disabled={disabled}
      title={isListening ? "Stop listening" : "Start voice input"}
      className={`transition-colors ${
        isListening 
          ? 'text-red-500 hover:text-red-600' 
          : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary'
      }`}
    />
  );
} 