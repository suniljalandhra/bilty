import PDFDocument from 'pdfkit';
import { join } from 'node:path';
import type { BiltyRecord, CompanySnapshot } from '@bilty/shared-types';
import { z } from 'zod';
import { printData } from '../bilty/domain';
import { validInlineLogo } from '../company/logo';

export const printOptions = z.strictObject({
  format: z.enum(['a4', 'thermal']).default('a4'),
  copy: z.enum(['consignor', 'consignee', 'driver', 'office']).default('office'),
});
export type PrintOptions = z.infer<typeof printOptions>;

const money = (v: number | null) => (v === null ? '' : `${(v / 100).toFixed(2)}`);
const clean = (v: string) => v.replace(/[—–]/g, '-');

type LayoutBox = { name: string; top: number; bottom: number };

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
  const b = printData(record),
    d = b.data,
    c = b.companySnapshot ?? draftCompany,
    thermal = options.format === 'thermal';

  // For thermal, use simpler layout (keep existing logic)
  if (thermal) {
    return renderThermalPdf(record, options, draftCompany);
  }

  const margin = 20;
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
  const layout = a4Layout();
  const grid = a4GridLayout(contentWidth);
  const primaryColor = /^#[a-fA-F0-9]{6}$/.test(c?.primaryColor ?? '')
    ? c!.primaryColor
    : '#1a3a6e';

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
    color = '#000000',
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
    color = '#000000',
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

  function drawBox(x: number, y: number, w: number, h: number, fill?: string) {
    if (fill) {
      pdf.rect(x, y, w, h).fill(fill);
    }
    pdf.strokeColor('#000000').lineWidth(0.5).rect(x, y, w, h).stroke();
  }

  function drawCheckbox(x: number, y: number, checked: boolean, label: string, fontSize = 8) {
    pdf.strokeColor('#000000').lineWidth(0.5).rect(x, y, 10, 10).stroke();
    if (checked) {
      pdf
        .strokeColor('#000000')
        .lineWidth(1.2)
        .moveTo(x + 2, y + 5)
        .lineTo(x + 4.2, y + 8)
        .lineTo(x + 8.5, y + 2)
        .stroke();
    }
    drawText(label, x + 14, y + 1, fontSize, false, '#000000');
  }

  let y = margin;

  // ============ HEADER SECTION ============
  // Top decorative line
  pdf
    .strokeColor(primaryColor)
    .lineWidth(2)
    .moveTo(margin, y)
    .lineTo(pageWidth - margin, y)
    .stroke();
  y += 5;

  // Hindi text and jurisdiction
  drawText('श्री गणेशाय नमः', margin + 5, y, 10, false, '#000000');
  const jurisdiction = (c?.jurisdiction || 'Delhi').replace(/\s+jurisdiction$/i, '');
  const jurisdictionText = `"Subject to ${jurisdiction} Jurisdiction"`;
  pdf.font('Body').fontSize(8);
  const jurisdictionWidth = pdf.widthOfString(jurisdictionText);
  drawText(
    jurisdictionText,
    margin + (contentWidth - jurisdictionWidth) / 2,
    y + 2,
    8,
    false,
    '#000000',
  );

  // Copy type on right
  const copyText = `${options.copy.toUpperCase()} COPY`;
  pdf.font('Bold').fontSize(9);
  const copyWidth = pdf.widthOfString(copyText);
  drawText(copyText, pageWidth - margin - copyWidth, y, 9, true, '#000000');
  y += 14;

  // Company contact info on right side
  const contactX = pageWidth - margin - 150;
  if (c?.phone) {
    drawText(`Mob.: ${c.phone}`, contactX, y, 7, false, '#000000');
  }
  y += 8;
  if (c?.email) {
    drawText(`E-mail: ${c.email}`, contactX, y, 7, false, '#000000');
  }

  // Company Logo and Name
  let logoX = margin + 5;
  const logoY = margin + 18;

  if (c?.logoUrl?.startsWith('data:') && validInlineLogo(c.logoUrl)) {
    try {
      pdf.image(Buffer.from(c.logoUrl.split(',')[1]!, 'base64'), logoX, logoY, { height: 35 });
      logoX += 45;
    } catch {
      // Skip logo if invalid
    }
  }

  // Company name - large and prominent
  drawText(c?.name?.toUpperCase() || 'TRANSPORT COMPANY', logoX, logoY + 5, 22, true, primaryColor);
  y = logoY + 42;

  // Company address
  if (c?.address) {
    drawText(c.address, margin + 5, y, 8, false, '#000000');
  }
  y += 12;

  // Horizontal line
  pdf
    .strokeColor('#000000')
    .lineWidth(0.5)
    .moveTo(margin, y)
    .lineTo(pageWidth - margin, y)
    .stroke();
  y += 3;

  // ============ MAIN CONTENT GRID ============
  const gridTop = layout.identity.top;
  y = gridTop;
  const leftColWidth = 240;
  const centerColWidth = 250;
  const rightColWidth = contentWidth - leftColWidth - centerColWidth;
  const rightColX = margin + leftColWidth + centerColWidth;

  // Row 1: GSTIN, Transit Risk, Bilty No section
  // GSTIN Box (left)
  drawBox(margin, y, leftColWidth, 20);
  drawText(`GSTIN No. ${c?.gstin || ''}`, margin + 3, y + 5, 8, true, '#000000');

  // Transit Risk (center) - spans full width initially
  const transitRiskX = margin + leftColWidth;
  drawBox(transitRiskX, y, centerColWidth + rightColWidth, 50);
  const transitText =
    "Transit Risk: All goods are carried at owner's risk. The Consignor/Consignee must ensure that the goods are insured by an insurance company. We shall not be held be responsible for any kind of loss, damage, theft, leakage, delay due to any reason. It is furthermade clear that any damage or loss to nature disaster or any act of God, which is beyond the control of the company.";
  drawTextWrap(
    transitText,
    transitRiskX + 3,
    y + 3,
    centerColWidth + rightColWidth - 6,
    6,
    false,
    '#000000',
  );

  // Bilty No Box (right side, prominent)
  const biltyBoxX = rightColX;
  const biltyBoxY = y + 52;
  drawBox(biltyBoxX, biltyBoxY, rightColWidth, 35);
  drawText('Bilty No. :', biltyBoxX + 5, biltyBoxY + 5, 9, true, '#000000');
  drawText(b.number || '____', biltyBoxX + 55, biltyBoxY + 3, 16, true, primaryColor);
  drawText('Date :', biltyBoxX + 5, biltyBoxY + 22, 8, false, '#000000');
  const dateStr = b.issuedAt
    ? new Date(b.issuedAt).toLocaleDateString('en-IN')
    : b.createdAt.slice(0, 10);
  drawText(dateStr, biltyBoxX + 35, biltyBoxY + 22, 9, true, '#000000');

  y = layout.details.top;

  // Row 2: Delivery Mode, Insurance, Vehicle/Form info
  const row2Y = y;

  // Delivery Mode section
  drawBox(margin, row2Y, leftColWidth, 52);
  drawText('DELIVERY MODE', margin + 5, row2Y + 3, 7, true, '#000000');
  drawCheckbox(margin + 8, row2Y + 15, d.deliveryMode === 'door', 'DOOR DELIVERY', 8);
  drawCheckbox(margin + 8, row2Y + 30, d.deliveryMode === 'godown', 'GODOWN DELIVERY', 8);

  // Person liable for service tax
  drawBox(margin, row2Y + 52, leftColWidth, 43);
  drawText('Person Liable for SERVICE TAX', margin + 5, row2Y + 55, 7, true, '#000000');
  drawCheckbox(margin + 8, row2Y + 67, d.gstPayableBy === 'consignor', 'Consignor', 7);
  drawCheckbox(margin + 80, row2Y + 67, d.gstPayableBy === 'consignee', 'Consignee', 7);
  drawCheckbox(margin + 8, row2Y + 81, d.gstPayableBy === 'agency', 'Goods Tpt. Agency', 7);

  // Insurance section (center)
  const insuranceX = margin + leftColWidth;
  drawBox(insuranceX, row2Y, centerColWidth, 95);
  drawText('I N S U R A N C E', insuranceX + 50, row2Y + 5, 8, true, '#000000');
  drawText('The Consignor has Stated that :', insuranceX + 5, row2Y + 18, 7, true, '#000000');
  drawCheckbox(
    insuranceX + 10,
    row2Y + 32,
    d.insurance.status === 'not-insured',
    'he has not insured the consignment',
    7,
  );
  drawText('OR', insuranceX + 80, row2Y + 45, 7, false, '#000000');
  drawCheckbox(
    insuranceX + 10,
    row2Y + 55,
    d.insurance.status === 'insured',
    'he has insured the consignment',
    7,
  );

  if (d.insurance.status === 'insured') {
    drawText(`Company: ${d.insurance.company}`, insuranceX + 10, row2Y + 68, 7, false, '#000000');
    drawText(
      `Policy No: ${d.insurance.policyNumber}`,
      insuranceX + 10,
      row2Y + 78,
      7,
      false,
      '#000000',
    );
  }

  // Right column: PAN, Vehicle, Invoice info
  drawBox(rightColX, row2Y, rightColWidth, 18);
  drawText(`PAN No. : ${c?.pan || ''}`, rightColX + 5, row2Y + 5, 8, true, '#000000');

  drawBox(rightColX, row2Y + 18, rightColWidth, 18);
  drawText('Vehicle No. :', rightColX + 5, row2Y + 23, 7, false, '#000000');
  drawText(d.vehicleNumber || '', rightColX + 55, row2Y + 23, 8, true, '#000000');

  // Demurrage notice
  drawBox(rightColX, row2Y + 36, rightColWidth, 28);
  const demurrageText =
    c?.demurrageTerms ||
    'Demurrage Chargeable after 7 days from today @ Rs. 5/- per day per Qtl. on weight charged';
  drawTextWrap(
    demurrageText,
    rightColX + 3,
    row2Y + 38,
    rightColWidth - 6,
    6,
    false,
    '#000000',
    23,
  );

  // Mode of Packing / Invoice
  drawBox(rightColX, row2Y + 64, rightColWidth, 31);
  drawText('Mode of Packing', rightColX + 5, row2Y + 66, 7, false, '#000000');
  drawText(d.packingType || '', rightColX + 70, row2Y + 66, 8, true, '#000000');
  drawText('Invoice No.', rightColX + 5, row2Y + 77, 7, false, '#000000');
  const firstInvoice = d.invoices[0];
  if (firstInvoice) {
    const invoiceNumbers = d.invoices.map((invoice) => invoice.number).join(', ');
    drawTextWrap(
      invoiceNumbers,
      rightColX + 50,
      row2Y + 77,
      rightColWidth - 54,
      7,
      true,
      '#000000',
      15,
    );
    if (d.invoices.length === 1 && firstInvoice.declaredValuePaise) {
      drawText(
        `Value: ${money(firstInvoice.declaredValuePaise)}`,
        rightColX + 5,
        row2Y + 87,
        7,
        false,
        '#000000',
      );
    }
  }

  y = layout.consignor.top;

  // ============ CONSIGNOR / CONSIGNEE SECTION ============
  const partyRowHeight = layout.consignor.bottom - layout.consignor.top;

  // Consignor
  drawBox(margin, y, grid.partyWidth, partyRowHeight);
  drawText("Consignor's Name & Address", margin + 3, y + 2, 7, false, '#666666');
  drawText(d.consignor.name || '', margin + 5, y + 12, 10, true, '#000000');
  if (d.consignor.address) {
    drawTextWrap(
      d.consignor.address,
      margin + 5,
      y + 24,
      grid.partyWidth - 10,
      7,
      false,
      '#000000',
      18,
    );
  }
  if (d.consignor.gstin) {
    drawText(`GSTIN: ${d.consignor.gstin}`, margin + 5, y + 36, 6, false, '#000000');
  }

  // FROM / TO section
  const fromToX = margin + grid.partyWidth;
  const fromToWidth = grid.routeWidth;
  drawBox(fromToX, y, fromToWidth, partyRowHeight);
  drawText('FROM :', fromToX + 5, y + 5, 8, true, '#000000');
  drawText(d.fromLocation || '', fromToX + 45, y + 4, 11, true, primaryColor);

  const partyMetaX = fromToX + fromToWidth;
  drawBox(partyMetaX, y, grid.partyMetaWidth, partyRowHeight);
  drawText("Consignor's S.T. No.", partyMetaX + 5, y + 5, 6, false, '#666666');
  drawText('State:', partyMetaX + 5, y + 15, 6, false, '#666666');

  y = layout.consignee.top;

  // Consignee
  drawBox(margin, y, grid.partyWidth, partyRowHeight);
  drawText("Consignee Bank's Name & Address", margin + 3, y + 2, 7, false, '#666666');
  drawText(d.consignee.name || '', margin + 5, y + 12, 10, true, '#000000');
  if (d.consignee.address) {
    drawTextWrap(
      d.consignee.address,
      margin + 5,
      y + 24,
      grid.partyWidth - 10,
      7,
      false,
      '#000000',
      18,
    );
  }
  if (d.consignee.gstin) {
    drawText(`GSTIN: ${d.consignee.gstin}`, margin + 5, y + 36, 6, false, '#000000');
  }

  // TO section
  drawBox(fromToX, y, fromToWidth, partyRowHeight);
  drawText('TO :', fromToX + 5, y + 5, 8, true, '#000000');
  drawText(d.toLocation || '', fromToX + 30, y + 4, 11, true, primaryColor);

  drawBox(partyMetaX, y, grid.partyMetaWidth, partyRowHeight);
  drawText("Consignee's S.T. No.", partyMetaX + 5, y + 5, 6, false, '#666666');
  drawText('State:', partyMetaX + 5, y + 15, 6, false, '#666666');

  y = layout.goods.top;

  // ============ PACKAGES TABLE ============
  const tableY = y;
  const col1 = 52; // Packages
  const col3 = 65; // Actual Weight
  const col4 = 65; // Charge Weight
  const col5 = 85; // Normal Rate
  const col6 = 115; // Amount (Rs. P.)
  const col2 = grid.tableWidth - col1 - col3 - col4 - col5 - col6; // Description
  const tableHeight = layout.goods.bottom - layout.goods.top;

  // Table headers
  drawBox(margin, tableY, col1, 20);
  drawText('Packages', margin + 5, tableY + 6, 8, true, '#000000');

  drawBox(margin + col1, tableY, col2, 20);
  drawText('DESCRIPTION (said to contain)', margin + col1 + 5, tableY + 6, 8, true, '#000000');

  drawBox(margin + col1 + col2, tableY, col3 + col4, 10);
  drawText('W E I G H T', margin + col1 + col2 + 20, tableY + 1, 7, true, '#000000');
  drawBox(margin + col1 + col2, tableY + 10, col3, 10);
  drawText('Actual', margin + col1 + col2 + 10, tableY + 12, 7, false, '#000000');
  drawBox(margin + col1 + col2 + col3, tableY + 10, col4, 10);
  drawText('Charge', margin + col1 + col2 + col3 + 8, tableY + 12, 7, false, '#000000');

  drawBox(margin + col1 + col2 + col3 + col4, tableY, col5, 20);
  drawText('Normal', margin + col1 + col2 + col3 + col4 + 10, tableY + 2, 7, true, '#000000');
  drawText('RATE', margin + col1 + col2 + col3 + col4 + 12, tableY + 10, 7, true, '#000000');

  drawBox(margin + col1 + col2 + col3 + col4 + col5, tableY, col6, 10);
  drawText(
    'Amount',
    margin + col1 + col2 + col3 + col4 + col5 + 20,
    tableY + 1,
    7,
    true,
    '#000000',
  );
  drawBox(margin + col1 + col2 + col3 + col4 + col5, tableY + 10, col6 / 2, 10);
  drawText('Rs.', margin + col1 + col2 + col3 + col4 + col5 + 12, tableY + 12, 7, false, '#000000');
  drawBox(margin + col1 + col2 + col3 + col4 + col5 + col6 / 2, tableY + 10, col6 / 2, 10);
  drawText(
    'P.',
    margin + col1 + col2 + col3 + col4 + col5 + col6 / 2 + 15,
    tableY + 12,
    7,
    false,
    '#000000',
  );

  // Table content row
  const contentRowY = tableY + 20;
  const contentRowHeight = tableHeight - 20;

  drawBox(margin, contentRowY, col1, contentRowHeight);
  // Package count - circled
  if (d.packageCount) {
    pdf.circle(margin + 25, contentRowY + 20, 15).stroke();
    drawText(String(d.packageCount), margin + 18, contentRowY + 14, 14, true, '#000000');
  }

  drawBox(margin + col1, contentRowY, col2, contentRowHeight);
  // Goods description
  drawTextWrap(
    d.goodsDescription || '',
    margin + col1 + 5,
    contentRowY + 5,
    col2 - 10,
    9,
    false,
    '#000000',
    42,
  );
  // E-way bills
  if (d.ewayBills.length > 0) {
    drawText('E-way:', margin + col1 + 5, contentRowY + 35, 7, true, '#000000');
    drawTextWrap(
      d.ewayBills.join(', '),
      margin + col1 + 5,
      contentRowY + 51,
      col2 - 10,
      7,
      false,
      '#000000',
      contentRowHeight - 54,
    );
  }

  drawBox(margin + col1 + col2, contentRowY, col3, contentRowHeight);
  if (d.actualWeight) {
    drawText(
      `${d.actualWeight.value}`,
      margin + col1 + col2 + 8,
      contentRowY + 15,
      10,
      true,
      '#000000',
    );
    drawText(d.actualWeight.unit, margin + col1 + col2 + 8, contentRowY + 28, 7, false, '#000000');
  }

  drawBox(margin + col1 + col2 + col3, contentRowY, col4, contentRowHeight);
  if (d.chargeableWeight) {
    drawText(
      `${d.chargeableWeight.value}`,
      margin + col1 + col2 + col3 + 8,
      contentRowY + 15,
      10,
      true,
      '#000000',
    );
    drawText(
      d.chargeableWeight.unit,
      margin + col1 + col2 + col3 + 8,
      contentRowY + 28,
      7,
      false,
      '#000000',
    );
  }

  // Charges column - multiple rows
  const chargesX = margin + col1 + col2 + col3 + col4;
  const chargeLabels = [
    'Total Freight',
    'Loading Ch.',
    'Unloading Ch.',
    'St. Ch.',
    'Express Ch.',
    'Any Other Ch.',
  ];
  const chargeValues = [
    d.charges.freightPaise,
    d.charges.loadingPaise,
    d.charges.unloadingPaise,
    d.charges.statisticalPaise,
    d.charges.expressPaise,
    d.charges.otherPaise,
  ];

  const chargeRowHeight = contentRowHeight / chargeLabels.length;
  chargeLabels.forEach((label, i) => {
    const rowY = contentRowY + i * chargeRowHeight;
    drawBox(chargesX, rowY, col5, chargeRowHeight);
    drawText(label, chargesX + 3, rowY + 2, 6, false, '#000000');

    drawBox(chargesX + col5, rowY, col6 / 2, chargeRowHeight);
    const val = chargeValues[i] ?? 0;
    if (val !== 0) {
      const rs = Math.floor(val / 100);
      drawText(String(rs), chargesX + col5 + 5, rowY + 2, 7, false, '#000000');
    }

    drawBox(chargesX + col5 + col6 / 2, rowY, col6 / 2, chargeRowHeight);
    if (val !== 0) {
      const ps = val % 100;
      drawText(
        String(ps).padStart(2, '0'),
        chargesX + col5 + col6 / 2 + 5,
        rowY + 2,
        7,
        false,
        '#000000',
      );
    }
  });

  // Payment type section (right side of packages)
  const paymentX = margin + grid.tableWidth + grid.paymentGap;
  if (grid.paymentWidth > 50) {
    drawBox(paymentX, contentRowY, grid.paymentWidth, contentRowHeight);
    drawCheckbox(paymentX + 5, contentRowY + 8, d.freightType === 'to-pay', 'To Pay', 8);
    drawText('or', paymentX + 68, contentRowY + 10, 7, false, '#666666');
    drawCheckbox(paymentX + 5, contentRowY + 25, d.freightType === 'paid', 'Paid', 8);
    drawText('or', paymentX + 68, contentRowY + 27, 7, false, '#666666');
    drawCheckbox(paymentX + 5, contentRowY + 42, d.freightType === 'billed', 'To Billed', 8);
  }

  y = layout.total.top;

  // Grand Total row
  drawBox(chargesX, y, col5, 15);
  drawText('Gr. TOTAL', chargesX + 5, y + 3, 7, true, '#000000');
  drawBox(chargesX + col5, y, col6 / 2, 15);
  const totalRs = Math.floor((b.totalPaise ?? 0) / 100);
  drawText(String(totalRs), chargesX + col5 + 5, y + 3, 8, true, '#000000');
  drawBox(chargesX + col5 + col6 / 2, y, col6 / 2, 15);
  const totalPs = (b.totalPaise ?? 0) % 100;
  drawText(
    String(totalPs).padStart(2, '0'),
    chargesX + col5 + col6 / 2 + 5,
    y + 3,
    8,
    true,
    '#000000',
  );

  y += 20;

  // Amount in words row
  const totalFormatted = (b.totalPaise ?? 0) / 100;
  drawText(
    `Total: Rs. ${totalFormatted.toFixed(2)} (${b.amountInWords})`,
    margin + 5,
    y,
    8,
    false,
    '#000000',
  );

  y = layout.terms.top;

  // ============ TERMS SECTION ============
  if (c && (c.carriageTerms || c.bankDetails)) {
    if (c.carriageTerms) {
      drawText('Terms:', margin + 5, y, 7, true, '#000000');
      drawTextWrap(c.carriageTerms, margin + 40, y, contentWidth - 50, 7, false, '#000000', 18);
      y += 20;
    }
    if (c.bankDetails) {
      drawText('Bank:', margin + 5, y, 7, true, '#000000');
      drawTextWrap(c.bankDetails, margin + 40, y, contentWidth - 50, 7, false, '#000000', 8);
      y += 10;
    }
  }

  // ============ SIGNATURE SECTION ============
  const sigY = layout.signatures.top;
  const sigWidth = contentWidth / 2;

  drawText(
    'For Terms & Conditions, see overleaf',
    margin + sigWidth - 58,
    sigY,
    7,
    false,
    '#666666',
  );

  const signatureLineY = sigY + 25;
  pdf
    .strokeColor('#000000')
    .lineWidth(0.5)
    .moveTo(margin + 5, signatureLineY)
    .lineTo(margin + sigWidth - 15, signatureLineY)
    .stroke();
  drawText('Signature of Consignor', margin + 5, signatureLineY + 4, 8, false, '#000000');

  pdf
    .strokeColor('#000000')
    .lineWidth(0.5)
    .moveTo(margin + sigWidth + 15, signatureLineY)
    .lineTo(pageWidth - margin - 5, signatureLineY)
    .stroke();
  drawText(
    'Signature of the Transport Operator',
    margin + sigWidth + 15,
    signatureLineY + 4,
    8,
    false,
    '#000000',
  );

  y += 25;

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
    drawText(`Page ${i + 1} of ${pages.count}`, margin, layout.footer.top, 7, false, '#747b85');
  }

  pdf.end();
  return ready;
}

