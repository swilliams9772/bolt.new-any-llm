import { useState, useEffect } from 'react';
import { IconButton } from '~/components/ui/IconButton';

interface Change {
  path: string;
  content: string;
  staged: boolean;
}

interface VSCodeChangesPanelProps {
  onStage: (path: string) => void;
  onUnstage: (path: string) => void;
  onCommit: (message: string) => void;
  onDiscard: (path: string) => void;
}

export function VSCodeChangesPanel({
  onStage,
  onUnstage,
  onCommit,
  onDiscard
}: VSCodeChangesPanelProps) {
  const [changes, setChanges] = useState<Change[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  useEffect(() => {
    const fetchChanges = async () => {
      const response = await fetch('/api/vscode/changes');
      const data = await response.json();
      setChanges(data);
    };

    fetchChanges();
    // Poll for changes every 5 seconds
    const interval = setInterval(fetchChanges, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    
    setIsCommitting(true);
    try {
      await onCommit(commitMessage);
      setCommitMessage('');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-white">
      <div className="p-2 border-b border-[#333]">
        <h2 className="text-sm font-medium">Source Control</h2>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-2">
          <h3 className="text-xs text-[#969696] mb-2">Staged Changes</h3>
          {changes
            .filter(c => c.staged)
            .map(change => (
              <div key={change.path} className="flex items-center gap-2 text-sm py-1">
                <IconButton
                  icon="i-ph:minus"
                  onClick={() => onUnstage(change.path)}
                  title="Unstage changes"
                />
                <span className="truncate">{change.path}</span>
              </div>
            ))}
        </div>

        <div className="p-2">
          <h3 className="text-xs text-[#969696] mb-2">Changes</h3>
          {changes
            .filter(c => !c.staged)
            .map(change => (
              <div key={change.path} className="flex items-center gap-2 text-sm py-1">
                <IconButton
                  icon="i-ph:plus"
                  onClick={() => onStage(change.path)}
                  title="Stage changes"
                />
                <IconButton
                  icon="i-ph:x"
                  onClick={() => onDiscard(change.path)}
                  title="Discard changes"
                />
                <span className="truncate">{change.path}</span>
              </div>
            ))}
        </div>
      </div>

      <div className="p-2 border-t border-[#333]">
        <textarea
          value={commitMessage}
          onChange={e => setCommitMessage(e.target.value)}
          placeholder="Commit message"
          className="w-full h-20 bg-[#2d2d2d] text-white p-2 text-sm rounded"
        />
        <button
          onClick={handleCommit}
          disabled={!commitMessage.trim() || isCommitting}
          className="mt-2 w-full py-1 bg-[#0078d4] text-white rounded disabled:opacity-50"
        >
          {isCommitting ? 'Committing...' : 'Commit'}
        </button>
      </div>
    </div>
  );
} 