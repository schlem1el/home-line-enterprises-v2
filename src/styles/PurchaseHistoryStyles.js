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
      sm: 'minmax(150px, 1fr) auto auto auto auto auto'
    },
    gap: 2,
    mb: 3,
    alignItems: 'center',
    '& > *': { minWidth: 0 }
  },

  tableWrap: { ...tableWrap, maxWidth: '100%' },

  historyTable: {
    width: '100%',
    tableLayout: 'fixed',
    '& .MuiTableCell-root': {
      px: 1.5,
      py: 1.25,
      fontSize: '12px',
      verticalAlign: 'middle',
    },
    '& .MuiTableCell-head': { fontSize: '10.5px', fontWeight: 700, whiteSpace: 'nowrap' },
    '& .MuiTableCell-root:first-of-type': {
      paddingLeft: '16px',
    },
    '& .MuiTableCell-root:last-of-type': {
      paddingRight: '16px',
    }
  },

  idCol: { width: 105 },
  supplierCol: { width: 175, overflowWrap: 'anywhere' },
  dateCol: { width: 135, whiteSpace: 'nowrap' },
  totalCol: { width: 115, whiteSpace: 'nowrap' },
  paymentCol: { width: 140, whiteSpace: 'nowrap', textAlign: 'center' },
  receivingCol: { width: 135, whiteSpace: 'nowrap', textAlign: 'center' },
  statusCol: {
    width: 135,
    whiteSpace: 'nowrap',
    textAlign: 'left'
  },

  actionsCol: { width: 125, textAlign: 'center' },

  actionsCell: {
    width: 125,
    textAlign: 'center',
    whiteSpace: 'nowrap'
  },

  emptyCell: { textAlign: 'center', color: TOKENS.gray5, py: '28px' },
  tableHint: { fontSize: 11, color: TOKENS.gray5, mt: 1, textAlign: 'center' },

  sectionTitle: sectionTitleTop,
  detail: {
    tableWrap: { border: `1px solid ${TOKENS.lineSoft}`, borderRadius: 1, overflow: 'auto', mb: 2 },
    itemsTable: { minWidth: 460 },
    infoLabel: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark, letterSpacing: 0.4, mb: 0.25 },
    infoValue: { fontSize: 13 },
    cellSub: cellSubStyle,
    summaryRow: { display: 'flex', justifyContent: 'space-between', py: 0.5, fontSize: 13 },
    summaryRowBold: { display: 'flex', justifyContent: 'space-between', py: 0.5, fontSize: 13, fontWeight: 700, color: TOKENS.hlBlueDark },
    emptyCell: { textAlign: 'center', color: TOKENS.gray5, py: '28px' }
  },

  editInfo: { mb: 1.75 },
  editNote: { mt: 1, mb: 1.75, fontSize: 12, lineHeight: 1.5, color: TOKENS.gray5 }
};

export default style;