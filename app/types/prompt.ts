export interface PromptImage {
  url: string;
  alt?: string;
  type: 'url' | 'file';
  data?: string; // Base64 data for file uploads
}

export interface PromptWithImages {
  text: string;
  images?: PromptImage[];
} 