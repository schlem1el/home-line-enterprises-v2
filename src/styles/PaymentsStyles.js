import { sectionTitleTop, tableWrap, cellSubStyle, TOKENS } from './HomeLineStyles';

const style = {
  content: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    p: { xs: '16px 14px 30px', sm: 'clamp(18px, 2.5vw, 30px) clamp(18px, 3vw, 40px) 40px' }
  },

  filterBar: {
    display: 'grid',
    gridTemplateColumns: {
      xs: 'minmax(0, 1fr)',
      sm: 'minmax(0, 1fr)',
      md: 'minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr) 34px'
    },
    width: '100%',
    maxWidth: 1050,
    gap: 1,
    mb: 2,
    alignItems: 'center',
    '& > *': { minWidth: 0 },
    '& .MuiInputBase-root': { height: 34 },
    '& .MuiInputBase-input': { padding: '6px 10px' }
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    flexDirection: { xs: 'column', sm: 'row' },
    alignItems: { xs: 'stretch', sm: 'center' },
    gap: 2
  },
  grow: {
    width: '100%'
  },
  minWidth: {
    width: '100%'
  },

  tableWrap: { ...tableWrap, maxWidth: '100%' },

  // Updated table to compress on tablets without horizontal scroll
  historyTable: {
    width: '100%',
    tableLayout: 'fixed',
    '& .MuiTableCell-root': {
      padding: '10px 12px',
      fontSize: '11px',
      whiteSpace: 'normal',
      wordBreak: 'break-word',
    },
    '& .MuiTableCell-root:first-of-type': {
      paddingLeft: '16px',
    },
    '& .MuiTableCell-root:last-of-type': {
      paddingRight: '16px',
    }
  },

  emptyCell: { textAlign: 'center', color: TOKENS.gray5, py: '28px' },
  tableHint: { fontSize: 11, color: TOKENS.gray5, mt: 1, textAlign: 'center' },

  sectionTitle: sectionTitleTop,
  sectionTitleWithAction: { ...sectionTitleTop, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' },
  infoLabel: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark, letterSpacing: 0.4, mb: 0.25 },
  infoValue: { fontSize: 13 },
  infoBlock: { mb: 1.5 },
  cellSub: cellSubStyle,
  detailTable: { border: `1px solid ${TOKENS.lineSoft}`, borderRadius: 1, overflow: 'auto', mb: 2 },
  detailTableInner: { minWidth: 460 },
  note: { fontSize: 11, color: TOKENS.gray5, mt: 1 },

  paySummary: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '14px 20px', margin: '4px 0 16px', padding: '12px 14px',
    background: TOKENS.gray1, border: `1px solid ${TOKENS.lineSoft}`, borderRadius: 1
  },
  formStack: { display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }
};

export default style;