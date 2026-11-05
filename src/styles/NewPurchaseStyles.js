import { card, sectionTitleTop, hintStyle, TOKENS } from './HomeLineStyles';

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

  supplierHint: { fontSize: 11, color: TOKENS.gray5, mb: 2 },

  itemFormRow: { display: 'flex', gap: 1.5 },
  itemActions: { display: 'flex', gap: 1, mt: 2 },

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

  payIntro: { fontSize: 11, color: TOKENS.gray5, mb: 1.5 },
  payRow: { display: 'flex', gap: 1.5, mb: 0 },
  payRowMt: { display: 'flex', gap: 1.5, mt: 1.5 },

  footerActions: { display: 'flex', flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: 'flex-end', gap: 1, mt: 2 },

  hint: hintStyle
};

export default style;