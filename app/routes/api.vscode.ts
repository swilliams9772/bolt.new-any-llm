import { json } from '@remix-run/node';
import type { ActionFunction } from '@remix-run/node';
import { vscodeManager } from '~/lib/.server/vscode/vscode-manager';
import { handleFileOperation } from '~/lib/.server/file/handle-file-operations';

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const action = formData.get('action')?.toString();

  switch (action) {
    case 'stage':
      const stagePath = formData.get('path')?.toString();
      if (!stagePath) throw new Error('Path is required');
      const stageResult = vscodeManager.stageChange(stagePath);
      return json({ success: stageResult });

    case 'unstage':
      const unstagePath = formData.get('path')?.toString();
      if (!unstagePath) throw new Error('Path is required');
      const unstageResult = vscodeManager.unstageChange(unstagePath);
      return json({ success: unstageResult });

    case 'commit':
      const message = formData.get('message')?.toString();
      if (!message) throw new Error('Commit message is required');
      
      const changes = vscodeManager.commitChanges(message);
      for (const change of changes) {
        await handleFileOperation(change.path, change.newContent, message);
      }
      return json({ success: true });

    case 'discard':
      const discardPath = formData.get('path')?.toString();
      if (!discardPath) throw new Error('Path is required');
      vscodeManager.discardChanges(discardPath);
      return json({ success: true });

    case 'changes':
      return json({
        staged: vscodeManager.getStagedChanges(),
        unstaged: vscodeManager.getUnstagedChanges()
      });

    default:
      throw new Error('Invalid action');
  }
}; 