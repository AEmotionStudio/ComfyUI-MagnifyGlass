import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'happy-dom',
        include: ['tests/unit/**/*.test.ts'],
        exclude: ['node_modules', 'web'],
        coverage: {
            reporter: ['text', 'html'],
            include: ['src/**/*.ts'],
            exclude: ['src/types/**']
        }
    },
    resolve: {
        alias: {
            '/scripts/app.js': path.resolve(__dirname, 'tests/mocks/app.ts')
        }
    }
});

