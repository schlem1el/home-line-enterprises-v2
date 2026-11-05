import { card, sectionTitleTop, hintStyle } from './HomeLineStyles';
import { TOKENS } from './HomeLineStyles';

const style = {
  pageContent: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    p: { xs: '16px 14px 30px', sm: 'clamp(18px, 2.5vw, 30px) clamp(18px, 3vw, 40px) 40px' }
  },
  grid: {
    display: 'grid',
    minWidth: 0,
    gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
    gap: 2,
    alignItems: 'start',
    '& > *': { minWidth: 0 }
  },

  card,
  cardMt: { ...card, mt: 2 },
  sectionTitle: sectionTitleTop,

  toggleGroup: { mb: 2 },
  toggleBtn: {
    textTransform: 'none',
    fontSize: 12,
    fontWeight: 600,
    borderColor: TOKENS.hlBlue,
    color: TOKENS.hlBlueDark,
    '&:hover': {
      backgroundColor: TOKENS.hlBlueTint,
      color: TOKENS.hlBlueDark,
      borderColor: TOKENS.hlBlue
    },
    '&.Mui-selected': {
      backgroundColor: TOKENS.hlBlue,
      color: '#fff',
      borderColor: TOKENS.hlBlue
    },
    '&.Mui-selected:hover': {
      backgroundColor: TOKENS.hlBlueDark,
      color: '#fff',
      borderColor: TOKENS.hlBlueDark
    },
    '&.Mui-selected.Mui-focusVisible': {
      backgroundColor: TOKENS.hlBlue,
      color: '#fff'
    }
  },

  infoBox: {
    background: TOKENS.gray1,
    border: `1px solid ${TOKENS.lineSoft}`,
    borderLeft: `3px solid ${TOKENS.hlGold}`,
    borderRadius: TOKENS.radius,
    p: '10px 12px',
    mb: 2,
    fontSize: 12,
    lineHeight: 1.5,
    color: TOKENS.gray5
  },

  tableWrap: {
    border: `1px solid ${TOKENS.lineSoft}`,
    borderRadius: 1,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflowX: 'auto',
    overflowY: 'hidden',
    WebkitOverflowScrolling: 'touch'
  },
  itemsTable: { minWidth: 460 },
  emptyCell: { textAlign: 'center', color: TOKENS.gray5, py: 4 },

  summaryBox: { mt: 2, pt: 1.5, borderTop: `1px solid ${TOKENS.lineSoft}` },
  summaryRow: { display: 'flex', justifyContent: 'space-between', py: 0.5, fontSize: 13 },
  summaryTotal: {
    display: 'flex', justifyContent: 'space-between', py: 1, mt: 1, pt: 1.25,
    borderTop: `1.5px solid ${TOKENS.hlBlue}`,
    fontFamily: TOKENS.fontDisplay, fontSize: { xs: 18, sm: 22 }, fontWeight: 700,
    color: TOKENS.hlBlueDark
  },

  footerActions: { display: 'flex', flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: 'flex-end', gap: 1, mt: 3 },
  hint: hintStyle
};

export default style;