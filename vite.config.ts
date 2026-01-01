/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    define: {
        'process.env': {}
    },
    plugins: [vue()],
    build: {
        lib: {
            entry: {
                'magnify_glass': resolve(__dirname, 'src/magnify_glass.ts'),
                'magnify_info_panel': resolve(__dirname, 'src/magnify_info_panel.ts')
            },
            formats: ['es'],
            fileName: (format, entryName) => `${entryName}.js`
        },
        outDir: 'web',
        emptyOutDir: false, // Keep existing files
        rollupOptions: {
            external: [
                /^\/scripts\//,                  // Match /scripts/ (Absolute path)
                /^\.\.\/\.\.\/scripts\//,        // Match ../../scripts/ (Browser path - deprecated)
            ],
            output: {
                preserveModules: true,
                preserveModulesRoot: 'src',
                entryFileNames: '[name].js',
            }
        },
        sourcemap: true,
        minify: false // Keep readable for debugging
    },
    resolve: {
        alias: {
            '@shared': resolve(__dirname, 'src/shared'),
            '@magnify-glass': resolve(__dirname, 'src/magnify-glass'),
            '@info-panel': resolve(__dirname, 'src/info-panel')
        }
    },
    test: {
        environment: 'happy-dom', // or jsdom, useful for component testing
        globals: true
    }
});
