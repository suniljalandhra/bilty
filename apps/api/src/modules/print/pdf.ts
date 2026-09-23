import PDFDocument from 'pdfkit';
import { join } from 'node:path';
import type { BiltyRecord, BiltyLayoutId, CompanySnapshot } from '@bilty/shared-types';
import { z } from 'zod';
import { printData } from '../bilty/domain';
import { validInlineLogo } from '../company/logo';
import { renderPanelLayout } from './a4-panels';
import { DEFAULT_LAYOUT } from '../bilty/validation';

export const printOptions = z.strictObject({
  format: z.literal('a4').default('a4'),
  copy: z.enum(['consignor', 'consignee', 'driver', 'office']).default('office'),
});
export type PrintOptions = z.infer<typeof printOptions>;

const money = (v: number | null) => (v === null ? '' : `${(v / 100).toFixed(2)}`);
const clean = (v: string) => v.replace(/[—–]/g, '-');

type LayoutBox = { name: string; top: number; bottom: number };

export { LAYOUT_META } from '@bilty/shared-types';

export function a4GridLayout(contentWidth: number) {
  const paymentWidth = 135;
  const paymentGap = 5;
  const routeWidth = 190;
  const partyWidth = 500;
  return {
    paymentWidth,
    paymentGap,
    tableWidth: contentWidth - paymentGap - paymentWidth,
    partyWidth,
    routeWidth,
    partyMetaWidth: contentWidth - partyWidth - routeWidth,
  };
}

export function a4Layout(): Record<
  | 'header'
  | 'identity'
  | 'details'
  | 'consignor'
  | 'consignee'
  | 'goods'
  | 'total'
  | 'terms'
  | 'signatures'
  | 'footer',
  LayoutBox
> {
  return {
    header: { name: 'header', top: 20, bottom: 95 },
    identity: { name: 'identity', top: 95, bottom: 185 },
    details: { name: 'details', top: 185, bottom: 280 },
    consignor: { name: 'consignor', top: 282, bottom: 322 },
    consignee: { name: 'consignee', top: 322, bottom: 362 },
    goods: { name: 'goods', top: 364, bottom: 474 },
    total: { name: 'total', top: 479, bottom: 509 },
    terms: { name: 'terms', top: 509, bottom: 539 },
    signatures: { name: 'signatures', top: 539, bottom: 574 },
    footer: { name: 'footer', top: 582, bottom: 592 },
  };
}

export async function renderBiltyPdf(
  record: BiltyRecord,
  options: PrintOptions,
  draftCompany?: CompanySnapshot,
): Promise<Buffer> {
  const c = record.companySnapshot ?? draftCompany;
  // Select layout based on frozen company snapshot or draft company
  const layoutId: BiltyLayoutId = c?.biltyLayout ?? DEFAULT_LAYOUT;

  if (layoutId !== 'classic-grid') {
    return renderPanelLayout(record, options, layoutId, draftCompany);
  }
  return renderClassicGridLayout(record, options, draftCompany);
}

