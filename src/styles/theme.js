import { createTheme } from '@mui/material/styles';
import { TOKENS } from './HomeLineStyles';

const scrollSelectIntoCenter = (event) => {
  const el = event?.currentTarget;
  if (!el || typeof el.scrollIntoView !== 'function') return;
  const rect = el.getBoundingClientRect();
  const viewportMid = window.innerHeight / 2;
  const fieldMid = rect.top + rect.height / 2;
  if (fieldMid < viewportMid) return;
  el.scrollIntoView({ behavior: 'auto', block: 'center' });
};

const theme = createTheme({
  palette: {
    primary: { main: TOKENS.hlBlue, dark: TOKENS.hlBlueDark, contrastText: '#fff' },
    secondary: { main: TOKENS.hlGold, dark: TOKENS.hlGoldDark, contrastText: '#fff' },
    error: { main: TOKENS.hlError },
    text: { primary: TOKENS.ink, secondary: TOKENS.gray5 },
    background: { default: '#fff', paper: '#fff' },
    divider: TOKENS.lineSoft
  },
  typography: { fontFamily: TOKENS.fontBody, body1: { fontSize: 13 }, body2: { fontSize: 12.5 } },
  shape: { borderRadius: TOKENS.radius },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none', fontFamily: TOKENS.fontBody, fontWeight: 600,
          fontSize: 12, borderRadius: TOKENS.radius, padding: '9px 16px', lineHeight: 1.2,
          // ACCESSIBILITY: High-contrast focus ring
          '&:focus-visible': {
            outline: `3px solid ${TOKENS.hlBlueDark}`,
            outlineOffset: '2px',
          }
        },
        outlined: {
          borderWidth: '1.5px', borderColor: TOKENS.hlBlue, color: TOKENS.hlBlueDark,
          '&:hover': { borderWidth: '1.5px', backgroundColor: TOKENS.hlBlueTint }
        },
        contained: {
          backgroundColor: TOKENS.hlBlue, border: `1.5px solid ${TOKENS.hlBlue}`,
          '&:hover': { backgroundColor: TOKENS.hlBlueDark, borderColor: TOKENS.hlBlueDark }
        },
        sizeSmall: {
          fontSize: 11, fontWeight: 500, padding: '5px 10px',
          '&.MuiButton-outlined': { borderWidth: '1px' }
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: TOKENS.radius, fontSize: 12,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: TOKENS.lineSoft },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: TOKENS.hlBlue, borderWidth: 2 },
          '&.Mui-disabled': { backgroundColor: TOKENS.gray1 },
          // ACCESSIBILITY: Focus ring for inputs
          '&.Mui-focused': {
            boxShadow: `0 0 0 3px ${TOKENS.hlBlueTint}`,
          }
        },
        input: { padding: '9px 12px' }
      }
    },
    MuiInputLabel: {
      defaultProps: { shrink: true },
      styleOverrides: {
        root: { fontFamily: TOKENS.fontBody, fontSize: 12 }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: TOKENS.radius,
          border: `1.5px solid ${TOKENS.hlBlue}`,
          boxShadow: '0 6px 24px rgba(13,50,38,.25)'
        }
      }
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: 16,
          textTransform: 'uppercase', color: TOKENS.hlBlueDark,
          borderTop: `3px solid ${TOKENS.hlGold}`, borderBottom: `1px solid ${TOKENS.lineSoft}`,
          padding: '14px 18px'
        }
      }
    },
    MuiDialogContent: { styleOverrides: { root: { padding: '16px 18px 4px' } } },
    MuiDialogActions: {
      styleOverrides: { root: { padding: '14px 18px', borderTop: `1px solid ${TOKENS.lineSoft}` } }
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${TOKENS.lineSoft}`, padding: '12px', fontSize: 12.5 },
        head: {
          backgroundColor: TOKENS.gray1, borderBottom: `1.5px solid ${TOKENS.hlBlue}`,
          fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', height: 22, borderRadius: 20 }
      }
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: TOKENS.hlBlueDark, fontSize: 11, borderRadius: TOKENS.radius }
      }
    },
    MuiMenu: {
      defaultProps: { autoFocus: false, MenuListProps: { autoFocusItem: false } },
      styleOverrides: { paper: { maxHeight: 240 } }
    },
    MuiSelect: {
      defaultProps: {
        onMouseDown: scrollSelectIntoCenter,
        displayEmpty: true,
        MenuProps: {
          autoFocus: false,
          MenuListProps: { autoFocusItem: false },
          PaperProps: { sx: { maxHeight: 240 } },
          anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
          transformOrigin: { vertical: 'top', horizontal: 'left' }
        }
      }
    }
  }
});

export default theme;