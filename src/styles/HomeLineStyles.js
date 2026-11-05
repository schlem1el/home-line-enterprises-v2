export const TOKENS = {
  hlBlue: '#1B4E7A',
  hlBlueDark: '#0F3352',
  hlBlueTint: '#E3ECF4',
  hlGold: '#D89B2E',
  hlGoldDark: '#B27F1F',
  hlCoral: '#DD8567',
  hlCream: '#F4EED9',
  hlError: '#A63A22',

  ink: '#17241D',
  line: '#17241D',
  lineSoft: '#D9D0B4',
  gray1: '#F7F3E6',
  gray2: '#EFE8D4',
  gray3: '#E0D6B4',
  gray4: '#B8AE8C',
  gray5: '#6E6A55',
  radius: 7,

  fontDisplay: '"Barlow Condensed", "Helvetica Neue", Helvetica, Arial, sans-serif',
  fontBody: '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif'
};

export const card = {
  border: `1px solid ${TOKENS.lineSoft}`,
  borderRadius: `${TOKENS.radius}px`,
  backgroundColor: '#fff',
  padding: { xs: '16px 14px', sm: '16px 18px' },
  minWidth: 0,
  boxSizing: 'border-box',
  boxShadow: 'none'
};

export const cardTop = { ...card, borderTop: `3px solid ${TOKENS.hlBlue}` };

export const sectionTitle = {
  fontFamily: TOKENS.fontDisplay,
  fontSize: 13,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  color: TOKENS.hlBlueDark,
  margin: { xs: '20px 0 10px', sm: '28px 0 12px' },
  paddingLeft: '9px',
  borderLeft: `3px solid ${TOKENS.hlGold}`
};
export const sectionTitleTop = { ...sectionTitle, margin: { xs: '0 0 10px', sm: '0 0 12px' } };

export const labelStyle = {
  fontSize: 11,
  fontWeight: 700,
  color: TOKENS.hlBlueDark,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  marginBottom: '6px',
  display: 'block'
};

export const hintStyle = { fontSize: 11, color: TOKENS.gray5, marginTop: '6px' };
export const cellSubStyle = { fontSize: 10.5, color: TOKENS.gray5, marginTop: '2px' };
export const disabledFieldText = {
  '& .MuiInputBase-input.Mui-disabled': {
    color: TOKENS.gray5,
    WebkitTextFillColor: TOKENS.gray5,
    opacity: 1
  },
  '& .MuiSelect-select.Mui-disabled': {
    color: TOKENS.gray5,
    WebkitTextFillColor: TOKENS.gray5,
    opacity: 1
  }
};

export const tableWrap = {
  border: `1px solid ${TOKENS.lineSoft}`,
  borderRadius: `${TOKENS.radius}px`,
  overflowX: 'auto',
  overflowY: 'hidden',
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  WebkitOverflowScrolling: 'touch'
};

export const th = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 10.5,
  fontWeight: 700,
  color: TOKENS.hlBlueDark,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  background: TOKENS.gray1,
  borderBottom: `1.5px solid ${TOKENS.hlBlue}`,
  whiteSpace: 'nowrap'
};

export const td = {
  padding: '12px',
  fontSize: 12.5,
  borderBottom: `1px solid ${TOKENS.lineSoft}`
};

export const filterBar = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 2,
  mb: 3,
  alignItems: 'center'
};

export const chartBox = {
  border: `1px dashed ${TOKENS.gray4}`,
  borderRadius: `${TOKENS.radius}px`,
  background: TOKENS.hlBlueTint,
  height: { xs: 160, sm: 200 },
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  color: TOKENS.hlBlueDark,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.5
};

export const filterChip = {
  display: 'inline-flex',
  alignItems: 'center',
  // 48px minimum height on mobile, back to 34px on desktop
  height: { xs: 48, sm: 34 },
  border: `1px solid ${TOKENS.lineSoft}`,
  borderRadius: `${TOKENS.radius}px`,
  padding: { xs: '0 16px', sm: '0 12px' }, // Wider padding on mobile for easier tapping
  fontSize: { xs: 13, sm: 11 }, // Slightly larger text on mobile
  fontWeight: 500,
  fontFamily: TOKENS.fontBody,
  backgroundColor: '#fff',
  color: TOKENS.hlBlueDark,
  textTransform: 'none',
  boxShadow: 'none',
  lineHeight: 1.2,
  '&:hover': {
    backgroundColor: TOKENS.gray1,
    borderColor: TOKENS.gray4
  },
  '& .MuiButton-startIcon': {
    marginLeft: 0,
    marginRight: '6px'
  },
  '& .MuiSvgIcon-root': { fontSize: 15 }
};

export const actionChip = {
  ...filterChip,
  // 48px minimum height on mobile, back to 28px on desktop
  height: { xs: 48, sm: 28 },
  padding: { xs: '0 16px', sm: '0 9px' },
  '& .MuiButton-startIcon': {
    marginLeft: 0,
    marginRight: '4px'
  },
  '& .MuiSvgIcon-root': { fontSize: { xs: 18, sm: 13 } }
};