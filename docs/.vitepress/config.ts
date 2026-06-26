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
