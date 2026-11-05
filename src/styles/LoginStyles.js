// src/styles/LoginStyles.js
import { TOKENS } from './HomeLineStyles';

const loginStyle = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    p: { xs: 0, sm: 3, md: 4 },
    background: `linear-gradient(135deg, ${TOKENS.hlBlueDark} 0%, ${TOKENS.hlBlue} 100%)`,
    position: 'relative',
    overflowX: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      backgroundImage: `repeating-linear-gradient(45deg, rgba(216,155,46,.05) 0 2px, transparent 2px 14px)`,
      pointerEvents: 'none',
      display: 'block',
    },
  },

  card: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: { sm: '520px', md: '1000px' },
    minHeight: { xs: '100dvh', sm: 'auto', md: 'min(650px, 90vh)' },
    height: { xs: 'auto', md: 'min(650px, 90vh)' },
    bgcolor: 'transparent',
    borderRadius: { xs: 0, sm: '24px', md: '24px' },
    boxShadow: {
      xs: 'none',
      sm: '0 24px 48px -12px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0,0,0,.1)'
    },
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 400px) minmax(0, 1fr)' },
    gridTemplateRows: { xs: 'auto 1fr', sm: 'auto 1fr', md: '100%' },
    background: {
      xs: `linear-gradient(180deg, ${TOKENS.hlBlueDark} 0%, ${TOKENS.hlBlue} 100%)`,
      sm: `linear-gradient(180deg, ${TOKENS.hlBlueDark} 0%, ${TOKENS.hlBlue} 100%)`,
      md: '#fff'
    },
    overflow: 'hidden',
  },

  brandPanel: {
    position: 'relative',
    display: { xs: 'none', md: 'flex' },
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '40px',
    color: '#fff',
    background: `
      radial-gradient(120% 80% at 15% 15%, rgba(216,155,46,.3) 0%, transparent 60%),
      radial-gradient(100% 70% at 85% 85%, rgba(221,133,103,.2) 0%, transparent 60%),
      linear-gradient(180deg, ${TOKENS.hlBlue} 0%, ${TOKENS.hlBlueDark} 100%)
    `,
    overflow: 'hidden',
    minHeight: 0,
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,.03) 0 2px, transparent 2px 16px)`,
      pointerEvents: 'none',
    },
  },

  brandTopRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    position: 'relative',
    zIndex: 1,
    flexShrink: 0,
  },

  brandMark: {
    width: 76,
    height: 52,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  brandMarkImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },

  brandName: {
    fontFamily: TOKENS.fontDisplay,
    fontWeight: 800,
    fontSize: 24,
    textTransform: 'uppercase',
    lineHeight: 1,
    letterSpacing: 0.5,
  },

  brandSub: {
    fontFamily: TOKENS.fontBody,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 3,
    textTransform: 'uppercase',
    mt: 0.5,
    opacity: 0.8,
  },

  heroBlock: {
    position: 'relative',
    zIndex: 1,
    paddingBottom: 4,
    flexShrink: 0,
  },

  heroTitle: {
    fontFamily: TOKENS.fontDisplay,
    fontSize: 36,
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: 0.5,
    color: '#fff',
    textTransform: 'uppercase',
    mb: 2,
  },

  heroText: {
    fontFamily: TOKENS.fontBody,
    fontSize: 13.5,
    lineHeight: 1.6,
    color: 'rgba(255,255,255,.85)',
    maxWidth: 320,
  },

  heroDots: {
    display: 'flex',
    gap: 1,
    mt: 3,
  },

  heroDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,.3)',
  },

  heroDotActive: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: TOKENS.hlGold,
  },

  mobileHeader: {
    display: { xs: 'flex', md: 'none' },
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    pt: { xs: '36px', sm: '38px' },
    pb: { xs: '30px', sm: '32px' },
    px: { xs: 3, sm: 5 },
  },

  mobileBrandMark: {
    width: { xs: 84, sm: 96 },
    height: { xs: 56, sm: 64 },
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    mb: { xs: 1.5, sm: 2 },
  },

  mobileBrandName: {
    fontFamily: TOKENS.fontDisplay,
    fontWeight: 800,
    fontSize: { xs: 22, sm: 27 },
    color: '#fff',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    lineHeight: 1,
  },

  mobileBrandSub: {
    fontFamily: TOKENS.fontBody,
    fontSize: { xs: 9, sm: 10 },
    fontWeight: 600,
    color: TOKENS.hlCream,
    letterSpacing: 4,
    textAlign: 'center',
    textTransform: 'uppercase',
    opacity: 0.9,
    mt: 0.75,
  },

  formPanel: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    bgcolor: '#fff',
    minHeight: 0,
    padding: { xs: '30px 24px 34px', sm: '40px 48px 44px', md: '48px' },
    borderRadius: { xs: '26px 26px 0 0', sm: '26px 26px 0 0', md: '0 24px 24px 0' },
    position: 'relative',
    zIndex: 2,
    overflowY: { xs: 'visible', sm: 'visible', md: 'auto' },
    flex: 1,
    boxShadow: { xs: '0 -10px 30px rgba(0,0,0,.14)', sm: '0 -10px 30px rgba(0,0,0,.12)', md: 'none' },
  },

  formTitle: {
    fontFamily: TOKENS.fontDisplay,
    fontSize: { xs: 27, sm: 30, md: 32 },
    fontWeight: 800,
    color: TOKENS.hlBlueDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    mb: 1,
    textAlign: 'center',
  },

  formIntro: {
    fontSize: 13,
    color: TOKENS.gray5,
    mb: { xs: 3, sm: 3.5, md: 4 },
    textAlign: 'center',
    lineHeight: 1.5,
  },

  fieldLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: TOKENS.hlBlueDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    mb: 0.75,
  },

  fieldInput: {
    '& .MuiOutlinedInput-root': {
      borderRadius: '10px', // Softer inputs
      backgroundColor: TOKENS.gray1,
      transition: 'all 0.2s',
      '& fieldset': { borderColor: 'transparent' },
      '&:hover fieldset': { borderColor: TOKENS.gray3 },
      '&.Mui-focused': {
        backgroundColor: '#fff',
        boxShadow: `0 0 0 3px ${TOKENS.hlBlueTint}`,
        '& fieldset': { borderColor: TOKENS.hlBlue, borderWidth: 2 },
      },
    },
    '& input': { fontSize: 14, fontFamily: TOKENS.fontBody, fontWeight: 500 },
    '& .MuiInputBase-input': { py: 1.25 },
  },

  fieldIcon: { fontSize: 20, color: TOKENS.gray4 },

  forgotRow: { textAlign: 'right', mb: { xs: 2.5, sm: 3 } },

  forgotLink: {
    fontSize: 12,
    color: TOKENS.hlBlue,
    textDecoration: 'none',
    fontWeight: 600,
    transition: 'color 0.2s',
    '&:hover': { color: TOKENS.hlBlueDark, textDecoration: 'underline' },
  },

  submitBtn: {
    py: 1.5,
    borderRadius: '10px',
    fontSize: 14,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    boxShadow: '0 4px 12px rgba(27, 78, 122, 0.25)',
    transition: 'transform 0.1s, box-shadow 0.2s',
    '&:active': { transform: 'scale(0.98)' },
  },

  orRow: {
    display: 'flex',
    alignItems: 'center',
    my: 3,
  },

  orLabel: {
    fontSize: 10,
    color: TOKENS.gray4,
    mx: 2,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: 700,
  },

  oauthRow: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 2,
  },

  oauthBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1.5,
    height: 48,
    border: `1px solid ${TOKENS.lineSoft}`,
    borderRadius: '10px',
    backgroundColor: '#fff',
    color: TOKENS.ink,
    fontSize: 13.5,
    fontWeight: 600,
    fontFamily: TOKENS.fontBody,
    textTransform: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    width: '100%',
    '&:hover': {
      borderColor: TOKENS.gray4,
      backgroundColor: TOKENS.gray1,
    },
  },

  oauthIcon: {
    width: 20,
    height: 20,
    display: 'block',
    flexShrink: 0,
  },

  footNote: {
    fontSize: 11.5,
    color: TOKENS.gray4,
    textAlign: 'center',
    mt: { xs: 3, sm: 3.5 },
    lineHeight: 1.5,
  },
};

export default loginStyle;