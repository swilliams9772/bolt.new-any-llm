export interface Dirent {
  type: 'file' | 'folder';
  content?: string;
  isBinary?: boolean;
}

export type FileMap = Record<string, Dirent>;

export interface FileLoadResult {
  files: FileMap;
  skippedFiles?: string[];
} 