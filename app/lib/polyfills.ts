if (typeof globalThis.require === 'undefined') {
  globalThis.require = (id: string) => {
    if (id === 'module') {
      return { exports: {} };
    }
    throw new Error(`Cannot find module '${id}'`);
  };
}

if (typeof globalThis.exports === 'undefined') {
  globalThis.exports = {};
}

if (typeof globalThis.module === 'undefined') {
  globalThis.module = { exports: {} };
} 