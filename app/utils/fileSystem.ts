import type { FileMap, FileLoadResult } from '~/lib/stores/files';

// Constants for file handling
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB
const DEFAULT_EXCLUDED_PATTERNS = [
  /node_modules/,
  /.git/,
  /dist/,
  /build/,
  /.next/,
  /.cache/,
  /.DS_Store/,
];

export interface FileLoadingProgress {
  totalFiles: number;
  processedFiles: number;
  totalSize: number;
  skippedFiles: string[];
}

export interface ReadDirectoryOptions {
  maxFileSize?: number;
  maxTotalSize?: number;
  excludePatterns?: RegExp[];
  onProgress?: (progress: FileLoadingProgress) => void;
}

export async function readFilesFromDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  basePath: string = '/home/project',
  options: ReadDirectoryOptions = {}
): Promise<FileLoadResult> {
  const {
    maxFileSize = MAX_FILE_SIZE,
    maxTotalSize = MAX_TOTAL_SIZE,
    excludePatterns = DEFAULT_EXCLUDED_PATTERNS,
    onProgress
  } = options;

  const files: FileMap = {};
  const skippedFiles: string[] = [];
  let totalSize = 0;
  const progress: FileLoadingProgress = {
    totalFiles: 0,
    processedFiles: 0,
    totalSize: 0,
    skippedFiles
  };

  // First pass to count total files
  async function countFiles(handle: FileSystemDirectoryHandle): Promise<number> {
    let count = 0;
    for await (const entry of handle.values()) {
      if (entry.kind === 'file') {
        count++;
      } else if (entry.kind === 'directory') {
        if (!isExcluded(entry.name, excludePatterns)) {
          count += await countFiles(entry);
        }
      }
    }
    return count;
  }

  progress.totalFiles = await countFiles(directoryHandle);
  
  async function processEntry(handle: FileSystemHandle, path: string) {
    if (isExcluded(path, excludePatterns)) {
      return;
    }

    if (handle.kind === 'file') {
      const file = await (handle as FileSystemFileHandle).getFile();
      progress.processedFiles++;
      
      // Check file size
      if (file.size > maxFileSize) {
        skippedFiles.push(`${path} (size: ${formatFileSize(file.size)})`);
        onProgress?.(progress);
        return;
      }

      // Check total size
      if (totalSize + file.size > maxTotalSize) {
        skippedFiles.push(`${path} (total size limit exceeded)`);
        onProgress?.(progress);
        return;
      }

      // Check file type
      if (!isAllowedFileType(file)) {
        skippedFiles.push(`${path} (unsupported type: ${file.type})`);
        onProgress?.(progress);
        return;
      }

      try {
        const content = await file.text();
        totalSize += file.size;
        progress.totalSize = totalSize;
        
        files[path] = {
          type: 'file',
          content,
          isBinary: false
        };
        
        onProgress?.(progress);
      } catch (error) {
        skippedFiles.push(`${path} (error reading file)`);
        onProgress?.(progress);
        console.warn(`Skipping file ${path} - ${error.message}`);
      }
    } else if (handle.kind === 'directory') {
      const dirHandle = handle as FileSystemDirectoryHandle;
      for await (const entry of dirHandle.values()) {
        await processEntry(entry, `${path}/${entry.name}`);
      }
    }
  }

  for await (const entry of directoryHandle.values()) {
    await processEntry(entry, `${basePath}/${entry.name}`);
  }

  return { files, skippedFiles };
}

function isExcluded(path: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(path));
}

function isAllowedFileType(file: File): boolean {
  // If no type is specified, check the extension
  if (!file.type) {
    const allowedExtensions = [
      '.txt', '.js', '.jsx', '.ts', '.tsx', '.json', '.html', 
      '.css', '.scss', '.md', '.yml', '.yaml', '.xml', '.svg',
      '.env', '.gitignore', '.py', '.rb', '.php', '.java',
      '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.swift'
    ];
    return allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  }

  // Check MIME types
  const allowedMimeTypes = [
    'text/',
    'application/json',
    'application/javascript',
    'application/typescript',
    'application/xml',
    'application/x-yaml',
  ];

  return allowedMimeTypes.some(type => file.type.startsWith(type));
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)}${units[unitIndex]}`;
} 