import type { ActionFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { LocalProjectManager } from '~/lib/.server/project/local-project';

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const directory = formData.get('directory');

  if (!directory || !(directory instanceof File)) {
    throw new Error('No directory provided');
  }

  const projectManager = new LocalProjectManager(directory.path);
  const files = await projectManager.loadProject();

  return json(files);
}; 