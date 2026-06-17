import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        // webtorrent (ESM) + его нативные deps не бандлим — грузятся из node_modules в рантайме
        // (поэтому они должны попасть в asar/asarUnpack, см. package.json build).
        vite: { build: { rollupOptions: { external: ['webtorrent', 'node-datachannel'] } } },
      },
      preload: { input: path.join(__dirname, 'electron/preload.ts') },
      renderer: {},
    }),
  ],
})
