// Use dynamic import for node:path
const nodePath = import.meta.env.SSR ? await import('node:path') : null;
const pathBrowserify = import.meta.env.SSR ? null : await import('path-browserify');

// Export the appropriate path module
const path = import.meta.env.SSR ? nodePath : pathBrowserify;

export default path; 