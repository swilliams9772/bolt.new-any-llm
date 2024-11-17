import { json } from '@remix-run/node';
import type { ActionFunction } from '@remix-run/node';
import { documentManager } from '~/lib/.server/document/document-manager';

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const action = formData.get('action')?.toString();

  switch (action) {
    case 'upload': {
      const file = formData.get('file') as File;
      const type = formData.get('type')?.toString();
      const description = formData.get('description')?.toString();

      if (!file || !type) {
        throw new Response('Missing required fields', { status: 400 });
      }

      try {
        const document = await documentManager.addDocument(file, type as any, description);
        return json({ success: true, document });
      } catch (error) {
        throw new Response(error.message, { status: 500 });
      }
    }

    case 'list': {
      const type = formData.get('type')?.toString();
      const documents = type ? 
        documentManager.getDocumentsByType(type as any) :
        documentManager.getAllDocuments();
      return json(documents);
    }

    case 'delete': {
      const id = formData.get('id')?.toString();
      if (!id) {
        throw new Response('Document ID required', { status: 400 });
      }

      const success = documentManager.deleteDocument(id);
      return json({ success });
    }

    default:
      throw new Response('Invalid action', { status: 400 });
  }
}; 