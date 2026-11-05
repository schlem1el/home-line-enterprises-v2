import { sectionTitleTop, tableWrap, cellSubStyle, TOKENS } from './HomeLineStyles';

const style = {
  content: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    p: { xs: '16px 14px 30px', sm: 'clamp(18px, 2.5vw, 30px) clamp(18px, 3vw, 40px) 40px' }
  },

  filterBar: { display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3, alignItems: 'center' },
  grow: { flex: '1 1 340px', minWidth: 0, width: '100%', maxWidth: 460 },
  minWidth: { minWidth: 200 },

  tableWrap,
  historyTable: { minWidth: 800 },

  // INCREASED WIDTH & NOWRAP to fix the visual bug
  actionsCol: { width: 160, textAlign: 'center' },
  actionsCell: { textAlign: 'center', whiteSpace: 'nowrap' },

  emptyCell: { textAlign: 'center', color: TOKENS.gray5, py: '28px' },
  tableHint: { fontSize: 11, color: TOKENS.gray5, mt: 1, textAlign: 'center' },

  /* Edit / confirm modal */
  sectionTitle: sectionTitleTop,
  infoLabel: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark, letterSpacing: 0.4, mb: 0.25 },
  infoValue: { fontSize: 13 },
  cellSub: cellSubStyle,
  infoBlock: { mb: 1.5 },
  note: { mt: 1.5, fontSize: 12, lineHeight: 1.5, color: TOKENS.gray5 },
  actionsRow: { display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }
};

export default style;