/** Classic Grid Layout - the original default layout with accent rule enhancement */
async function renderClassicGridLayout(
  record: BiltyRecord,
  options: PrintOptions,
  draftCompany?: CompanySnapshot,
): Promise<Buffer> {
  const b = printData(record),
    d = b.data,
    c = b.companySnapshot ?? draftCompany;

  const margin = 24;
  const pdf = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin,
    bufferPages: true,
    info: { Title: `Bilty ${b.number ?? 'Draft'}`, Author: c?.name ?? 'Bilty' },
  });

  pdf.registerFont('Body', join(__dirname, '../../../assets/fonts/NotoSans-Regular.ttf'));
  pdf.registerFont('Bold', join(__dirname, '../../../assets/fonts/NotoSans-Bold.ttf'));
  pdf.registerFont(
    'Devanagari',
    join(__dirname, '../../../assets/fonts/NotoSansDevanagari-Regular.ttf'),
  );

  const chunks: Buffer[] = [];
  const ready = new Promise<Buffer>((resolve, reject) => {
    pdf.on('data', (v) => chunks.push(v));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
  });

  const pageWidth = pdf.page.width;
  const pageHeight = pdf.page.height;
  const contentWidth = pageWidth - 2 * margin;
  const primaryColor = /^#[a-fA-F0-9]{6}$/.test(c?.primaryColor ?? '')
    ? c!.primaryColor
    : '#1a3a6e';
  const accentColor = /^#[a-fA-F0-9]{6}$/.test(c?.accentColor ?? '') ? c!.accentColor : '#2e7d32';
  const lightBg = '#f8f9fa';
  const borderColor = '#dee2e6';

  // Helper functions
  const runs = (text: string) =>
    clean(text)
      .split(/([\u0900-\u097f]+)/)
      .filter(Boolean);

  const family = (text: string, bold: boolean) =>
    /[\u0900-\u097f]/.test(text) ? 'Devanagari' : bold ? 'Bold' : 'Body';

  function drawText(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    bold = false,
    color = '#333333',
  ) {
    pdf.fillColor(color);
    let xPos = x;
    for (const run of runs(text)) {
      pdf.font(family(run, bold)).fontSize(fontSize).text(run, xPos, y, { lineBreak: false });
      xPos += pdf.widthOfString(run);
    }
  }

  function drawTextWrap(
    text: string,
    x: number,
    y: number,
    width: number,
    fontSize: number,
    bold = false,
    color = '#333333',
    height?: number,
  ) {
    pdf
      .fillColor(color)
      .font(bold ? 'Bold' : 'Body')
      .fontSize(fontSize);
    pdf.text(clean(text), x, y, {
      width,
      height,
      lineBreak: true,
      ellipsis: height === undefined ? undefined : true,
    });
  }

  function drawBox(x: number, y: number, w: number, h: number, fill?: string, strokeCol?: string) {
    if (fill) {
      pdf.rect(x, y, w, h).fill(fill);
    }
    pdf
      .strokeColor(strokeCol ?? borderColor)
      .lineWidth(0.75)
      .rect(x, y, w, h)
      .stroke();
  }

  function drawSectionBox(
    x: number,
    y: number,
    w: number,
    h: number,
    title?: string,
    titleBg?: string,
  ) {
    // Draw main box with thicker border
    pdf.rect(x, y, w, h).fill('#ffffff');
    pdf.strokeColor(borderColor).lineWidth(1).rect(x, y, w, h).stroke();
    if (title) {
      const titleH = 18;
      pdf.rect(x, y, w, titleH).fill(titleBg ?? lightBg);
      pdf.strokeColor(borderColor).lineWidth(0.5).rect(x, y, w, titleH).stroke();
      drawText(title.toUpperCase(), x + 8, y + 4, 9, true, primaryColor);
    }
  }

  function drawCheckbox(x: number, y: number, checked: boolean, label: string, fontSize = 9) {
    const boxSize = 12;
    pdf.strokeColor(borderColor).lineWidth(1).rect(x, y, boxSize, boxSize).stroke();
    if (checked) {
      pdf.rect(x + 2, y + 2, boxSize - 4, boxSize - 4).fill(accentColor);
      pdf
        .strokeColor('#ffffff')
        .lineWidth(1.5)
        .moveTo(x + 3, y + 6)
        .lineTo(x + 5, y + 9)
        .lineTo(x + 9, y + 3)
        .stroke();
    }
    drawText(label, x + boxSize + 6, y + 1, fontSize, false, '#444444');
  }

  function drawLabel(text: string, x: number, y: number, fontSize = 8) {
    drawText(text, x, y, fontSize, false, '#666666');
  }

  function drawValue(text: string, x: number, y: number, fontSize = 10, bold = true) {
    drawText(text || '-', x, y, fontSize, bold, '#222222');
  }

  let y = margin;

  // ============ HEADER SECTION ============
  // Top accent bar
  pdf.rect(margin, y, contentWidth, 6).fill(primaryColor);
  pdf.rect(margin, y + 6, contentWidth, 2).fill(accentColor);
  y += 12;

  // Header background
  const headerHeight = 70;
  pdf.rect(margin, y, contentWidth, headerHeight).fill('#ffffff');

  // Copy type badge (top right)
  const copyText = `${options.copy.toUpperCase()} COPY`;
  pdf.font('Bold').fontSize(10);
  const copyWidth = pdf.widthOfString(copyText) + 16;
  const badgeX = pageWidth - margin - copyWidth - 8;
  pdf.rect(badgeX, y + 4, copyWidth, 22).fill(primaryColor);
  drawText(copyText, badgeX + 8, y + 9, 10, true, '#ffffff');

  // Hindi blessing (top left)
  drawText('॥ श्री गणेशाय नमः ॥', margin + 8, y + 6, 11, false, '#666666');

  // Jurisdiction (center top)
  const jurisdiction = (c?.jurisdiction || 'Delhi').replace(/\s+jurisdiction$/i, '');
  const jurisdictionText = `Subject to ${jurisdiction} Jurisdiction`;
  pdf.font('Body').fontSize(9);
  const jurisdictionWidth = pdf.widthOfString(jurisdictionText);
  drawText(jurisdictionText, margin + (contentWidth - jurisdictionWidth) / 2, y + 8, 9, false, '#666666');

  // Company Logo and Name
  let logoX = margin + 10;
  const logoY = y + 24;

  if (c?.logoUrl?.startsWith('data:') && validInlineLogo(c.logoUrl)) {
    try {
      pdf.image(Buffer.from(c.logoUrl.split(',')[1]!, 'base64'), logoX, logoY, { height: 40 });
      logoX += 50;
    } catch {
      // Skip logo if invalid
    }
  }

  // Company name - large and prominent
  const companyName = c?.name?.toUpperCase() || 'TRANSPORT COMPANY';
  drawText(companyName, logoX, logoY + 2, 24, true, primaryColor);

  // Company address and contact below name
  const contactY = logoY + 28;
  const contactParts: string[] = [];
  if (c?.address) contactParts.push(c.address);
  if (contactParts.length > 0) {
    drawTextWrap(contactParts.join(' | '), logoX, contactY, 400, 9, false, '#555555');
  }

  // Contact info on right side
  const rightInfoX = pageWidth - margin - 180;
  if (c?.phone) {
    drawLabel('Phone:', rightInfoX, logoY + 2);
    drawValue(c.phone, rightInfoX + 45, logoY + 2, 10, false);
  }
  if (c?.email) {
    drawLabel('Email:', rightInfoX, logoY + 14);
    drawValue(c.email, rightInfoX + 45, logoY + 14, 9, false);
  }
  if (c?.gstin) {
    drawLabel('GSTIN:', rightInfoX, logoY + 26);
    drawValue(c.gstin, rightInfoX + 45, logoY + 26, 9, true);
  }

  y += headerHeight + 4;

  // ============ BILTY NUMBER ROW ============
  const biltyRowHeight = 45;
  const biltyBoxWidth = 220;
  const dateBoxWidth = contentWidth - biltyBoxWidth - 8;

  // Bilty Number Box (prominent, left side)
  pdf.rect(margin, y, biltyBoxWidth, biltyRowHeight).fill(lightBg);
  pdf.strokeColor(primaryColor).lineWidth(2).rect(margin, y, biltyBoxWidth, biltyRowHeight).stroke();
  drawLabel('BILTY / LR NO.', margin + 10, y + 5, 9);
  const biltyNumber = b.number || 'DRAFT';
  drawText(biltyNumber, margin + 10, y + 18, 18, true, primaryColor);

  // Date Box (right of bilty number)
  const dateBoxX = margin + biltyBoxWidth + 8;
  pdf.rect(dateBoxX, y, dateBoxWidth, biltyRowHeight).fill('#ffffff');
  pdf.strokeColor(borderColor).lineWidth(1).rect(dateBoxX, y, dateBoxWidth, biltyRowHeight).stroke();
  drawLabel('Date:', dateBoxX + 10, y + 8, 9);
  const dateStr = b.issuedAt
    ? new Date(b.issuedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date(b.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  drawValue(dateStr, dateBoxX + 50, y + 6, 11);

  // Vehicle info in date box area
  drawLabel('Vehicle:', dateBoxX + 150, y + 8, 9);
  drawValue(d.vehicleNumber || '-', dateBoxX + 200, y + 6, 11);
  drawLabel('Driver:', dateBoxX + 10, y + 26, 9);
  drawValue(d.driverName || '-', dateBoxX + 50, y + 24, 10, false);
  if (d.driverPhone) {
    drawLabel('Ph:', dateBoxX + 200, y + 26, 8);
    drawValue(d.driverPhone, dateBoxX + 220, y + 24, 9, false);
  }

  y += biltyRowHeight + 6;

  // ============ PARTIES ROW (Consignor, FROM, Consignee, TO) ============
  const partyRowHeight = 70;
  const partyWidth = contentWidth * 0.38;
  const routeWidth = contentWidth * 0.12 - 4;

  // Consignor Box
  drawSectionBox(margin, y, partyWidth, partyRowHeight, 'Consignor (Sender)');
  drawValue(d.consignor.name || '-', margin + 8, y + 22, 11);
  if (d.consignor.address) {
    drawTextWrap(d.consignor.address, margin + 8, y + 36, partyWidth - 16, 8, false, '#444444', 18);
  }
  if (d.consignor.gstin) {
    drawLabel('GSTIN:', margin + 8, y + 56, 8);
    drawValue(d.consignor.gstin, margin + 48, y + 54, 8, false);
  }
  if (d.consignor.phone) {
    drawLabel('Ph:', margin + partyWidth - 85, y + 56, 8);
    drawValue(d.consignor.phone, margin + partyWidth - 65, y + 54, 8, false);
  }

  // FROM Box (small, next to consignor)
  const fromX = margin + partyWidth + 4;
  pdf.rect(fromX, y, routeWidth, partyRowHeight).fill(lightBg);
  pdf.strokeColor(accentColor).lineWidth(1.5).rect(fromX, y, routeWidth, partyRowHeight).stroke();
  drawLabel('FROM', fromX + 8, y + 8, 8);
  drawText(d.fromLocation || '-', fromX + 8, y + 24, 12, true, accentColor);

  // Consignee Box
  const consigneeX = fromX + routeWidth + 4;
  drawSectionBox(consigneeX, y, partyWidth, partyRowHeight, 'Consignee (Receiver)');
  drawValue(d.consignee.name || '-', consigneeX + 8, y + 22, 11);
  if (d.consignee.address) {
    drawTextWrap(d.consignee.address, consigneeX + 8, y + 36, partyWidth - 16, 8, false, '#444444', 18);
  }
  if (d.consignee.gstin) {
    drawLabel('GSTIN:', consigneeX + 8, y + 56, 8);
    drawValue(d.consignee.gstin, consigneeX + 48, y + 54, 8, false);
  }
  if (d.consignee.phone) {
    drawLabel('Ph:', consigneeX + partyWidth - 85, y + 56, 8);
    drawValue(d.consignee.phone, consigneeX + partyWidth - 65, y + 54, 8, false);
  }

  // TO Box (small, next to consignee)
  const toX = consigneeX + partyWidth + 4;
  pdf.rect(toX, y, routeWidth, partyRowHeight).fill(lightBg);
  pdf.strokeColor(primaryColor).lineWidth(1.5).rect(toX, y, routeWidth, partyRowHeight).stroke();
  drawLabel('TO', toX + 8, y + 8, 8);
  drawText(d.toLocation || '-', toX + 8, y + 24, 12, true, primaryColor);

  y += partyRowHeight + 6;

  // ============ OPTIONS ROW (Delivery, Payment, Insurance) ============
  const optionsRowHeight = 45;
  const col3Width = contentWidth / 3 - 5;

  // Delivery Mode
  drawSectionBox(margin, y, col3Width, optionsRowHeight, 'Delivery Mode');
  drawCheckbox(margin + 10, y + 24, d.deliveryMode === 'door', 'Door Delivery');
  drawCheckbox(margin + 120, y + 24, d.deliveryMode === 'godown', 'Godown Delivery');

  // Freight Type
  const col2X = margin + col3Width + 8;
  drawSectionBox(col2X, y, col3Width, optionsRowHeight, 'Payment Type');
  drawCheckbox(col2X + 10, y + 24, d.freightType === 'to-pay', 'To Pay');
  drawCheckbox(col2X + 80, y + 24, d.freightType === 'paid', 'Paid');
  drawCheckbox(col2X + 140, y + 24, d.freightType === 'billed', 'To Bill');

  // Insurance
  const col3X = col2X + col3Width + 8;
  drawSectionBox(col3X, y, col3Width, optionsRowHeight, 'Insurance');
  drawCheckbox(col3X + 10, y + 24, d.insurance.status === 'not-insured', 'Not Insured');
  drawCheckbox(col3X + 110, y + 24, d.insurance.status === 'insured', 'Insured');

  y += optionsRowHeight + 6;

  // ============ GOODS & CHARGES SECTION ============
  const goodsChargesHeight = 105;
  const goodsWidth = contentWidth * 0.62;
  const chargesWidth = contentWidth - goodsWidth - 8;

  // Goods Section
  drawSectionBox(margin, y, goodsWidth, goodsChargesHeight, 'Goods Particulars');

  // Row 1: Description
  const goodsContentY = y + 20;
  const labelCol = margin + 8;
  const valueCol = margin + 75;
  const col2Label = margin + goodsWidth * 0.5;
  const col2Value = margin + goodsWidth * 0.5 + 65;

  drawLabel('Description:', labelCol, goodsContentY + 4, 8);
  drawTextWrap(d.goodsDescription || '-', valueCol, goodsContentY + 2, goodsWidth - 85, 9, false, '#333333', 22);

  // Row 2: Packages & Packing
  const row2Y = goodsContentY + 26;
  drawLabel('No. of Pkgs:', labelCol, row2Y, 8);
  drawValue(String(d.packageCount || '-'), valueCol, row2Y - 2, 10);

  drawLabel('Packing Type:', col2Label, row2Y, 8);
  drawValue(d.packingType || '-', col2Value, row2Y - 2, 10, false);

  // Row 3: Weights
  const row3Y = row2Y + 16;
  drawLabel('Actual Weight:', labelCol, row3Y, 8);
  const actualWt = d.actualWeight ? `${d.actualWeight.value} ${d.actualWeight.unit}` : '-';
  drawValue(actualWt, valueCol, row3Y - 2, 10);

  drawLabel('Chargeable Wt:', col2Label, row3Y, 8);
  const chargeWt = d.chargeableWeight ? `${d.chargeableWeight.value} ${d.chargeableWeight.unit}` : '-';
  drawValue(chargeWt, col2Value, row3Y - 2, 10);

  // Row 4: E-way & Invoice
  const row4Y = row3Y + 16;
  if (d.ewayBills.length > 0) {
    drawLabel('E-way Bill:', labelCol, row4Y, 8);
    drawTextWrap(d.ewayBills.join(', '), valueCol, row4Y - 2, goodsWidth * 0.45 - 10, 9, false, '#333333', 12);
  }
  if (d.invoices.length > 0) {
    drawLabel('Invoice No:', col2Label, row4Y, 8);
    const invText = d.invoices.map((inv) => inv.number).join(', ');
    drawTextWrap(invText, col2Value, row4Y - 2, goodsWidth * 0.45 - 10, 9, false, '#333333', 12);
  }

  // Row 5: Remarks (if present)
  if (d.remarks) {
    const row5Y = row4Y + 16;
    drawLabel('Remarks:', labelCol, row5Y, 8);
    drawTextWrap(d.remarks, valueCol, row5Y - 2, goodsWidth - 85, 8, false, '#555555', 10);
  }

  // Charges Section
  const chargesX = margin + goodsWidth + 8;
  drawSectionBox(chargesX, y, chargesWidth, goodsChargesHeight, 'Freight Charges');

  const chargeItems = [
    { label: 'Freight', value: d.charges.freightPaise },
    { label: 'Loading', value: d.charges.loadingPaise },
    { label: 'Unloading', value: d.charges.unloadingPaise },
    { label: 'Statistical', value: d.charges.statisticalPaise },
    { label: 'Express', value: d.charges.expressPaise },
    { label: 'Other', value: d.charges.otherPaise },
  ];

  let chargeRowY = y + 21;
  const chargeLineHeight = 11;
  chargeItems.forEach((item) => {
    drawLabel(item.label + ':', chargesX + 8, chargeRowY, 8);
    const amt = item.value ? `₹ ${(item.value / 100).toFixed(2)}` : '-';
    drawText(amt, chargesX + chargesWidth - 75, chargeRowY - 2, 9, false, '#333333');
    chargeRowY += chargeLineHeight;
  });

  // Total row with highlight (below all charge items)
  const totalRowY = chargeRowY + 2;
  pdf.rect(chargesX + 1, totalRowY, chargesWidth - 2, 16).fill(lightBg);
  drawText('TOTAL:', chargesX + 8, totalRowY + 3, 9, true, primaryColor);
  const totalAmt = `₹ ${((b.totalPaise ?? 0) / 100).toFixed(2)}`;
  drawText(totalAmt, chargesX + chargesWidth - 75, totalRowY + 2, 11, true, primaryColor);

  y += goodsChargesHeight + 6;

  // ============ AMOUNT IN WORDS & TERMS ROW ============
  const termsRowHeight = 40;
  pdf.rect(margin, y, contentWidth, termsRowHeight).fill('#ffffff');
  pdf.strokeColor(borderColor).lineWidth(1).rect(margin, y, contentWidth, termsRowHeight).stroke();

  // Amount in words
  drawLabel('Amount in Words:', margin + 10, y + 6, 9);
  drawText(b.amountInWords || '-', margin + 110, y + 4, 11, true, '#222222');

  // Terms (if any)
  if (c?.carriageTerms) {
    drawLabel('Terms:', margin + 10, y + 22, 9);
    drawTextWrap(c.carriageTerms, margin + 50, y + 20, contentWidth - 60, 9, false, '#555555', 14);
  }

  y += termsRowHeight + 8;

  // ============ SIGNATURE SECTION ============
  const sigHeight = 45;
  const sigGap = 8;
  const sigWidth = (contentWidth - sigGap * 2) / 3;

  // Three signature boxes
  const sigLabels = ['Consignor Signature', 'Transport Operator', 'Received By'];
  sigLabels.forEach((label, i) => {
    const sigX = margin + i * (sigWidth + sigGap);
    pdf.rect(sigX, y, sigWidth, sigHeight).fill('#ffffff');
    pdf.strokeColor(borderColor).lineWidth(0.75).rect(sigX, y, sigWidth, sigHeight).stroke();

    // Signature line
    pdf
      .strokeColor('#999999')
      .lineWidth(0.5)
      .moveTo(sigX + 10, y + sigHeight - 18)
      .lineTo(sigX + sigWidth - 10, y + sigHeight - 18)
      .stroke();

    // Center the label within the box
    pdf.font('Body').fontSize(9);
    const labelWidth = pdf.widthOfString(label);
    const labelX = sigX + (sigWidth - labelWidth) / 2;
    drawLabel(label, labelX, y + sigHeight - 12, 9);
  });

  // Terms notice - right aligned below signature boxes
  const termsText = 'For Terms & Conditions, see overleaf';
  pdf.font('Body').fontSize(8);
  const termsWidth = pdf.widthOfString(termsText);
  drawText(termsText, margin + contentWidth - termsWidth, y + sigHeight + 4, 8, false, '#888888');

  y += sigHeight + 8;

  const needsContinuation =
    (d.goodsDescription?.length ?? 0) > 220 ||
    d.ewayBills.join(', ').length > 180 ||
    d.invoices.length > 2 ||
    d.invoices.map((invoice) => invoice.number).join(', ').length > 34 ||
    (c?.carriageTerms?.length ?? 0) > 260 ||
    (c?.bankDetails?.length ?? 0) > 140;

  if (needsContinuation) {
    pdf.addPage({ size: 'A4', layout: 'landscape', margin: 32 });
    pdf.fillColor(primaryColor).font('Bold').fontSize(14).text('BILTY CONTINUATION');
    pdf.moveDown(0.25);
    pdf
      .fillColor('#333333')
      .font('Body')
      .fontSize(8)
      .text(`${b.number ?? 'Draft'} | ${options.copy.toUpperCase()} COPY`);
    pdf.moveDown(1);

    const continuationSection = (title: string, value: string) => {
      pdf.fillColor(primaryColor).font('Bold').fontSize(9).text(title.toUpperCase());
      pdf.moveDown(0.2);
      pdf
        .fillColor('#20252d')
        .font('Body')
        .fontSize(8)
        .text(clean(value), {
          width: pdf.page.width - 64,
          lineGap: 2,
        });
      pdf.moveDown(0.8);
    };

    continuationSection('Goods description', d.goodsDescription || 'Not supplied');
    if (d.ewayBills.length) continuationSection('E-way bill references', d.ewayBills.join(' / '));
    if (d.invoices.length) {
      continuationSection(
        'Invoices',
        d.invoices
          .map((invoice) =>
            [
              invoice.number,
              invoice.date,
              invoice.declaredValuePaise === null ? '' : `INR ${money(invoice.declaredValuePaise)}`,
            ]
              .filter(Boolean)
              .join(' | '),
          )
          .join('\n'),
      );
    }
    if (c?.carriageTerms) continuationSection('Carriage terms', c.carriageTerms);
    if (c?.bankDetails) continuationSection('Bank details', c.bankDetails);
  }

  // ============ PAGE NUMBER ============
  const pages = pdf.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    pdf.switchToPage(i);
    if (b.watermarks.length) {
      pdf.save();
      pdf.fillColor('#ff0000').opacity(0.12);
      pdf.font('Bold').fontSize(48);
      pdf.rotate(-45, { origin: [pageWidth / 2, pageHeight / 2] });
      pdf.text(clean(b.watermarks.join(' / ')), pageWidth / 2 - 180, pageHeight / 2 - 20, {
        lineBreak: false,
      });
      pdf.restore();
    }
    pdf.page.margins.bottom = 0;
    drawText(`Page ${i + 1} of ${pages.count}`, margin, pageHeight - 20, 7, false, '#747b85');
  }

  pdf.end();
  return ready;
}