/** Thermal receipt format - simpler layout for small printers */
async function renderThermalPdf(
  record: BiltyRecord,
  options: PrintOptions,
  draftCompany?: CompanySnapshot,
): Promise<Buffer> {
  const b = printData(record),
    d = b.data,
    c = b.companySnapshot ?? draftCompany;

  const margin = 14,
    size = 8.5,
    lineHeight = 13;

  const pdf = new PDFDocument({
    size: [226.7717, 1133.86],
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

  const width = pdf.page.width - 2 * margin,
    bottom = pdf.page.height - margin - 20;
  const color = /^#[a-fA-F0-9]{6}$/.test(c?.primaryColor ?? '') ? c!.primaryColor : '#2d4f9e';
  let y = margin;

  const runs = (text: string) =>
    clean(text)
      .split(/([\u0900-\u097f]+)/)
      .filter(Boolean);

  const family = (text: string, bold: boolean) =>
    /[\u0900-\u097f]/.test(text) ? 'Devanagari' : bold ? 'Bold' : 'Body';

  function measure(text: string, fontSize: number, bold: boolean) {
    return runs(text).reduce(
      (sum, r) => sum + pdf.font(family(r, bold)).fontSize(fontSize).widthOfString(r),
      0,
    );
  }

  function wrap(text: string, fontSize: number, bold: boolean, maxWidth = width) {
    const lines: string[] = [];
    for (const paragraph of clean(text).split(/\r?\n/)) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (measure(line ? `${line} ${word}` : word, fontSize, bold) <= maxWidth) {
          line = line ? `${line} ${word}` : word;
          continue;
        }
        if (line) {
          lines.push(line);
          line = '';
        }
        for (const { segment } of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(
          word,
        )) {
          if (line && measure(line + segment, fontSize, bold) > maxWidth) {
            lines.push(line);
            line = '';
          }
          line += segment;
        }
      }
      if (line) lines.push(line);
    }
    return lines;
  }

  function draw(
    text: string,
    x: number,
    at: number,
    fontSize: number,
    bold = false,
    ink = '#20252d',
  ) {
    pdf.fillColor(ink);
    for (const run of runs(text)) {
      pdf.font(family(run, bold)).fontSize(fontSize).text(run, x, at, { lineBreak: false });
      x += pdf.widthOfString(run);
    }
  }

  function header() {
    y = margin;
    draw('BILTY / GOODS RECEIPT', margin, y, 10, true, color);
    y += 19;
    for (const line of wrap(
      `${b.number ?? 'Unnumbered draft'} | ${options.copy.toUpperCase()} COPY`,
      8,
      true,
    )) {
      draw(line, margin, y, 8, true);
      y += 12;
    }
    draw(`Version ${b.version} | ${b.createdAt.slice(0, 10)}`, margin, y, 8, false, '#69717c');
    y += 13;
    if (b.watermarks.length) {
      draw(b.watermarks.map(clean).join(' / '), margin, y, 9, true, '#ab261f');
      y += 14;
    }
    pdf
      .strokeColor('#d5d9df')
      .moveTo(margin, y)
      .lineTo(margin + width, y)
      .stroke();
    y += 12;
  }

  function newPage() {
    pdf.addPage();
    header();
  }

  function text(value: string, bold = false, fontSize = size) {
    for (const line of wrap(value, fontSize, bold)) {
      const height = Math.max(lineHeight, fontSize * 1.4);
      if (y + height > bottom) newPage();
      draw(line, margin, y, fontSize, bold);
      y += height;
    }
  }

  function section(title: string) {
    if (y + 50 > bottom) newPage();
    y += 9;
    draw(title.toUpperCase(), margin, y, 9, true, color);
    y += 16;
  }

  function line(label: string, value: unknown) {
    if (value === null || value === undefined || value === '') return;
    text(`${label}: ${String(value)}`);
  }

  const moneyFull = (v: number | null) => (v === null ? 'Not set' : `INR ${(v / 100).toFixed(2)}`);

  header();
  if (c) {
    text(c.name, true, 12);
    y += 3;
    if (c.logoUrl.startsWith('data:') && validInlineLogo(c.logoUrl)) {
      pdf.image(Buffer.from(c.logoUrl.split(',')[1]!, 'base64'), margin, y, { fit: [100, 38] });
      y += 43;
    }
    if (c.address) text(c.address);
    line('GSTIN / PAN', [c.gstin, c.pan].filter(Boolean).join(' / '));
    line('Contact', [c.phone, c.email].filter(Boolean).join(' | '));
  }

  for (const kind of ['consignor', 'consignee'] as const) {
    const p = d[kind];
    section(kind);
    text(p.name || 'Not supplied', true);
    if (p.address) text(p.address);
    line('GSTIN', p.gstin);
    line('Phone', p.phone);
  }

  section('Consignment');
  line('Route', `${d.fromLocation || '-'} to ${d.toLocation || '-'}`);
  line('Goods', d.goodsDescription);
  line(
    'Packages / packing',
    [d.packageCount, d.packingType].filter((v) => v !== null && v !== '').join(' / '),
  );
  line('Actual weight', d.actualWeight ? `${d.actualWeight.value} ${d.actualWeight.unit}` : null);
  line(
    'Chargeable weight',
    d.chargeableWeight ? `${d.chargeableWeight.value} ${d.chargeableWeight.unit}` : null,
  );
  line('Volume (CBM)', d.volumeCbm);
  line('Delivery', d.deliveryMode);
  line('Vehicle', d.vehicleNumber);
  line('Driver', [d.driverName, d.driverPhone].filter(Boolean).join(' | '));
  line('Remarks', d.remarks);

  if (d.ewayBills.length) {
    section('E-way bill references');
    text(d.ewayBills.join('  /  '));
  }

  if (d.invoices.length) {
    section('Invoices');
    d.invoices.forEach((v) =>
      line(
        v.number,
        [v.date, v.declaredValuePaise === null ? '' : moneyFull(v.declaredValuePaise)]
          .filter(Boolean)
          .join(' | ') || 'No date/value supplied',
      ),
    );
  }

  section('Freight and charges');
  line('Freight type', d.freightType);
  line('GST payable by', d.gstPayableBy);
  for (const [label, key] of [
    ['Freight', 'freightPaise'],
    ['Loading', 'loadingPaise'],
    ['Unloading', 'unloadingPaise'],
    ['Statistical', 'statisticalPaise'],
    ['Express', 'expressPaise'],
    ['Other', 'otherPaise'],
  ] as const)
    line(label, moneyFull(d.charges[key]));
  y += 4;
  text(`TOTAL: ${moneyFull(b.totalPaise)}`, true, 11);
  text(b.amountInWords);

  section('Insurance');
  line('Status', d.insurance.status);
  line('Insurer', d.insurance.company);
  line('Policy', d.insurance.policyNumber);
  line('Date', d.insurance.date);
  line('Amount', d.insurance.amountPaise === null ? null : moneyFull(d.insurance.amountPaise));
  line('Risk', d.insurance.risk);

  if (c && (c.bankDetails || c.jurisdiction || c.carriageTerms || c.demurrageTerms)) {
    section('Terms and payment');
    line('Bank', c.bankDetails);
    line('Jurisdiction', c.jurisdiction);
    line('Carriage terms', c.carriageTerms);
    line('Demurrage', c.demurrageTerms);
  }

  if (y + 90 > bottom) newPage();
  section('Acknowledgement');
  y += 12;
  text('Consignor: __________________');
  y += 10;
  text('Carrier: ____________________');
  y += 10;
  text('Received by: ________________');

  const pages = pdf.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    pdf.switchToPage(i);
    pdf.page.margins.bottom = 0;
    draw(
      `Page ${i + 1} of ${pages.count}`,
      margin,
      pdf.page.height - margin + 2,
      7,
      false,
      '#747b85',
    );
  }

  pdf.end();
  return ready;
}
