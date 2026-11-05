import { sectionTitleTop, tableWrap, TOKENS } from './HomeLineStyles';

const style = {
  content: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    p: { xs: '16px 14px 30px', sm: 'clamp(18px, 2.5vw, 30px) clamp(18px, 3vw, 40px) 40px' }
  },

  filterBar: { display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3, alignItems: 'center' },
  grow: { flex: '1 1 340px', minWidth: 0, width: '100%', maxWidth: 460 },
  spacer: { ml: 'auto' },

  tableWrap,
  historyTable: { minWidth: 720 },
  actionsCol: { width: 70, textAlign: 'center' },
  actionsCell: { textAlign: 'center' },
  emptyCell: { textAlign: 'center', color: TOKENS.gray5, py: '32px' },
  tableHint: { fontSize: 11, color: TOKENS.gray5, mt: 1, textAlign: 'center' },

  /* Modal form */
  formStack: { display: 'flex', flexDirection: 'column', gap: 2, pt: 1 },

  /* Detail */
  sectionTitle: sectionTitleTop,
  infoLabel: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark, letterSpacing: 0.4, mb: 0.25 },
  infoValue: { fontSize: 13 }
};

export default style;