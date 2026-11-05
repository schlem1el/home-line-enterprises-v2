import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { keyframes } from '@emotion/react';
import chartBoxStyle from '../styles/ChartBoxStyle';
import { niceTicks } from '../utils/reportHelpers';

const H_DEFAULT = { bars: 252, labels: 22 };
const H_COMPACT = { bars: 232, labels: 22 };

const VALUE_LABEL_H = 14;
const LABEL_MARGIN = 3;
const CHART_TOP_GAP = 12;

const DEFAULT_MIN_BAR_W = 90;
const BAR_GAP = 8;
const barRise = keyframes`
  from { transform: scaleY(0.12); opacity: 0.55; }
  to { transform: scaleY(1); opacity: 1; }
`;

export default function ChartBox({
  title, data = [], axis, money = false, compact = false,
  scrollable = false, minBarWidth = DEFAULT_MIN_BAR_W
}) {
  const ticks = useMemo(() => {
    if (axis && axis.length > 1) return axis;
    const max = data.reduce((m, d) => Math.max(m, Number(d.value) || 0), 0);
    return niceTicks(max, 5);
  }, [axis, data]);

  const H = compact ? H_COMPACT : H_DEFAULT;
  const lastIndex = Math.max(1, ticks.length - 1);
  const maxTick = ticks[ticks.length - 1] || 1;
  const maxBarPx = Math.max(6, H.bars - VALUE_LABEL_H - LABEL_MARGIN - CHART_TOP_GAP);
  const hasData = data.some((d) => Number(d.value) > 0);

  const contentWidth =
    data.length * minBarWidth + Math.max(0, data.length - 1) * BAR_GAP;

  const fmt = (v) =>
    money ? `₱${Number(v).toLocaleString('en-PH')}` : Number(v).toLocaleString('en-PH');

  const barColSx = scrollable
    ? { flex: `1 0 ${minBarWidth}px`, minWidth: `${minBarWidth}px` }
    : { flex: 1, minWidth: 0 };
  const xLabelSx = scrollable
    ? { flex: `1 0 ${minBarWidth}px`, minWidth: `${minBarWidth}px` }
    : { flex: 1, minWidth: 0 };

  return (
    <Box sx={chartBoxStyle.card}>
      <Typography sx={chartBoxStyle.title}>{title}</Typography>

      {hasData ? (
        <Box sx={chartBoxStyle.chartArea}>
          {/* Y-axis — responsive width */}
          <Box sx={{ ...chartBoxStyle.yAxis, width: { xs: 44, sm: 56 }, height: H.bars }}>
            {ticks.map((tick, i) => (
              <Typography
                key={tick}
                sx={{
                  ...chartBoxStyle.yTick,
                  top: `${((lastIndex - i) / lastIndex) * (H.bars - 1)}px`,
                  transform: i === lastIndex
                    ? 'none'
                    : i === 0
                      ? 'translateY(-100%)'
                      : 'translateY(-50%)'
                }}
              >
                {fmt(tick)}
              </Typography>
            ))}
          </Box>

          {/* Scroll container */}
          <Box sx={{
            flex: 1,
            minWidth: 0,
            overflowX: scrollable ? 'auto' : 'hidden',
            overflowY: 'hidden',
            paddingBottom: scrollable ? '6px' : 0
          }}>
            <Box sx={{
              position: 'relative',
              ...(scrollable
                ? { width: `${contentWidth}px`, minWidth: '100%' }
                : { width: '100%' })
            }}>
              {/* Grid overlay */}
              <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: H.bars,
                pointerEvents: 'none',
                zIndex: 0,
                boxSizing: 'border-box',
                border: '1px solid #B8AE8C'
              }}>
                {ticks.map((tick, i) => (
                  <Box
                    key={tick}
                    sx={{
                      position: 'absolute',
                      left: 0,
                      width: '100%',
                      height: '1px',
                      backgroundColor: i === lastIndex ? '#B8AE8C' : '#ECE7D5',
                      top: `${((lastIndex - i) / lastIndex) * (H.bars - 1)}px`
                    }}
                  />
                ))}
              </Box>

              {/* Bars row */}
              <Box sx={{
                position: 'relative',
                zIndex: 1,
                height: H.bars,
                display: 'flex',
                alignItems: 'flex-end',
                gap: `${BAR_GAP}px`
              }}>
                {data.map((d, index) => {
                  const value = Number(d.value) || 0;
                  const px = Math.max(2, (value / maxTick) * maxBarPx);
                  return (
                    <Box
                      key={d.label}
                      sx={{
                        ...barColSx,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        borderRadius: '4px 4px 0 0',
                        transition: 'background-color 160ms ease',
                        '&:hover': { backgroundColor: 'rgba(27, 78, 122, 0.045)' },
                        '&:hover .chart-bar': {
                          transform: 'scaleX(1.12)',
                          filter: 'saturate(1.2) brightness(1.04)',
                          boxShadow: '0 2px 8px rgba(15, 51, 82, 0.22)'
                        },
                        '&:hover .chart-bar-value': {
                          color: '#1B4E7A',
                          transform: 'translateY(-2px)'
                        },
                        '@media (prefers-reduced-motion: reduce)': {
                          transition: 'none'
                        }
                      }}
                    >
                      <Typography className="chart-bar-value" sx={chartBoxStyle.barValue}>{fmt(value)}</Typography>
                      <Box
                        className="chart-bar"
                        title={`${d.title || d.label}: ${fmt(value)}`}
                        sx={{
                          width: '60%',
                          maxWidth: 30,
                          height: px,
                          transformOrigin: 'center bottom',
                          transition: 'transform 170ms ease, box-shadow 170ms ease'
                        }}
                      >
                        <Box
                          sx={{
                            ...chartBoxStyle.bar,
                            width: '100%',
                            height: '100%',
                            animation: `${barRise} 650ms cubic-bezier(0.2, 0.75, 0.25, 1) both`,
                            animationDelay: `${Math.min(index * 55, 440)}ms`,
                            '@media (prefers-reduced-motion: reduce)': {
                              animation: 'none'
                            }
                          }}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </Box>

              {/* X-axis labels */}
              <Box sx={{
                display: 'flex',
                gap: `${BAR_GAP}px`,
                height: H.labels,
                alignItems: 'center'
              }}>
                {data.map((d) => (
                  <Typography
                    key={d.label}
                    title={d.title || d.label}
                    sx={{
                      ...xLabelSx,
                      fontFamily: '"Inter", sans-serif',
                      fontSize: 10,
                      color: '#6E6A55',
                      margin: 0,
                      lineHeight: '20px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      textAlign: 'center',
                      transition: 'color 160ms ease',
                      '&:hover': { color: '#1B4E7A' }
                    }}
                  >
                    {d.label}
                  </Typography>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      ) : (
        <Box sx={{ ...chartBoxStyle.empty, height: H.bars + H.labels }}>
          No data for the selected filters.
        </Box>
      )}
    </Box>
  );
}