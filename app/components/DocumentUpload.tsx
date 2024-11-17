import { useState } from 'react';
import { toast } from 'react-toastify';

interface DocumentUploadProps {
  onUpload: (file: File, type: string, description: string) => Promise<void>;
}

export function DocumentUpload({ onUpload }: DocumentUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>('template');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    setIsUploading(true);
    try {
      await onUpload(selectedFile, docType, description);
      toast.success('Document uploaded successfully');
      setSelectedFile(null);
      setDescription('');
    } catch (error) {
      toast.error('Failed to upload document: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">Upload Reference Document</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Document Type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="template">UI Template</option>
            <option value="codebase">Code Reference</option>
            <option value="style-guide">Style Guide</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            rows={3}
            placeholder="Brief description of the document..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">File</label>
          <input
            type="file"
            onChange={handleFileSelect}
            className="mt-1 block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>

        <button
          type="submit"
          disabled={!selectedFile || isUploading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isUploading ? 'Uploading...' : 'Upload Document'}
        </button>
      </form>
    </div>
  );
} 