import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface Version {
  id: string;
  timestamp: number;
  description: string;
}

export function VersionHistory() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadVersions = async () => {
    const response = await fetch('/api/versions');
    const data = await response.json();
    setVersions(data);
  };

  const handleRevert = async (versionId: string) => {
    setIsLoading(true);
    try {
      await fetch('/api/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId })
      });
      // Reload the page to show reverted changes
      window.location.reload();
    } catch (error) {
      console.error('Error reverting version:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Version History</h2>
      <div className="space-y-2">
        {versions.map((version) => (
          <div key={version.id} className="flex items-center justify-between p-2 bg-gray-100 rounded">
            <div>
              <div className="text-sm text-gray-600">
                {formatDistanceToNow(version.timestamp)} ago
              </div>
              <div className="text-sm">{version.description || 'No description'}</div>
            </div>
            <button
              onClick={() => handleRevert(version.id)}
              disabled={isLoading}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Revert
            </button>
          </div>
        ))}
      </div>
    </div>
  );
} 