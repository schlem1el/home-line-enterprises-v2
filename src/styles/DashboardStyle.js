const dashboardStyle = {
  content: {
    width: '100%',
    minWidth: 0,
    overflowX: 'hidden',
    padding: { xs: '16px 14px 30px', sm: 'clamp(12px, 1.8vw, 18px) clamp(14px, 2.2vw, 24px) clamp(20px, 3vw, 32px)' }
  },

  grid4: {
    display: 'grid',
    gap: { xs: 1.5, sm: 'clamp(6px, 0.8vw, 10px)' },
    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
    gridAutoRows: 'min-content'
  },

  grid2: {
    display: 'grid',
    minWidth: 0,
    gap: { xs: 1.5, sm: 'clamp(6px, 0.8vw, 10px)' },
    gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
    gridAutoRows: 'min-content',
    marginTop: { xs: 1.5, sm: 'clamp(6px, 0.8vw, 10px)' }
  },

  panelsRow: {
    display: 'grid',
    gap: { xs: 1.5, sm: 'clamp(6px, 0.8vw, 10px)' },
    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
    marginTop: { xs: 1.5, sm: 'clamp(6px, 0.8vw, 10px)' }
  },

  statCard: {
    border: '1px solid #D9D0B4',
    borderTop: '3px solid #1B4E7A',
    borderRadius: '7px',
    backgroundColor: '#fff',
    padding: { xs: '16px 14px', sm: 'clamp(16px, 1.4vw, 22px) clamp(14px, 1.4vw, 18px)' },
    minHeight: { xs: 'auto', sm: 'clamp(110px, 9vw, 140px)' },
    display: 'flex',
    flexDirection: 'column',
    alignSelf: 'start',
    overflow: 'hidden'
  },

  statNum: {
    fontFamily: '"Barlow Condensed", sans-serif',
    fontSize: { xs: 22, sm: 'clamp(24px, 2vw, 30px)' }, // slightly smaller on mobile
    fontWeight: 700,
    letterSpacing: -0.3,
    color: '#0F3352',
    lineHeight: 1.05,
    margin: 0,
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden'
  },

  statLbl: {
    fontSize: { xs: 10, sm: 'clamp(9.5px, 0.75vw, 10.5px)' },
    color: '#6E6A55',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    lineHeight: 1.25,
    margin: 'auto 0 0 0'
  },

  statTrend: {
    fontSize: { xs: 10, sm: 'clamp(9.5px, 0.75vw, 10.5px)' },
    color: '#B27F1F',
    fontWeight: 600,
    lineHeight: 1.25,
    margin: '6px 0 0 0'
  },

  panel: {
    border: '1px solid #D9D0B4',
    borderRadius: '7px',
    backgroundColor: '#fff',
    padding: 'clamp(14px, 1.2vw, 18px)',
    display: 'flex',
    flexDirection: 'column',
    alignSelf: 'stretch',
    minHeight: { xs: 340, sm: 382 },
    boxSizing: 'border-box'
  },

  panelTitle: {
    fontFamily: '"Barlow Condensed", sans-serif',
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#0F3352',
    margin: '0 0 10px 0',
    paddingLeft: 9,
    borderLeft: '3px solid #D89B2E',
    lineHeight: 1.2
  },

  panelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 1.5,
    padding: '7px 0',
    minHeight: 62,
    boxSizing: 'border-box',
    borderBottom: '1px solid #F0EBDA',
    '&:last-of-type': { borderBottom: 'none' }
  },

  panelEmptySlot: {
    display: 'flex',
    alignItems: 'center',
    minHeight: 62,
    boxSizing: 'border-box',
    padding: '7px 0',
    borderBottom: '1px solid #F0EBDA',
    color: '#6E6A55',
    fontSize: 11,
    fontStyle: 'italic',
    '&:last-of-type': { borderBottom: 'none' }
  },

  panelRowName: {
    fontSize: 12.5,
    fontWeight: 600,
    color: '#0F3352',
    lineHeight: 1.25,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },

  panelRowMeta: {
    fontSize: 10.5,
    color: '#6E6A55',
    lineHeight: 1.25,
    marginTop: 2
  },

  panelRowValue: {
    fontSize: 12.5,
    fontWeight: 700,
    color: '#0F3352',
    textAlign: 'right',
    whiteSpace: 'nowrap'
  },

  panelRowValueSub: {
    fontSize: 10.5,
    color: '#6E6A55',
    fontWeight: 400,
    textAlign: 'right',
    whiteSpace: 'nowrap',
    marginTop: 2
  }
};

export default dashboardStyle;