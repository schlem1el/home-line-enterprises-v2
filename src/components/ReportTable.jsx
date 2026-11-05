import React from 'react';
import { Box } from '@mui/material';
import reportStyle from '../styles/ReportStyle';

export default function ReportTable({
  columns, rows, sortKey, sortDir, onSort, ariaLabel = 'Data table',
  onRowOpen,
  minWidth = 0
}) {
  return (
    <Box sx={reportStyle.tableWrap}>
      <Box
        component="table"
        sx={{ ...reportStyle.wireTable, minWidth }}
        aria-label={ariaLabel}
      >
        <Box component="thead">
          <Box component="tr">
            {columns.map((c) => {
              const active = onSort && sortKey === c.key;
              const arrow = active ? (sortDir === 'asc' ? '▲' : '▼') : (onSort ? '↕' : '');
              return (
                <Box
                  component="th"
                  key={c.key}
                  scope="col"
                  onClick={onSort ? () => onSort(c.key) : undefined}
                  sx={{
                    ...(c.num ? reportStyle.thNum : reportStyle.thLeft),
                    ...(onSort ? { cursor: 'pointer', userSelect: 'none' } : {})
                  }}
                >
                  {c.label}
                  {onSort && (
                    <Box component="span" sx={{ fontSize: 9, ml: '6px', color: active ? '#B27F1F' : '#B8AE8C' }}>
                      {arrow}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
        <Box component="tbody">
          {rows.length === 0 ? (
            <Box component="tr">
              <Box component="td" colSpan={columns.length} sx={{ ...reportStyle.tdLeft, textAlign: 'center', color: '#6E6A55', py: '28px' }}>
                No rows for the selected filters.
              </Box>
            </Box>
          ) : rows.map((r, i) => (
            <Box
              component="tr"
              key={r._key ?? i}
              tabIndex={onRowOpen ? 0 : undefined}
              onDoubleClick={onRowOpen ? () => onRowOpen(r) : undefined}
              onKeyDown={onRowOpen ? (e) => { if (e.key === 'Enter') { e.preventDefault(); onRowOpen(r); } } : undefined}
              sx={{
                cursor: onRowOpen ? 'pointer' : 'default',
                '&:hover': onRowOpen ? { backgroundColor: '#E3ECF4' } : {}
              }}
            >
              {columns.map((c) => (
                <Box
                  component="td"
                  key={c.key}
                  sx={c.num ? reportStyle.tdNum : reportStyle.tdLeft}
                >
                  {c.format ? c.format(r[c.key]) : r[c.key]}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}