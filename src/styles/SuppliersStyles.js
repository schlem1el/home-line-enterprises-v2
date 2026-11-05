import { sectionTitleTop, sectionTitle, tableWrap, cellSubStyle, TOKENS } from './HomeLineStyles';

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
  historyTable: { minWidth: 780 },
  actionsCol: { width: 70, textAlign: 'center' },
  actionsCell: { textAlign: 'center' },
  emptyCell: { textAlign: 'center', color: TOKENS.gray5, py: '32px' },
  tableHint: { fontSize: 11, color: TOKENS.gray5, mt: 1, textAlign: 'center' },

  /* Modal form (Add Supplier) */
  formStack: { display: 'flex', flexDirection: 'column', gap: 2, pt: 1 },
  formRow: { display: 'flex', gap: 2 },

  /* Edit Supplier modal */
  sectionTitle: sectionTitleTop,
  sectionTitleWithAction: { ...sectionTitle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mt: 3 },
  supplierInfo: {
    display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
    minWidth: 0,
    gap: '16px 28px'
  },
  supplierInfoReadOnly: {
    display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
    minWidth: 0,
    gap: '16px 28px',
    p: '16px 18px', background: TOKENS.gray1,
    border: `1px solid ${TOKENS.lineSoft}`, borderRadius: `${TOKENS.radius}px`
  },
  infoLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: TOKENS.hlBlueDark, letterSpacing: 0.4, mb: 0.5 },
  infoValue: { fontSize: 14, fontWeight: 500, lineHeight: 1.5, overflowWrap: 'anywhere' },
  supplierName: { fontSize: 16, fontWeight: 700, color: TOKENS.hlBlueDark },
  wide: { gridColumn: '1 / -1' },
  editFieldGroup: { mb: 0 },
  supplierLinksTable: { minWidth: 460 },
  cellSub: cellSubStyle,

  /* Sub-modal for supplier products */
  formStackTight: { display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }
};

export default style;