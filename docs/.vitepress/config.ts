import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Canopy',
  description: 'AI coding agent fork of OpenCode',
  ignoreDeadLinks: true,
  
  locales: {
    root: {
      label: 'Português',
      lang: 'pt-BR',
      themeConfig: {
          nav: [
            { text: 'Início', link: '/' },
            { text: 'Guias', link: '/guides/' },
            { text: 'MLX', link: '/guides/mlx' },
            { text: 'Benchmark', link: '/guides/benchmark' },
          ],
        sidebar: {
          '/': [
            {
              text: 'Introdução',
              items: [
                { text: 'O que é', link: '/' },
                { text: 'Como rodar', link: '/guides/getting-started' },
              ]
            },
            {
              text: 'Guias',
              items: [
                { text: 'Instalação', link: '/guides/installation' },
                { text: 'Providers', link: '/guides/providers' },
                { text: 'Plugins', link: '/guides/plugins' },
                { text: 'MLX Local', link: '/guides/mlx' },
                { text: 'Benchmark', link: '/guides/benchmark' },
              ]
            }
          ]
        }
      }
    },
    en: {
      label: 'English',
      lang: 'en-US',
      themeConfig: {
          nav: [
            { text: 'Home', link: '/en/' },
            { text: 'Guides', link: '/en/guides/' },
            { text: 'MLX', link: '/en/guides/mlx' },
            { text: 'Benchmark', link: '/en/guides/benchmark' },
          ],
          sidebar: {
            '/en/': [
              {
                text: 'Introduction',
                items: [
                  { text: 'What is it', link: '/en/' },
                  { text: 'Getting Started', link: '/en/guides/getting-started' },
                ]
              },
              {
                text: 'Guides',
                items: [
                  { text: 'Installation', link: '/en/guides/installation' },
                  { text: 'Providers', link: '/en/guides/providers' },
                  { text: 'Plugins', link: '/en/guides/plugins' },
                  { text: 'MLX Local Models', link: '/en/guides/mlx' },
                  { text: 'Benchmark', link: '/en/guides/benchmark' },
                ]
              }
            ]
        }
      }
    }
  },
  
  themeConfig: {
    socialLinks: [
      { icon: 'github', link: 'https://github.com/mateussiqueira/canopy' }
    ]
  }
})
