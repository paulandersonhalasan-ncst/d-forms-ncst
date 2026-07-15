import { createTheme, MantineColorsTuple, virtualColor } from '@mantine/core';

// 10 shades para sa Imperial Blue (0e2769 ang primary/index 6)
const regalNavy: MantineColorsTuple = [
  "#ebf4ff",
  "#d4e4fa",
  "#a3c7f7",
  "#70a9f6",
  "#4a8ff5",
  "#377ff5",
  "#2d77f6",
  "#2265dc",
  "#185ac5",
  "#003980" //main color
]

// 10 shades para sa Light/Cream Yellow (fff1d0 ang primary/index 4)
const customCreamYellow: MantineColorsTuple = [
  "#fff8e5",
  "#fff0d0", //main color
  "#fedf9e",
  "#fece69",
  "#febf3e",
  "#feb625",
  "#feb118",
  "#e29b0b",
  "#c98900",
  "#af7600"
];

export const theme = createTheme({
  focusRing: 'auto',
  
  // I-register ang iyong custom colors
  colors: {
    regalNavy,
    customCreamYellow,
    
    // Virtual color na nagpapalit depende sa active theme
    // Ginagamit nito ang Seashell para sa light at Carbon Black para sa dark
    dynamicBg: virtualColor({
      name: 'dynamicBg',
      light: '#fff8f2', // Seashell
      dark: '#242424',  // Carbon Black
    }),
    
    dynamicText: virtualColor({
      name: 'dynamicText',
      light: '#242424', // Carbon Black text sa Light Mode
      dark: '#fff8f2',  // Seashell text sa Dark Mode
    }),
  },

  // Dito mo i-set kung ano ang default primary color mo (e.g., Imperial Blue)
  primaryColor: 'regalNavy',
  primaryShade: 9,

  // ✅ DAGDAGAN: Palakihin ang lahat ng text sizes
  fontSizes: {
    xs: '14px',   // default 12px
    sm: '16px',   // default 14px
    md: '18px',   // default 16px
    lg: '20px',   // default 18px
    xl: '22px',   // default 20px
  },

  // Opsiyonal: Palakihin din ang mga heading sizes
  headings: {
    sizes: {
      h1: { fontSize: '2.75rem' },  // default ~2rem
      h2: { fontSize: '2.25rem' },
      h3: { fontSize: '2.0rem' },
      h4: { fontSize: '1.75rem' },
      h5: { fontSize: '1.5rem' },
      h6: { fontSize: '1.25rem' },
    },
  },

  // Global style overrides para pilitin ang Seashell at Carbon Black bilang body background
  components: {
    Container: {
      defaultProps: {
        sizes: {
          xs: 540,
          sm: 720,
          md: 960,
          lg: 1140,
          xl: 1320,
        },
      },
    },
  },
});