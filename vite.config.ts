import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import monkey from 'vite-plugin-monkey'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    monkey({
      entry: 'src/main.tsx',
      userscript: {
        name: '立体防御',
        namespace: 'https://github.com/starchfurrycon/stereo-defense',
        version: '1.0.0',
        description: 'B 站多源画像范围拉黑',
        author: 'starchfurrycon',
        license: 'MIT',
        match: ['*://*.bilibili.com/*'],
        exclude: ['*://message.bilibili.com/*', '*://passport.bilibili.com/*'],
        'run-at': 'document-idle',
        grant: [
          'GM_xmlhttpRequest',
          'GM_registerMenuCommand',
          'GM_setValue',
          'GM_getValue',
          'GM_deleteValue',
        ],
        connect: ['api.bilibili.com', '*'],
      },
      server: {
        open: false,
        prefix: false,
      },
      build: {
        fileName: 'stereo-defense.user.js',
        autoGrant: false,
        // 内联 SystemJS，避免依赖 jsDelivr 才能启动
        systemjs: 'inline',
      },
    }),
  ],
  build: {
    target: 'es2022',
    minify: 'oxc',
    chunkSizeWarningLimit: 8192,
  },
})
