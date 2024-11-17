import { readFile } from 'fs/promises';
import { extname } from 'path';
import { isText } from 'istextorbinary';

interface Document {
  id: string;
  name: string;
  type: 'template' | 'codebase' | 'style-guide' | 'other';
  content: string;
  metadata: {
    uploadedAt: number;
    fileType: string;
    description?: string;
  };
}

export class DocumentManager {
  private documents: Map<string, Document> = new Map();

  async addDocument(
    file: File,
    type: Document['type'],
    description?: string
  ): Promise<Document> {
    const buffer = await file.arrayBuffer();
    const content = await this.processFile(file.name, buffer);

    const document: Document = {
      id: crypto.randomUUID(),
      name: file.name,
      type,
      content,
      metadata: {
        uploadedAt: Date.now(),
        fileType: extname(file.name).toLowerCase(),
        description
      }
    };

    this.documents.set(document.id, document);
    return document;
  }

  private async processFile(filename: string, buffer: ArrayBuffer): Promise<string> {
    const uint8Array = new Uint8Array(buffer);
    
    if (!isText(filename, uint8Array)) {
      throw new Error('Only text files are supported');
    }

    const decoder = new TextDecoder();
    return decoder.decode(uint8Array);
  }

  getDocument(id: string): Document | undefined {
    return this.documents.get(id);
  }

  getDocumentsByType(type: Document['type']): Document[] {
    return Array.from(this.documents.values())
      .filter(doc => doc.type === type);
  }

  getAllDocuments(): Document[] {
    return Array.from(this.documents.values());
  }

  deleteDocument(id: string): boolean {
    return this.documents.delete(id);
  }

  getRelevantContext(prompt: string): string {
    // Simple keyword matching for now - could be enhanced with embeddings
    const keywords = prompt.toLowerCase().split(/\W+/);
    let relevantDocs = Array.from(this.documents.values())
      .filter(doc => 
        keywords.some(keyword => 
          doc.content.toLowerCase().includes(keyword) ||
          doc.name.toLowerCase().includes(keyword) ||
          doc.metadata.description?.toLowerCase().includes(keyword)
        )
      );

    // Limit context size
    const MAX_CONTEXT_LENGTH = 2000;
    let context = '';
    
    for (const doc of relevantDocs) {
      const docContext = `
        Document: ${doc.name}
        Type: ${doc.type}
        Content:
        ${doc.content.slice(0, MAX_CONTEXT_LENGTH / relevantDocs.length)}
        ---
      `;
      
      context += docContext;
    }

    return context;
  }
}

// Singleton instance
export const documentManager = new DocumentManager(); 