import { useState, useRef } from 'react';
import type { PromptImage } from '~/types/prompt';

interface ImageAttachmentProps {
  onImageAttach: (image: PromptImage) => void;
  onImageRemove: (url: string) => void;
  attachedImages: PromptImage[];
}

export function ImageAttachment({ onImageAttach, onImageRemove, attachedImages }: ImageAttachmentProps) {
  const [isUrlInputVisible, setIsUrlInputVisible] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      onImageAttach({
        url: URL.createObjectURL(file),
        alt: file.name,
        type: 'file',
        data: base64Data
      });
    };
    reader.readAsDataURL(file);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl) return;

    onImageAttach({
      url: imageUrl,
      type: 'url'
    });
    setImageUrl('');
    setIsUrlInputVisible(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Upload Image
        </button>
        <button
          onClick={() => setIsUrlInputVisible(!isUrlInputVisible)}
          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Add Image URL
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {isUrlInputVisible && (
        <form onSubmit={handleUrlSubmit} className="flex gap-2">
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Enter image URL"
            className="flex-1 px-2 py-1 border rounded"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add
          </button>
        </form>
      )}

      {attachedImages.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {attachedImages.map((image) => (
            <div key={image.url} className="relative">
              <img
                src={image.url}
                alt={image.alt || 'Attached image'}
                className="w-20 h-20 object-cover rounded"
              />
              <button
                onClick={() => onImageRemove(image.url)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 