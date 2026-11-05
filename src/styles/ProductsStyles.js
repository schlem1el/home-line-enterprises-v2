import { sectionTitleTop, tableWrap, cellSubStyle, TOKENS } from './HomeLineStyles';

const style = {
  content: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    p: { xs: '16px 14px 30px', sm: 'clamp(18px, 2.5vw, 30px) clamp(18px, 3vw, 40px) 40px' }
  },

  searchFilterBar: {
    display: 'grid',
    gridTemplateColumns: {
      xs: 'minmax(0, 1fr)',
      sm: 'repeat(2, minmax(0, 1fr))',
      md: 'minmax(200px, 1fr) auto auto auto auto'
    },
    gap: 2,
    mb: 3,
    alignItems: 'center',
    '& > *': { minWidth: 0 }
  },
  grow: { flex: '1 1 340px', minWidth: 0, width: '100%', maxWidth: 460 },
  spacer: { ml: 'auto' },

  tableWrap,
  table: { minWidth: 780 },
  emptyCell: { textAlign: 'center', color: TOKENS.gray5, py: '32px' },
  tableHint: { fontSize: 11, color: TOKENS.gray5, mt: 1, textAlign: 'center' },
  inactivePill: { ml: 1 },
  cellSub: cellSubStyle,

  /* Modal — product form */
  formStack: { display: 'flex', flexDirection: 'column', gap: 2, pt: 1 },
  formRow: { display: 'flex', gap: 2 },
  selectRow: { display: 'flex', gap: 1, alignItems: 'stretch' },
  addCategoryBtn: { whiteSpace: 'nowrap' },
  categorySectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: TOKENS.hlBlueDark,
    borderLeft: `3px solid ${TOKENS.hlGold}`,
    pl: 1,
    mb: 1
  },
  categoryList: {
    maxHeight: { xs: 'min(35dvh, 280px)', sm: 'min(40dvh, 360px)' },
    overflowY: 'auto',
    overscrollBehaviorY: 'contain',
    pr: 0.5
  },

  /* Detail modal */
  sectionTitle: sectionTitleTop,
  infoLabel: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark, letterSpacing: 0.4, mb: 0.25 },
  infoValue: { fontSize: 13 },
  descBox: {
    background: TOKENS.gray1, border: `1px solid ${TOKENS.gray2}`,
    borderRadius: 1, p: 1.5, fontSize: 13, mb: 2, whiteSpace: 'pre-line'
  },
  descEmpty: { color: TOKENS.gray5, fontStyle: 'italic' }
};

export default style;