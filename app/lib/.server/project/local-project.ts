import { readdir, readFile } from 'fs/promises';
import { join, relative } from 'path';
import { isText } from 'istextorbinary';
import type { ProjectFile } from '~/types/file';

export class LocalProjectManager {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async loadProject(): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];
    await this.scanDirectory(this.projectPath, files);
    return files;
  }

  private async scanDirectory(dirPath: string, files: ProjectFile[]): Promise<void> {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const relativePath = relative(this.projectPath, fullPath);

      // Skip node_modules and hidden files/directories
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath, files);
      } else {
        try {
          const content = await readFile(fullPath);
          if (isText(entry.name, content)) {
            files.push({
              path: relativePath,
              content: content.toString(),
              type: 'file'
            });
          }
        } catch (error) {
          console.error(`Error reading file ${fullPath}:`, error);
        }
      }
    }
  }
} 