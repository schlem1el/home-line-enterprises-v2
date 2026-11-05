const reportStyle = {
  content: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: { xs: '16px 14px 30px', sm: 'clamp(18px, 2.5vw, 30px) clamp(18px, 3vw, 40px) 40px' }
  },

  filterBar: {
    display: 'grid',
    gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) auto' },
    alignItems: 'start',
    gap: 1,
    marginBottom: '12px',
    '& > *': { minWidth: 0 }
  },

  filterGroup: {
    display: 'grid',
    gridTemplateColumns: {
      xs: 'minmax(0, 1fr)',
      sm: 'minmax(0, 1fr)',
      md: 'repeat(2, minmax(0, 1fr))',
      lg: 'repeat(auto-fit, minmax(150px, max-content))'
    },
    alignItems: 'center',
    gap: 1,
    '& > *': { minWidth: 0 },
    '& .MuiInputBase-root': { height: 34 },
    '& .MuiInputBase-input': { padding: '6px 10px' }
  },

  dateRangeGroup: {
    display: 'grid',
    gridColumn: 1,
    gridTemplateColumns: {
      xs: 'minmax(0, 1fr)',
      sm: 'minmax(0, 1fr)',
      md: 'repeat(2, minmax(0, 1fr))',
      lg: 'repeat(3, minmax(150px, 180px))'
    },
    alignItems: 'center',
    gap: 1,
    '& > *': { minWidth: 0 },
    '& .MuiInputBase-root': { height: 34 },
    '& .MuiInputBase-input': { padding: '6px 10px' }
  },

  actionGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 1,
    gridColumn: { xs: 1, lg: 2 },
    gridRow: { lg: '1 / span 2' },
    width: { xs: '100%', lg: 'auto' },
    marginLeft: { xs: 0, lg: 'auto' },
    '@media (max-width:899.95px)': {
      flexDirection: 'column',
      alignItems: 'stretch',
      width: '100%',
      '& > *': { width: '100%' }
    }
  },

  filterField: {
    width: '100%',
    minWidth: 0
  },

  btnSm: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
    width: { xs: '100%', md: 'auto' },
    minWidth: { sm: 120 },
    border: '1px solid #D9D0B4',
    borderRadius: '7px',
    padding: '0 10px',
    fontSize: 11,
    fontWeight: 500,
    fontFamily: '"Inter", sans-serif',
    backgroundColor: '#fff',
    color: '#0F3352',
    textTransform: 'none',
    boxShadow: 'none',
    lineHeight: 1.2,
    '&:hover': {
      backgroundColor: '#F7F3E6',
      borderColor: '#B8AE8C'
    },
    '& .MuiButton-startIcon': { marginRight: '8px' }
  },

  btnExport: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
    width: { xs: '100%', md: 'auto' },
    minWidth: { sm: 140 },
    border: '1.5px solid #1B4E7A',
    borderRadius: '7px',
    padding: '0 10px',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: '"Inter", sans-serif',
    backgroundColor: '#1B4E7A',
    color: '#fff',
    textTransform: 'none',
    lineHeight: 1.2,
    '&:hover': { backgroundColor: '#0F3352' },
    '& .MuiButton-startIcon': { marginRight: '8px' }
  },

  chartWrap: {
    marginBottom: '22px',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box'
  },

  sectionTitle: {
    fontFamily: '"Barlow Condensed", sans-serif',
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#0F3352',
    margin: '28px 0 12px',
    paddingLeft: 9,
    borderLeft: '3px solid #D89B2E'
  },

  tableWrap: {
    border: '1px solid #D9D0B4',
    borderRadius: '7px',
    overflow: 'auto',
    maxWidth: '100%'
  },

  wireTable: {
    width: '100%',
    minWidth: 0,
    borderCollapse: 'collapse',
    fontSize: 12.5,
    tableLayout: 'fixed',
    '& thead th': {
      fontSize: { xs: 9, sm: 9.5, md: 10.5 },
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: '#0F3352',
      fontWeight: 700,
      padding: { xs: '8px 5px', sm: '9px 7px', md: '10px 12px' },
      borderBottom: '1px solid #1B4E7A',
      backgroundColor: '#F7F3E6',
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
      verticalAlign: 'top',
    },
    '& td': {
      padding: { xs: '9px 5px', sm: '10px 7px', md: '12px' },
      borderBottom: '1px solid #D9D0B4',
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
      verticalAlign: 'top',
    },
    '& .MuiChip-root': { maxWidth: '100%', height: 'auto' },
    '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere' },
    '& tbody tr:hover': {
      backgroundColor: '#E3ECF4'
    }
  },

  thLeft: { textAlign: 'left' },
  thNum: { textAlign: 'right' },
  tdLeft: { textAlign: 'left' },
  tdNum: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
};

export default reportStyle;