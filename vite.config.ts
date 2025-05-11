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
            // Configurações básicas - você pode personalizar muito mais!
            registerType: 'autoUpdate', // Atualiza o PWA automaticamente quando há novo conteúdo
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'], // Arquivos estáticos para cachear (ajuste conforme necessário)
            manifest: {
                name: 'AiOmniChat', // Nome completo do app
                short_name: 'AiOmniChat', // Nome curto (para ícones)
                description: 'Chat para vários provedores de IA', // Descrição
                theme_color: '#000000', // Cor principal da UI do navegador/OS (combine com PRIMARY_APP_COLOR)
                background_color: '#000000', // Cor de fundo da splash screen
                display: 'standalone', // Abre como um app separado, sem a barra do navegador
                scope: '/', // Escopo de navegação do PWA
                start_url: '/', // Página inicial ao abrir o PWA
                icons: [
                    // Ícones essenciais - Crie esses arquivos e coloque na pasta /public
                    {
                        src: 'pwa-192x192.png', // Caminho relativo à pasta /public
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: 'pwa-512x512.png', // Caminho relativo à pasta /public
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: 'pwa-512x512.png', // Ícone "maskable" (opcional, mas recomendado)
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable', // Permite que o OS adapte o ícone
                    }
                ],
            },
            // Opções para desenvolvimento (opcional, mas útil para testar)
            devOptions: {
                enabled: true, // Habilita o Service Worker em modo de desenvolvimento
            }
        })
    ]
})
