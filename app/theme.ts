import { createTheme, MantineColorsTuple, virtualColor } from '@mantine/core';

// 10 shades para sa Imperial Blue (0e2769 ang primary/index 6)
const imperialBlue: MantineColorsTuple = [
  '#e8efff',
  '#cfddf8',
  '#9bb9f3',
  '#6392ee',
  '#3873ea',
  '#1d5fe9',
  '#0e2769', // Iyong core color (Index 6)
  '#0746cb',
  '#003eb7',
  '#0035a3',
];

// 10 shades para sa School Bus Yellow (fec435 ang primary/index 5 o 6)
const schoolBusYellow: MantineColorsTuple = [
  '#fff8e1',
  '#ffefc4',
  '#ffde8a',
  '#fecd4c',
  '#fec435', // Iyong core color (Index 4)
  '#febe20',
  '#e5a500',
  '#cc9300',
  '#b38000',
  '#996b00',
];

export const theme = createTheme({
  focusRing: 'auto',
  
  // I-register ang iyong custom colors
  colors: {
    imperialBlue,
    schoolBusYellow,
    
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
  primaryColor: 'imperialBlue',
  primaryShade: 6,

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