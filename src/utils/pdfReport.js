// src/utils/pdfReport.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '../images/home-line-logo.png';
import { fmtDate, fmtSaleId, pesoPdf, round2 } from './format';
import { PAYMENT_CONFIRMATION_PENDING_LABEL } from './businessRules';

const BRAND = {
  blue: [27, 78, 122],
  blueDark: [15, 51, 82],
  gold: [216, 155, 46],
  cream: [244, 238, 217],
  gray: [110, 106, 85],
  grayLight: [240, 235, 218],
  ink: [23, 36, 29],
};

const COMPANY = {
  name: 'HOME LINE ENTERPRISES',
  tagline: 'Sales & Inventory Management',
  address: 'Pandi, Bulacan, Philippines',
};

async function loadLogo() {
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function defaultSubtitle(filters, rowCount) {
  if (filters.length) return `${filters.map(([k, v]) => `${k}: ${v}`).join('  ·  ')}`;
  return `${rowCount} record${rowCount === 1 ? '' : 's'}`;
}

/* Compute proportional column widths from per-column weights.
   Ensures no column drops below minColWidth by borrowing from wider ones. */
function computeColumnWidths(columns, totalWidth, minColWidth = 30) {
  const weights = columns.map((c) => Math.max(0.1, Number(c.weight) || 1));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / sumW) * totalWidth);

  let deficit = 0;
  raw.forEach((w, i) => {
    if (w < minColWidth) {
      deficit += minColWidth - w;
      raw[i] = minColWidth;
    }
  });
  if (deficit > 0) {
    const donors = raw
      .map((w, i) => ({ i, w }))
      .filter((x) => x.w > minColWidth)
      .sort((a, b) => b.w - a.w);
    let remaining = deficit;
    for (const d of donors) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, d.w - minColWidth);
      raw[d.i] -= take;
      remaining -= take;
    }
  }
  return raw;
}

