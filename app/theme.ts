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
  '#fffdf5', // 0: Lightest (maganda sa very subtle backgrounds)
  '#fffaf0', // 1: Hover state ng subtle backgrounds
  '#fff6e6', // 2
  '#fff3dc', // 3
  '#fff1d0', // 4: Iyong core color (Primary)
  '#ffe8ab', // 5: Hover state ng primary
  '#ffde85', // 6: Active state
  '#ffd55e', // 7
  '#ffcb38', // 8
  '#e6b419', // 9: Darkest (maganda sa borders o text contrast)
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