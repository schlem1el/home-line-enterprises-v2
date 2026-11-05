import { sectionTitleTop, tableWrap, cellSubStyle, TOKENS } from './HomeLineStyles';

const style = {
  content: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    p: { xs: '16px 14px 30px', sm: 'clamp(18px, 2.5vw, 30px) clamp(18px, 3vw, 40px) 40px' }
  },

  filterBar: { display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 2, mb: 3 },
  filterRow: { display: 'flex', flexWrap: 'wrap', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 2 },
  grow: { width: '100%', maxWidth: { xs: '100%', sm: 460 } },
  minWidth: { width: { xs: '100%', sm: 'auto' }, minWidth: { xs: '100%', sm: 180 } },

  tableWrap: { ...tableWrap, maxWidth: '100%' },
  historyTable: {
    tableLayout: 'fixed',
    '& .MuiTableCell-root': {
      px: 1.5,
      py: 1.25,
      fontSize: '12px',
      verticalAlign: 'middle'
    },
    '& .MuiTableCell-head': {
      fontSize: '10.5px',
      fontWeight: 700,
      whiteSpace: 'nowrap'
    }
  },
  idCol: { width: 100 },
  customerCol: { width: 185 },
  dateCol: { width: 135, whiteSpace: 'nowrap' },
  paymentCol: { width: 160, whiteSpace: 'nowrap', textAlign: 'center' },
  totalCol: { width: 115, whiteSpace: 'nowrap' },
  statusCol: {
    width: 150,
    pl: 2,
    whiteSpace: 'nowrap',
  },
  actionsCol: { width: 145, textAlign: 'center' },
  actionsCell: { width: 145, whiteSpace: 'nowrap', textAlign: 'center' },
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

  paySummary: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '14px 20px', margin: '4px 0 16px', padding: '12px 14px', background: TOKENS.gray1, border: `1px solid ${TOKENS.lineSoft}`, borderRadius: 1 },
  formStack: { display: 'flex', flexDirection: 'column', gap: 2, pt: 1 },
  cancelIntro: { mb: 1.75, fontSize: 13, lineHeight: 1.5 },
  cancelNote: { mt: 2, mb: 1.75, fontSize: 12, lineHeight: 1.5, color: TOKENS.gray5 }
};

export default style;