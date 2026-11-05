const chartBoxStyle = {
  card: {
    border: '1px solid #D9D0B4',
    borderRadius: '7px',
    backgroundColor: '#fff',
    padding: { xs: '12px 8px', sm: 'clamp(12px, 1.2vw, 16px) clamp(14px, 1.4vw, 18px) clamp(10px, 1vw, 14px)' },
    display: 'flex',
    flexDirection: 'column',
    alignSelf: 'start',
    height: 'fit-content',
    width: '100%',
    overflow: 'hidden',
    transition: 'border-color 180ms ease, box-shadow 180ms ease',
    '&:hover': {
      borderColor: '#B8AE8C',
      boxShadow: '0 5px 16px rgba(15, 51, 82, 0.08)'
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none'
    }
  },

  title: {
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

  chartArea: {
    display: 'flex',
    alignItems: 'flex-start',
    width: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },

  yAxis: {
    position: 'relative',
    flexShrink: 0
  },

  yTick: {
    position: 'absolute',
    right: 4,
    transform: 'translateY(50%)',
    fontFamily: '"Inter", sans-serif',
    fontSize: { xs: 8, sm: 10 },
    color: '#6E6A55',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    margin: 0
  },

  barValue: {
    fontFamily: '"Inter", sans-serif',
    fontSize: 10,
    fontWeight: 700,
    color: '#0F3352',
    margin: 0,
    marginBottom: '3px',
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
    transition: 'color 160ms ease, transform 160ms ease'
  },

  bar: {
    background: 'linear-gradient(180deg, #E6B34F 0%, #D89B2E 100%)',
    borderRadius: '4px 4px 1px 1px',
    minHeight: 2
  },

  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    color: '#6E6A55',
    fontSize: 12,
    fontStyle: 'italic'
  }
};

export default chartBoxStyle;