export async function generatePdfReport({
  title = 'Report',
  subtitle = '',
  filters = [],
  columns = [],
  rows = [],
  totals = [],
  filename = 'report',
  landscape = false,
  preparedBy = '',
}) {
  const doc = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const tableWidth = pageW - margin * 2;

  /* ---------- Header band ---------- */
  doc.setFillColor(...BRAND.blue);
  doc.rect(0, 0, pageW, 90, 'F');
  doc.setFillColor(...BRAND.gold);
  doc.rect(0, 90, pageW, 4, 'F');

  const logo = await loadLogo();
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margin, 25, 58, 38, undefined, 'FAST');
    } catch { /* ignore */ }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(COMPANY.name, margin + 65, 36);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(244, 238, 217);
  doc.text(COMPANY.tagline, margin + 65, 50);
  doc.text(COMPANY.address, margin + 65, 63);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), pageW - margin, 36, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(244, 238, 217);
  const nowStr = new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  doc.text(`Generated: ${nowStr}`, pageW - margin, 50, { align: 'right' });
  doc.text(
    subtitle || defaultSubtitle(filters, rows.length),
    pageW - margin, 63, { align: 'right' }
  );

  /* ---------- Filters strip ---------- */
  let cursorY = 112;
  if (filters.length) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND.blueDark);
    doc.text('FILTERS APPLIED', margin, cursorY);

    cursorY += 12;
    doc.setFont('helvetica', 'normal');
    let x = margin;
    const lineH = 12;
    const maxW = tableWidth;

    filters.forEach(([label, value]) => {
      const text = `${label}: ${value}`;
      const w = doc.getTextWidth(text) + 14;
      if (x + w > margin + maxW) { x = margin; cursorY += lineH + 4; }
      doc.setFillColor(...BRAND.grayLight);
      doc.roundedRect(x, cursorY - 8, w, 14, 3, 3, 'F');
      doc.setTextColor(...BRAND.blueDark);
      doc.text(text, x + 7, cursorY + 2);
      x += w + 6;
    });
    cursorY += 22;
  } else {
    cursorY += 6;
  }

  /* ---------- Table ---------- */
  const head = [columns.map((c) => c.label)];
  const body = rows.map((r) => columns.map((c) => {
    const v = c.pdf ? c.pdf(r[c.key]) : r[c.key];
    return v === undefined || v === null || v === '' ? '—' : String(v);
  }));

  const widths = computeColumnWidths(columns, tableWidth);
  const colStyles = {};
  columns.forEach((c, i) => {
    colStyles[i] = {
      halign: c.align || (c.num ? 'right' : 'left'),
      cellWidth: widths[i],
    };
  });

  autoTable(doc, {
    head,
    body,
    startY: cursorY,
    margin: { left: margin, right: margin, bottom: 80 },
    theme: 'grid',
    tableWidth,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 4,
      lineColor: BRAND.grayLight,
      lineWidth: 0.5,
      textColor: BRAND.ink,
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: {
      fillColor: BRAND.blue,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: 5,
    },
    alternateRowStyles: {
      fillColor: [250, 248, 240],
    },
    columnStyles: colStyles,
    didDrawPage: () => {
      const pageNum = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.gray);
      doc.text(`${COMPANY.name}  ·  ${title}`, margin, pageH - 20);
      doc.text(`Page ${pageNum}`, pageW - margin, pageH - 20, { align: 'right' });
      doc.setDrawColor(...BRAND.gold);
      doc.setLineWidth(0.5);
      doc.line(margin, pageH - 30, pageW - margin, pageH - 30);
    },
  });

  /* ---------- Summary / Totals box ---------- */
  if (totals.length) {
    const tableBottom = doc.lastAutoTable.finalY + 18;

    const boxW = 220;
    const boxX = pageW - margin - boxW;
    const headerH = 20;
    const rowH = 14;
    const grandH = 20;
    const dividerGap = 6;

    const totalRowsH = (totals.length - 1) * rowH;
    const boxH = headerH + dividerGap + totalRowsH + (totals.length > 1 ? dividerGap : 0) + grandH;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...BRAND.gold);
    doc.setLineWidth(0.75);
    doc.roundedRect(boxX, tableBottom, boxW, boxH, 3, 3, 'FD');

    doc.setFillColor(...BRAND.blue);
    doc.roundedRect(boxX, tableBottom, boxW, headerH, 3, 3, 'F');
    doc.rect(boxX, tableBottom + headerH - 4, boxW, 4, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('SUMMARY', boxX + 10, tableBottom + 13);

    let ty = tableBottom + headerH + dividerGap + 10;
    totals.slice(0, -1).forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...BRAND.gray);
      doc.text(String(label), boxX + 10, ty);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...BRAND.blueDark);
      doc.text(String(value), boxX + boxW - 10, ty, { align: 'right' });
      ty += rowH;
    });

    if (totals.length > 1) {
      doc.setDrawColor(...BRAND.gold);
      doc.setLineWidth(0.5);
      doc.line(boxX + 8, ty - rowH + 3, boxX + boxW - 8, ty - rowH + 3);
    }

    const grandY = tableBottom + boxH - grandH;
    doc.setFillColor(...BRAND.cream);
    doc.rect(boxX + 1, grandY, boxW - 2, grandH - 1, 'F');

    const [gLabel, gValue] = totals[totals.length - 1];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND.blueDark);
    doc.text(String(gLabel).toUpperCase(), boxX + 10, grandY + grandH - 7);
    doc.setFontSize(10);
    doc.text(String(gValue), boxX + boxW - 10, grandY + grandH - 7, { align: 'right' });

    doc.setDrawColor(...BRAND.gold);
    doc.setLineWidth(0.75);
    doc.roundedRect(boxX, tableBottom, boxW, boxH, 3, 3, 'S');
  }

  /* ---------- Signature block (Prepared by) ---------- */
  const sigY = pageH - 80;
  if (doc.lastAutoTable.finalY < sigY - 40) {
    const lineW = 200;
    doc.setDrawColor(...BRAND.ink);
    doc.setLineWidth(0.5);
    doc.line(margin, sigY, margin + lineW, sigY);

    const name = preparedBy || '—';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.blueDark);
    doc.text(name, margin + lineW / 2, sigY - 6, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.gray);
    doc.text('Prepared by', margin + lineW / 2, sigY + 12, { align: 'center' });
  }

  const safeName = `${filename}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(safeName);
}

export async function generateSaleReceipt({
  sale,
  customer = null,
  lines = [],
  products = new Map(),
  payments = [],
  amountReceived = null,
  change = null,
  delivery = null,
  filename = '',
}) {
  const receiptWidth = 58 * 2.83465;
  const receiptHeight = Math.max(390, 340 + lines.length * 36
    + (delivery?.scheduled_delivery_date ? 18 : 0)
    + (amountReceived !== null ? 14 : 0));
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [receiptWidth, receiptHeight] });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 10;
  const contentW = pageW - margin * 2;
  const logo = await loadLogo();

  if (logo) {
    try {
      doc.addImage(logo, 'PNG', (pageW - 32) / 2, 12, 32, 20, undefined, 'FAST');
    } catch { /* logo is optional */ }
  }
  doc.setTextColor(...BRAND.blueDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(COMPANY.name, pageW / 2, 47, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(...BRAND.gray);
  doc.text(COMPANY.tagline, pageW / 2, 57, { align: 'center' });
  doc.text(COMPANY.address, pageW / 2, 66, { align: 'center' });

  let y = 82;
  doc.setDrawColor(...BRAND.grayLight);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  y += 12;
  doc.setTextColor(...BRAND.blueDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('SALES RECEIPT', pageW / 2, y, { align: 'center' });
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(...BRAND.gray);
  doc.text(`Receipt: ${fmtSaleId(sale.sale_id)}`, margin, y);
  doc.text(`${fmtDate(sale.sale_date)}${sale.sale_time ? ` ${sale.sale_time}` : ''}`, pageW - margin, y, { align: 'right' });
  y += 11;
  doc.text(`Customer: ${customer?.customer_name || 'Walk-in Customer'}`, margin, y);
  doc.text(`Type: ${sale.sale_type || 'Sale'}`, pageW - margin, y, { align: 'right' });
  y += 16;

  const body = lines.map((line) => {
    const product = products instanceof Map ? products.get(Number(line.product_id)) : products(Number(line.product_id));
    return [
      `${line.quantity} x ${product?.product_name || `Product ${line.product_id}`}`,
      pesoPdf(line.subtotal),
    ];
  });
  autoTable(doc, {
    head: [['ITEM', 'AMOUNT']],
    body,
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 6.5,
      cellPadding: { top: 2.5, right: 0, bottom: 2.5, left: 0 },
      textColor: BRAND.ink,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: BRAND.gray,
      fontStyle: 'bold',
      fontSize: 5.8,
      cellPadding: { top: 2, right: 0, bottom: 2, left: 0 },
      lineColor: BRAND.grayLight,
    },
    columnStyles: {
      0: {
        cellWidth: contentW * 0.62,
        overflow: 'linebreak',
      },
      1: {
        halign: 'right',
        cellWidth: contentW * 0.38,
        overflow: 'linebreak',
      },
    },
  });

  y = doc.lastAutoTable.finalY + 9;
  const subtotal = round2(lines.reduce((sum, line) => sum + (Number(line.subtotal) || 0), 0));
  const summaryRows = [
    ['Subtotal', pesoPdf(subtotal)],
    ['Discount', `- ${pesoPdf(sale.discount_amount)}`],
  ];
  if (Number(sale.delivery_fee) > 0) summaryRows.push(['Delivery Fee', pesoPdf(sale.delivery_fee)]);
  if (sale.payment_confirmation?.status === 'Pending Confirmation') {
    summaryRows.push(
      ['Payment Method', sale.payment_confirmation.payment_method],
      ['Payment Confirmation', `${PAYMENT_CONFIRMATION_PENDING_LABEL} (${pesoPdf(sale.payment_confirmation.amount)})`]
    );
  } else if (payments[0]?.payment_method) {
    summaryRows.push(['Payment Method', payments[0].payment_method]);
  }
  summaryRows.push(['Total', pesoPdf(sale.total_amount)]);
  const receiptAmountReceived = amountReceived ?? sale.amount_received ?? null;
  const receiptChange = change ?? sale.change_amount ?? 0;
  if (receiptAmountReceived !== null) {
    summaryRows.push(
      ['Amount Received', pesoPdf(receiptAmountReceived)],
      ['Change', pesoPdf(receiptChange)]
    );
  }
  const boxH = summaryRows.length * 15 + 8;
  doc.setDrawColor(...BRAND.grayLight);
  doc.line(margin, y, pageW - margin, y);
  summaryRows.forEach(([label, value], index) => {
    const rowY = y + 13 + index * 15;
    const emphasized = label === 'Total' || label === 'Change';
    doc.setFont('helvetica', emphasized ? 'bold' : 'normal');
    doc.setFontSize(label === 'Total' ? 8 : 6.5);
    doc.setTextColor(...(emphasized ? BRAND.blueDark : BRAND.gray));
    doc.text(label, margin, rowY);
    doc.text(value, pageW - margin, rowY, { align: 'right' });
  });
  y += boxH + 9;

  y += 3;
  if (delivery?.scheduled_delivery_date) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...BRAND.gray);
    doc.text(`Scheduled delivery: ${fmtDate(delivery.scheduled_delivery_date)}`, pageW / 2, y, { align: 'center' });
    y += 12;
  }

  doc.setDrawColor(...BRAND.grayLight);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...BRAND.blueDark);
  doc.text('Thank you for your purchase.', pageW / 2, y + 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.6);
  doc.setTextColor(...BRAND.gray);
  doc.text('This is a computer-generated receipt.', pageW / 2, y + 22, { align: 'center' });
  doc.text('Please retain it for your records.', pageW / 2, y + 31, { align: 'center' });

  const safeName = `${filename || `receipt-${fmtSaleId(sale.sale_id).toLowerCase()}`}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(safeName);
}