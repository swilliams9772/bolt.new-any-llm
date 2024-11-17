declare module 'react-hot-toast' {
  export interface Toast {
    id: string;
    visible: boolean;
    message: string;
  }

  export interface ToastOptions {
    id?: string;
    duration?: number;
    onClick?: () => void;
  }

  export const toast: {
    (message: string, opts?: ToastOptions): string;
    success: (message: string, opts?: ToastOptions) => string;
    error: (message: string, opts?: ToastOptions) => string;
    loading: (message: string, opts?: ToastOptions) => string;
    warning: (message: string, opts?: ToastOptions) => string;
  };
} 