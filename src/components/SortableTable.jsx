import React from 'react';
import { Box, Table, TableHead, TableRow, TableCell, TableBody, Typography, Button } from '@mui/material';
import { TOKENS } from '../styles/HomeLineStyles';

export default function SortableTable({
  columns, rows, sortKey, sortDir, onSort, renderRow, onRowOpen,
  minWidth = 720, emptyMessage = 'No records match.', onClearFilters
}) {
  return (
    <>
      <Box sx={{ border: `1px solid ${TOKENS.lineSoft}`, borderRadius: `${TOKENS.radius}px`, overflow: 'auto' }}>
        <Table sx={{ minWidth }}>
          <TableHead>
            <TableRow>
              {columns.map((c) => {
                const active = sortKey === c.key;
                const arrow = active ? (sortDir === 'asc' ? '▲' : '▼') : '↕';
                return (
                  <TableCell key={c.key} align={c.num ? 'right' : 'left'}
                    aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => onSort && onSort(c.key)}
                    sx={{ cursor: onSort ? 'pointer' : 'default', userSelect: 'none' }}>
                    {c.label}
                    <Box component="span" sx={{
                      fontSize: 9, ml: '6px',
                      color: active ? TOKENS.hlGoldDark : TOKENS.gray4
                    }}>{arrow}</Box>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ color: TOKENS.gray5, py: '28px' }}>
                  {emptyMessage}{' '}
                  {onClearFilters && <Button size="small" onClick={onClearFilters}>Clear filters</Button>}
                </TableCell>
              </TableRow>
            ) : rows.map((row, i) => (
              <TableRow key={row._key || i} hover tabIndex={0}
                onDoubleClick={() => onRowOpen && onRowOpen(row)}
                onKeyDown={(e) => { if (e.key === 'Enter' && onRowOpen) { e.preventDefault(); onRowOpen(row); } }}
                sx={{ cursor: onRowOpen ? 'pointer' : 'default' }}>
                {renderRow(row)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {onRowOpen && (
        <Typography sx={{ fontSize: 11, color: TOKENS.gray5, mt: '8px' }}>
          Double-click a row to view the full record.
        </Typography>
      )}
    </>
  );
}