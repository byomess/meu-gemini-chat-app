import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            strategies: 'injectManifest', // MODIFIED: Use injectManifest strategy
            srcDir: 'src',                // ADDED: Directory of your custom SW
            filename: 'sw-periodic-notification-test.ts', // ADDED: Your custom SW file name
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
            manifest: {
                name: 'Loox AI',
                short_name: 'Loox AI',
                description: 'Assistente de IA que se adequa às suas necessidades.',
                theme_color: '#000000',
                background_color: '#000000',
                display: 'standalone',
                scope: '/',
                start_url: '/',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable',
                    },
                    {
                        src: 'apple-touch-icon.png', // Added for iOS PWA compatibility
                        sizes: '180x180',
                        type: 'image/png',
                    }
                ],
            },
            workbox: {
                // skipWaiting and clientsClaim are now handled in sw-periodic-notification-test.ts
                // Adicionalmente, para garantir que assets críticos como o index.html
                // sejam sempre revalidados, você pode configurar runtimeCaching.
                // Exemplo para o index.html (ou outros arquivos que você quer sempre frescos):
                runtimeCaching: [
                    {
                        urlPattern: ({ url }) => url.pathname.endsWith('.html'), // Ou mais específico, como seu index.html
                        handler: 'StaleWhileRevalidate', // Alterado de 'NetworkFirst' para 'StaleWhileRevalidate'
                        options: {
                            cacheName: 'html-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 1 // 1 dia (ajuste conforme necessidade)
                            },
                            // networkTimeoutSeconds não é aplicável para StaleWhileRevalidate
                        }
                    }
                ]
            },
            devOptions: {
                enabled: true,
                type: 'module', // Important for TypeScript service workers in dev
            }
        })
    ]
})
