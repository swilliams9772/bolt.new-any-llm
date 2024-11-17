import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ConfigEnv, type ViteDevServer } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { esbuildCommonjs } from '@originjs/vite-plugin-commonjs';

export default defineConfig(({ command, mode }: ConfigEnv) => {
  const isSsr = mode === 'development' || command === 'build';
  
  return {
    build: {
      target: 'esnext',
      commonjsOptions: {
        transformMixedEsModules: true,
        include: [
          /@google-cloud\/vertexai/,
          /@remix-run\/cloudflare/,
          /ai/,
          /common-tags/,
          /diff/
        ],
        exclude: ['node_modules/vite/**'],
      },
      rollupOptions: {
        output: {
          format: 'esm',
        },
      },
    },
    optimizeDeps: {
      include: [
        ...(isSsr ? [] : ['path-browserify']),
        '@google-cloud/vertexai',
        '@remix-run/cloudflare',
        'ai',
        'common-tags',
        'diff'
      ],
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
        platform: 'node',
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'global': 'globalThis',
    },
    plugins: [
      {
        name: 'module-polyfill',
        config(config) {
          return {
            ...config,
            resolve: {
              ...config.resolve,
              alias: {
                ...config.resolve?.alias,
                module: 'rollup-plugin-node-polyfills/polyfills/module',
              },
            },
          };
        },
      },
      esbuildCommonjs(['@google-cloud/vertexai'], {
        skipPreBuild: true,
      }),
      mode !== 'test' && remixCloudflareDevProxy(),
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
        },
      }),
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      command === 'build' && optimizeCssModules({ apply: 'build' }),
      nodePolyfills({
        include: ['buffer', 'process'],
        globals: {
          Buffer: true,
          process: true,
        },
      }),
    ].filter(Boolean),
    envPrefix: ["VITE_", "OPENAI_LIKE_API_", "OLLAMA_API_BASE_URL", "LMSTUDIO_API_BASE_URL"],
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
    esbuild: {
      supported: {
        'dynamic-import': true,
        'import-meta': true,
      },
    }
  };
});

function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);

        if (raw) {
          const version = parseInt(raw[2], 10);

          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>',
            );
            return;
          }
        }
        next();
      });
    },
  };
}
