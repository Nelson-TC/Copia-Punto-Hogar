/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      // Paleta oficial de Punto Hogar.
      // Los nombres (nav, carrot, brand...) se mantienen por compatibilidad con los componentes existentes:
      //   nav    = azul marino (color principal)   #123453
      //   carrot = naranja (color secundario)      #F58220
      //   brand  = verde (color de acento)         #55A844
      //   ink    = gris oscuro (textos y eslogan)  #3F4145
      colors: {
        brand: {
          DEFAULT: '#55A844',
          dark: '#3F8A32'
        },
        carrot: {
          DEFAULT: '#F58220',
          dark: '#C96510'
        },
        nav: {
          DEFAULT: '#123453', // azul marino
          dark: '#0C2438'     // tono más oscuro para degradados y hover
        },
        ink: '#3F4145',
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#F4F7FA'
        }
      }
    }
  },
  plugins: []
};
