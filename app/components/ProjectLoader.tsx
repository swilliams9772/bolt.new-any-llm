import { useState } from 'react';
import { useNavigate } from '@remix-run/react';
import type { ProjectFile } from '~/types/file';

export function ProjectLoader() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleProjectLoad = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const directory = event.target.files?.[0];
    if (!directory) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('directory', directory);

      const response = await fetch('/api/load-project', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Failed to load project');

      const projectFiles: ProjectFile[] = await response.json();
      // Store project files in state/context and redirect to editor
      navigate('/editor', { state: { projectFiles } });
    } catch (error) {
      console.error('Error loading project:', error);
      // Handle error (show toast, etc.)
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <label 
        htmlFor="project-directory" 
        className="px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600"
      >
        {isLoading ? 'Loading...' : 'Load Local Project'}
      </label>
      <input
        id="project-directory"
        type="file"
        webkitdirectory="true"
        directory="true"
        className="hidden"
        onChange={handleProjectLoad}
        disabled={isLoading}
      />
    </div>
  );
} 