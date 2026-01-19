import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    main: {
        build: {
            lib: {
                entry: 'src/main/index.js'
            }
        },
        plugins: [externalizeDepsPlugin()]
    },
    preload: {
        build: {
            lib: {
                entry: 'src/preload/index.js'
            }
        },
        plugins: [externalizeDepsPlugin()]
    },
    renderer: {
        resolve: {
            alias: {
                '@': resolve('src/renderer/src')
            }
        },
        plugins: [react()]
    }
})
