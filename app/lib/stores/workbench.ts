import { atom, map, type MapStore, type ReadableAtom, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import { ActionRunner } from '~/lib/runtime/action-runner';
import type { ActionCallbackData, ArtifactCallbackData } from '~/lib/runtime/message-parser';
import { webcontainer } from '~/lib/webcontainer';
import type { ITerminal } from '~/types/terminal';
import { unreachable } from '~/utils/unreachable';
import { EditorStore } from './editor';
import { FilesStore, type FileMap } from './files';
import { PreviewsStore } from './previews';
import { TerminalStore } from './terminal';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";
import * as nodePath from 'node:path';
import type { WebContainerProcess } from '@webcontainer/api';
import { computeFileModifications } from './files';
import { readFilesFromDirectory } from '~/utils/fileSystem';
import { toast } from 'react-hot-toast';

export interface ArtifactState {
  id: string;
  title: string;
  closed: boolean;
  runner: ActionRunner;
}

export type ArtifactUpdateState = Pick<ArtifactState, 'title' | 'closed'>;

type Artifacts = MapStore<Record<string, ArtifactState>>;

export type WorkbenchViewType = 'code' | 'preview';

export interface LoadProjectOptions {
  maxFileSize?: number;
  maxTotalSize?: number;
  excludePatterns?: RegExp[];
}

export class WorkbenchStore {
  #previewsStore = new PreviewsStore(webcontainer);
  #filesStore = new FilesStore(webcontainer);
  #editorStore = new EditorStore(this.#filesStore);
  #terminalStore = new TerminalStore(webcontainer);

  artifacts: Artifacts = import.meta.hot?.data.artifacts ?? map({});

  showWorkbench: WritableAtom<boolean> = import.meta.hot?.data.showWorkbench ?? atom(false);
  currentView: WritableAtom<WorkbenchViewType> = import.meta.hot?.data.currentView ?? atom('code');
  unsavedFiles: WritableAtom<Set<string>> = import.meta.hot?.data.unsavedFiles ?? atom(new Set<string>());
  modifiedFiles = new Set<string>();
  artifactIdList: string[] = [];
  #boltTerminal: { terminal: ITerminal; process: WebContainerProcess } | undefined;
  #pendingFileChanges: Map<string, string> = new Map();
  #saveDebounceTimeout: number | undefined;

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.artifacts = this.artifacts;
      import.meta.hot.data.unsavedFiles = this.unsavedFiles;
      import.meta.hot.data.showWorkbench = this.showWorkbench;
      import.meta.hot.data.currentView = this.currentView;
    }
  }

  get previews() {
    return this.#previewsStore.previews;
  }

  get files() {
    return this.#filesStore.files;
  }

  get currentDocument(): ReadableAtom<EditorDocument | undefined> {
    return this.#editorStore.currentDocument;
  }

  get selectedFile(): ReadableAtom<string | undefined> {
    return this.#editorStore.selectedFile;
  }

  get firstArtifact(): ArtifactState | undefined {
    return this.#getArtifact(this.artifactIdList[0]);
  }

  get filesCount(): number {
    return this.#filesStore.filesCount;
  }

  get showTerminal() {
    return this.#terminalStore.showTerminal;
  }
  get boltTerminal() {
    return this.#terminalStore.boltTerminal;
  }

  toggleTerminal(value?: boolean) {
    this.#terminalStore.toggleTerminal(value);
  }

  attachTerminal(terminal: ITerminal) {
    this.#terminalStore.attachTerminal(terminal);
  }
  attachBoltTerminal(terminal: ITerminal) {

    this.#terminalStore.attachBoltTerminal(terminal);
  }

  onTerminalResize(cols: number, rows: number) {
    this.#terminalStore.onTerminalResize(cols, rows);
  }

  setDocuments(files: FileMap) {
    this.#editorStore.setDocuments(files);

    if (this.#filesStore.filesCount > 0 && this.currentDocument.get() === undefined) {
      // we find the first file and select it
      for (const [filePath, dirent] of Object.entries(files)) {
        if (dirent?.type === 'file') {
          this.setSelectedFile(filePath);
          break;
        }
      }
    }
  }

  setShowWorkbench(show: boolean) {
    this.showWorkbench.set(show);
  }

  setCurrentDocumentContent(newContent: string) {
    const filePath = this.currentDocument.get()?.filePath;

    if (!filePath) {
      return;
    }

    const originalContent = this.#filesStore.getFile(filePath)?.content;
    const unsavedChanges = originalContent !== undefined && originalContent !== newContent;

    this.#editorStore.updateFile(filePath, newContent);

    const currentDocument = this.currentDocument.get();

    if (currentDocument) {
      const previousUnsavedFiles = this.unsavedFiles.get();

      if (unsavedChanges && previousUnsavedFiles.has(currentDocument.filePath)) {
        return;
      }

      const newUnsavedFiles = new Set(previousUnsavedFiles);

      if (unsavedChanges) {
        newUnsavedFiles.add(currentDocument.filePath);
        this.#queueFileChange(currentDocument.filePath, newContent);
      } else {
        newUnsavedFiles.delete(currentDocument.filePath);
      }

      this.unsavedFiles.set(newUnsavedFiles);
    }
  }

  #queueFileChange(filePath: string, content: string) {
    this.#pendingFileChanges.set(filePath, content);

    if (this.#saveDebounceTimeout) {
      window.clearTimeout(this.#saveDebounceTimeout);
    }

    this.#saveDebounceTimeout = window.setTimeout(() => {
      this.#processPendingChanges();
    }, 1000);
  }

  async #processPendingChanges() {
    if (this.#pendingFileChanges.size === 0) {
      return;
    }

    // Compute diffs for all pending changes at once
    const currentFiles = this.files.get();
    const modifications = computeFileModifications(
      currentFiles,
      this.#pendingFileChanges
    );

    // Only process files that have meaningful changes
    if (modifications) {
      const changedFiles = Object.keys(modifications);
      for (const filePath of changedFiles) {
        const content = this.#pendingFileChanges.get(filePath);
        if (content !== undefined) {
          await this.saveFile(filePath);
        }
      }
    }

    this.#pendingFileChanges.clear();
  }

  setCurrentDocumentScrollPosition(position: ScrollPosition) {
    const editorDocument = this.currentDocument.get();

    if (!editorDocument) {
      return;
    }

    const { filePath } = editorDocument;

    this.#editorStore.updateScrollPosition(filePath, position);
  }

  setSelectedFile(filePath: string | undefined) {
    this.#editorStore.setSelectedFile(filePath);
  }

  async saveFile(filePath: string) {
    const documents = this.#editorStore.documents.get();
    const document = documents[filePath];

    if (document === undefined) {
      return;
    }

    await this.#filesStore.saveFile(filePath, document.value);

    const newUnsavedFiles = new Set(this.unsavedFiles.get());
    newUnsavedFiles.delete(filePath);

    this.unsavedFiles.set(newUnsavedFiles);
  }

  async saveCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    await this.saveFile(currentDocument.filePath);
  }

  resetCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    const { filePath } = currentDocument;
    const file = this.#filesStore.getFile(filePath);

    if (!file) {
      return;
    }

    this.setCurrentDocumentContent(file.content);
  }

  async saveAllFiles() {
    for (const filePath of this.unsavedFiles.get()) {
      await this.saveFile(filePath);
    }
  }

  getFileModifcations() {
    return this.#filesStore.getFileModifications();
  }

  resetAllFileModifications() {
    this.#filesStore.resetFileModifications();
  }

  abortAllActions() {
    // TODO: what do we wanna do and how do we wanna recover from this?
  }

  addArtifact({ messageId, title, id }: ArtifactCallbackData) {
    const artifact = this.#getArtifact(messageId);

    if (artifact) {
      return;
    }

    if (!this.artifactIdList.includes(messageId)) {
      this.artifactIdList.push(messageId);
    }

    this.artifacts.setKey(messageId, {
      id,
      title,
      closed: false,
      runner: new ActionRunner(webcontainer, () => this.boltTerminal),
    });
  }

  updateArtifact({ messageId }: ArtifactCallbackData, state: Partial<ArtifactUpdateState>) {
    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      return;
    }

    this.artifacts.setKey(messageId, { ...artifact, ...state });
  }

  async addAction(data: ActionCallbackData) {
    const { messageId } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    artifact.runner.addAction(data);
  }

  async runAction(data: ActionCallbackData, isStreaming: boolean = false) {
    const { messageId } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable('Artifact not found');
    }
    if (data.action.type === 'file') {
      let wc = await webcontainer
      const fullPath = nodePath.join(wc.workdir, data.action.filePath);
      if (this.selectedFile.value !== fullPath) {
        this.setSelectedFile(fullPath);
      }
      if (this.currentView.value !== 'code') {
        this.currentView.set('code');
      }
      const doc = this.#editorStore.documents.get()[fullPath];
      if (!doc) {
        await artifact.runner.runAction(data, isStreaming);
      }

      this.#editorStore.updateFile(fullPath, data.action.content);

      if (!isStreaming) {
        this.resetCurrentDocument();
        await artifact.runner.runAction(data);
      }
    } else {
      artifact.runner.runAction(data);
    }
  }

  #getArtifact(id: string) {
    const artifacts = this.artifacts.get();
    return artifacts[id];
  }

  async downloadZip() {
    const zip = new JSZip();
    const files = this.files.get();

    for (const [filePath, dirent] of Object.entries(files)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        // remove '/home/project/' from the beginning of the path
        const relativePath = filePath.replace(/^\/home\/project\//, '');

        // split the path into segments
        const pathSegments = relativePath.split('/');

        // if there's more than one segment, we need to create folders
        if (pathSegments.length > 1) {
          let currentFolder = zip;

          for (let i = 0; i < pathSegments.length - 1; i++) {
            currentFolder = currentFolder.folder(pathSegments[i])!;
          }
          currentFolder.file(pathSegments[pathSegments.length - 1], dirent.content);
        } else {
          // if there's only one segment, it's a file in the root
          zip.file(relativePath, dirent.content);
        }
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'project.zip');
  }

  async syncFiles(targetHandle: FileSystemDirectoryHandle) {
    const files = this.files.get();
    const syncedFiles = [];

    for (const [filePath, dirent] of Object.entries(files)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        const relativePath = filePath.replace(/^\/home\/project\//, '');
        const pathSegments = relativePath.split('/');
        let currentHandle = targetHandle;

        for (let i = 0; i < pathSegments.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(pathSegments[i], { create: true });
        }

        // create or get the file
        const fileHandle = await currentHandle.getFileHandle(pathSegments[pathSegments.length - 1], { create: true });

        // write the file content
        const writable = await fileHandle.createWritable();
        await writable.write(dirent.content);
        await writable.close();

        syncedFiles.push(relativePath);
      }
    }

    return syncedFiles;
  }

  async pushToGitHub(repoName: string, githubUsername: string, ghToken: string) {
    try {
      const octokit = new Octokit({ auth: ghToken });
      
      // First create a fork of the original repo
      try {
        await octokit.repos.createFork({
          owner: 'coleam00',
          repo: 'bolt.new-any-llm'
        });
        
        // Wait a bit for fork to be ready
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        console.log('Fork already exists or cannot be created');
      }

      // Now create/update repo in the fork
      let repo;
      try {
        let resp = await octokit.repos.get({ 
          owner: githubUsername, 
          repo: repoName 
        });
        repo = resp.data;
      } catch (error) {
        if (error instanceof Error && 'status' in error && error.status === 404) {
          const { data: newRepo } = await octokit.repos.createForAuthenticatedUser({
            name: repoName,
            private: false,
            auto_init: true,
          });
          repo = newRepo;
        } else {
          throw error;
        }
      }

      // Get all files
      const files = this.files.get();
      if (!files || Object.keys(files).length === 0) {
        throw new Error('No files found to push');
      }

      // Create blobs for each file
      const blobs = await Promise.all(
        Object.entries(files).map(async ([filePath, dirent]) => {
          if (dirent?.type === 'file' && dirent.content) {
            const { data: blob } = await octokit.git.createBlob({
              owner: repo.owner.login,
              repo: repo.name,
              content: Buffer.from(dirent.content).toString('base64'),
              encoding: 'base64',
            });
            return { path: filePath.replace(/^\/home\/project\//, ''), sha: blob.sha };
          }
        })
      );

      const validBlobs = blobs.filter(Boolean);

      if (validBlobs.length === 0) {
        throw new Error('No valid files to push');
      }

      // Get the default branch reference
      const { data: ref } = await octokit.git.getRef({
        owner: repo.owner.login,
        repo: repo.name,
        ref: `heads/${repo.default_branch}`,
      });

      // Get the current commit
      const { data: commit } = await octokit.git.getCommit({
        owner: repo.owner.login,
        repo: repo.name,
        commit_sha: ref.object.sha,
      });

      // Create tree
      const { data: tree } = await octokit.git.createTree({
        owner: repo.owner.login,
        repo: repo.name,
        base_tree: commit.tree.sha,
        tree: validBlobs.map(({ path, sha }) => ({
          path,
          mode: '100644',
          type: 'blob',
          sha,
        })),
      });

      // Create commit
      const { data: newCommit } = await octokit.git.createCommit({
        owner: repo.owner.login,
        repo: repo.name,
        message: 'Update from Bolt.new',
        tree: tree.sha,
        parents: [commit.sha],
      });

      // Update reference
      await octokit.git.updateRef({
        owner: repo.owner.login,
        repo: repo.name,
        ref: `heads/${repo.default_branch}`,
        sha: newCommit.sha,
      });

      toast.success('Successfully pushed to GitHub fork!');
      
    } catch (error) {
      console.error('Error pushing to GitHub:', error);
      toast.error('Failed to push to GitHub: ' + error.message);
    }
  }

  async loadLocalProject(
    directoryHandle: FileSystemDirectoryHandle, 
    options?: LoadProjectOptions
  ) {
    try {
      const webcontainerInstance = await webcontainer;
      
      // Track loading progress
      let loadingToast = toast.loading('Loading project...');
      let lastProgressUpdate = Date.now();
      
      const files = await readFilesFromDirectory(directoryHandle, '/home/project', {
        ...options,
        onProgress: (progress) => {
          // Update toast only every 100ms to prevent too frequent updates
          const now = Date.now();
          if (now - lastProgressUpdate > 100) {
            toast.loading(
              `Loading project: ${progress.processedFiles}/${progress.totalFiles} files (${formatFileSize(progress.totalSize)})`, 
              { id: loadingToast }
            );
            lastProgressUpdate = now;
          }
        }
      });
      
      // Show warning if files were skipped
      const skippedFiles = files.skippedFiles;
      if (skippedFiles?.length > 0) {
        toast.warning(
          `Skipped ${skippedFiles.length} files. Click for details`,
          {
            duration: 5000,
            onClick: () => {
              // Show modal with skipped files list
              alert(`Skipped files:\n${skippedFiles.join('\n')}`);
            }
          }
        );
      }

      // Reset current state
      this.#filesStore.resetFileModifications();
      this.unsavedFiles.set(new Set());
      this.#pendingFileChanges.clear();
      
      // Write all files to WebContainer
      for (const [path, content] of Object.entries(files)) {
        const relativePath = path.replace(/^\/home\/project\//, '');
        await webcontainerInstance.fs.writeFile(relativePath, content);
      }

      // Update file store and documents
      this.setDocuments(files);
      
      // Select first file
      if (this.#filesStore.filesCount > 0 && this.currentDocument.get() === undefined) {
        for (const [filePath, dirent] of Object.entries(files)) {
          if (dirent?.type === 'file') {
            this.setSelectedFile(filePath);
            break;
          }
        }
      }

      toast.success('Project loaded successfully', { id: loadingToast });
      return true;
    } catch (error) {
      console.error('Error loading local project:', error);
      toast.error('Failed to load project: ' + error.message);
      throw error;
    }
  }
}

export const workbenchStore = new WorkbenchStore();
