import PDFDocument from 'pdfkit';
import { join } from 'node:path';
import type { BiltyRecord, BiltyLayoutId, CompanySnapshot } from '@bilty/shared-types';
import { printData } from '../bilty/domain';
import { validInlineLogo } from '../company/logo';
import type { PrintOptions } from './pdf';

type Section = { title: string; values: string[] };
type SectionId =
  | 'route'
  | 'consignor'
  | 'consignee'
  | 'goods'
  | 'charges'
  | 'transport'
  | 'insurance'
  | 'references'
  | 'company'
  | 'terms';
type Row = [SectionId, number][];
// Weights are relative column widths. Content and pagination are shared across designs.
const plans: Record<Exclude<BiltyLayoutId, 'classic-grid'>, Row[]> = {
  'route-focus': [
    [['route', 1]],
    [
      ['consignor', 1],
      ['consignee', 1],
    ],
    [
      ['goods', 3],
      ['charges', 2],
    ],
    [
      ['transport', 1],
      ['insurance', 1],
      ['references', 1],
    ],
    [
      ['company', 1],
      ['terms', 2],
    ],
  ],
  'freight-ledger': [
    [
      ['route', 1],
      ['transport', 1],
    ],
    [
      ['consignor', 1],
      ['consignee', 1],
    ],
    [
      ['charges', 2],
      ['goods', 3],
    ],
    [
      ['references', 3],
      ['insurance', 2],
    ],
    [
      ['company', 1],
      ['terms', 2],
    ],
  ],
  'dispatch-sheet': [
    [
      ['transport', 1],
      ['route', 1],
    ],
    [
      ['consignor', 1],
      ['consignee', 1],
    ],
    [
      ['goods', 3],
      ['insurance', 2],
    ],
    [
      ['references', 3],
      ['charges', 2],
    ],
    [
      ['company', 1],
      ['terms', 2],
    ],
  ],
  'modern-panels': [
    [['route', 1]],
    [
      ['consignor', 1],
      ['consignee', 1],
    ],
    [
      ['goods', 2],
      ['references', 2],
      ['charges', 1.5],
    ],
    [
      ['transport', 1],
      ['insurance', 1],
    ],
    [
      ['company', 1],
      ['terms', 2],
    ],
  ],
};
const money = (v: number | null) => (v === null ? '-' : `INR ${(v / 100).toFixed(2)}`);
const field = (label: string, v: unknown) =>
  `${label}: ${v === null || v === undefined || v === '' ? '-' : v}`;
const clean = (v: string) => v.replace(/[—–]/g, '-');

export async function renderPanelLayout(
  record: BiltyRecord,
  options: PrintOptions,
  layout: Exclude<BiltyLayoutId, 'classic-grid'>,
  draftCompany?: CompanySnapshot,
): Promise<Buffer> {
  const b = printData(record),
    d = b.data,
    c = b.companySnapshot ?? draftCompany;
  const primary = /^#[a-f\d]{6}$/i.test(c?.primaryColor ?? '') ? c!.primaryColor : '#1a3a6e';
  const accent = /^#[a-f\d]{6}$/i.test(c?.accentColor ?? '') ? c!.accentColor : '#1d7a4c';
  const pdf = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 20,
    bufferPages: true,
    info: { Title: `Bilty ${b.number ?? 'Draft'}`, Author: c?.name ?? 'Bilty' },
  });
  for (const [name, file] of [
    ['Body', 'NotoSans-Regular.ttf'],
    ['Bold', 'NotoSans-Bold.ttf'],
    ['Hindi', 'NotoSansDevanagari-Regular.ttf'],
  ]) {
    pdf.registerFont(name!, join(__dirname, '../../../assets/fonts', file!));
  }
  const chunks: Buffer[] = [];
  const ready = new Promise<Buffer>((resolve, reject) => {
    pdf.on('data', (chunk) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
  });
  const width = pdf.page.width - 40,
    bottom = pdf.page.height - 36;
  const size = 7.5,
    leading = 11;
  const runs = (v: string) =>
    clean(v)
      .split(/([\u0900-\u097f]+)/)
      .filter(Boolean);
  const font = (v: string, bold: boolean) =>
    /[\u0900-\u097f]/.test(v) ? 'Hindi' : bold ? 'Bold' : 'Body';
  function measure(v: string, fontSize = size, bold = false) {
    return runs(v).reduce(
      (sum, run) => sum + pdf.font(font(run, bold)).fontSize(fontSize).widthOfString(run),
      0,
    );
  }
  function text(v: string, x: number, y: number, fontSize = size, bold = false, color = '#20252d') {
    for (const run of runs(v)) {
      pdf
        .font(font(run, bold))
        .fontSize(fontSize)
        .fillColor(color)
        .text(run, x, y, { lineBreak: false });
      x += pdf.widthOfString(run);
    }
  }
  function wrap(v: string, available: number, fontSize = size, bold = false): string[] {
    const result: string[] = [];
    for (const paragraph of clean(v).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (measure(candidate, fontSize, bold) <= available) {
          line = candidate;
          continue;
        }
        if (line) {
          result.push(line);
          line = '';
        }
        // Handle long unbroken identifiers without losing characters.
        for (const char of word) {
          if (line && measure(line + char, fontSize, bold) > available) {
            result.push(line);
            line = '';
          }
          line += char;
        }
      }
      result.push(line);
    }
    return result;
  }
  function header(continuation = false) {
    const modern = layout === 'modern-panels';
    const dispatch = layout === 'dispatch-sheet';
    if (modern) pdf.rect(20, 20, 4, 48).fill(accent);
    else pdf.rect(20, 20, width, dispatch ? 3 : 5).fill(primary);
    pdf.rect(20, 70, width, 1.5).fill(accent);
    let x = modern ? 32 : 20;
    if (c?.logoUrl && validInlineLogo(c.logoUrl)) {
      try {
        pdf.image(Buffer.from(c.logoUrl.split(',')[1]!, 'base64'), x, 30, { fit: [40, 32] });
        x += 48;
      } catch {
        /* Invalid historic logos must not prevent printing. */
      }
    }
    // Full company name/address appear in Company details; header is a bounded masthead.
    const nameLines = wrap(c?.name || 'Transport Company', width - (x - 20) - 240, 15, true);
    text(nameLines[0] ?? '', x, 29, 15, true, primary);
    text(continuation ? 'BILTY CONTINUATION' : 'BILTY / LORRY RECEIPT', x, 52, 8, true);
    const right = 20 + width - 225;
    let numberSize = 11;
    while (numberSize > 6 && measure(b.number ?? 'DRAFT', numberSize, true) > 225)
      numberSize -= 0.5;
    text(b.number ?? 'DRAFT', right, 29, numberSize, true, primary);
    text(`${options.copy.toUpperCase()} COPY`, right, 46, 8, true);
    text(`Date: ${(b.issuedAt ?? b.createdAt).slice(0, 10)}`, right + 100, 46, 8);
    return 80;
  }
  function party(title: string, p: typeof d.consignor): Section {
    return {
      title,
      values: [p.name || '-', p.address || '-', field('GSTIN', p.gstin), field('Phone', p.phone)],
    };
  }
  const weight = (v: typeof d.actualWeight) => (v ? `${v.value} ${v.unit}` : '-');
  const sections: Record<SectionId, Section> = {
    route: { title: 'Route', values: [field('From', d.fromLocation), field('To', d.toLocation)] },
    consignor: party('Consignor', d.consignor),
    consignee: party('Consignee', d.consignee),
    goods: {
      title: 'Goods particulars',
      values: [
        d.goodsDescription || '-',
        `Packages: ${d.packageCount ?? '-'} | Packing: ${d.packingType || '-'}`,
        `Actual weight: ${weight(d.actualWeight)} | Chargeable: ${weight(d.chargeableWeight)}`,
        field('Volume (CBM)', d.volumeCbm),
        ...(d.remarks ? [field('Remarks', d.remarks)] : []),
      ],
    },
    charges: {
      title: 'Freight ledger',
      values: [
        field('Freight', money(d.charges.freightPaise)),
        field('Loading', money(d.charges.loadingPaise)),
        field('Unloading', money(d.charges.unloadingPaise)),
        field('Statistical', money(d.charges.statisticalPaise)),
        field('Express', money(d.charges.expressPaise)),
        field('Other', money(d.charges.otherPaise)),
        field('TOTAL', money(b.totalPaise)),
      ],
    },
    transport: {
      title: 'Dispatch details',
      values: [
        field('Vehicle', d.vehicleNumber),
        field('Driver', [d.driverName, d.driverPhone].filter(Boolean).join(' / ')),
        `Delivery: ${d.deliveryMode ?? '-'} | Freight: ${d.freightType ?? '-'}`,
        field('GST payable by', d.gstPayableBy),
      ],
    },
    insurance: {
      title: 'Insurance',
      values: [
        field('Status', d.insurance.status),
        ...(d.insurance.status === 'insured'
          ? [
              field('Company', d.insurance.company),
              field('Policy', d.insurance.policyNumber),
              `Date: ${d.insurance.date ?? '-'} | Amount: ${money(d.insurance.amountPaise)}`,
            ]
          : []),
        ...(d.insurance.risk ? [field('Risk', d.insurance.risk)] : []),
      ],
    },
    references: {
      title: 'Invoice & e-way references',
      values: [
        ...d.invoices.map((i) => `${i.number} | ${i.date ?? '-'} | ${money(i.declaredValuePaise)}`),
        field('E-way bills', d.ewayBills.join(', ')),
      ],
    },
    company: {
      title: 'Company details',
      values: [
        c?.name || 'Transport Company',
        c?.address || '-',
        [c?.phone, c?.email].filter(Boolean).join(' | '),
        `GSTIN: ${c?.gstin || '-'} | PAN: ${c?.pan || '-'}`,
        field('Jurisdiction', c?.jurisdiction || 'Delhi'),
      ],
    },
    terms: {
      title: 'Terms & payment',
      values: [
        field('Amount in words', b.amountInWords),
        ...(c?.bankDetails ? [field('Bank', c.bankDetails)] : []),
        ...(c?.carriageTerms ? [field('Carriage', c.carriageTerms)] : []),
        field(
          'Demurrage',
          c?.demurrageTerms ||
            'Chargeable after 7 days @ Rs. 5/- per day per Qtl. on weight charged',
        ),
        "Transit risk: Goods are carried at owner's risk. Consignor/consignee must arrange insurance. Carrier is not responsible for loss, damage, theft, leakage or delay, including natural disasters or acts of God.",
      ],
    },
  };
  let y = header();
  function newPage() {
    pdf.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
    y = header(true);
  }
  for (const row of plans[layout]) {
    const total = row.reduce((sum, [, value]) => sum + value, 0);
    const available = width - 8 * (row.length - 1);
    const cells = row.map(([id, weight]) => {
      const w = (available * weight) / total;
      return {
        section: sections[id],
        width: w,
        lines: sections[id].values.flatMap((v) => wrap(v, w - 16)),
      };
    });
    const count = Math.max(...cells.map((cell) => cell.lines.length));
    const required = 25 + count * leading;
    // Keep rows together when they fit on a fresh page; split oversized rows by measured lines.
    if (y + required > bottom && required <= bottom - 80) newPage();
    let offset = 0;
    while (offset < count) {
      const capacity = Math.floor((bottom - y - 25) / leading);
      if (capacity < 1) {
        newPage();
        continue;
      }
      const n = Math.min(capacity, count - offset),
        height = 25 + n * leading;
      let x = 20;
      for (const cell of cells) {
        const ledger = layout === 'freight-ledger';
        pdf
          .rect(x, y, cell.width, height)
          .lineWidth(0.5)
          .strokeColor(ledger ? '#8c939d' : '#cbd2db')
          .stroke();
        pdf.rect(x, y, cell.width, 17).fill(layout === 'modern-panels' ? '#eef2f7' : '#f3f5f7');
        pdf
          .rect(x, y, ledger ? cell.width : 3, ledger ? 1.5 : 17)
          .fill(cell.section.title === 'Freight ledger' ? primary : accent);
        text(
          cell.section.title.toUpperCase() + (offset ? ' (CONT.)' : ''),
          x + 8,
          y + 3,
          8,
          true,
          primary,
        );
        cell.lines
          .slice(offset, offset + n)
          .forEach((line, i) => text(line, x + 8, y + 20 + i * leading));
        x += cell.width + 8;
      }
      y += height + 7;
      offset += n;
      if (offset < count) newPage();
    }
  }
  if (y + 33 > bottom) newPage();
  for (const [i, label] of [
    'Consignor signature',
    'Transport operator signature',
    'Received by',
  ].entries()) {
    const x = 20 + (i * width) / 3;
    pdf
      .moveTo(x, y + 18)
      .lineTo(x + width / 3 - 20, y + 18)
      .strokeColor('#8c939d')
      .lineWidth(0.5)
      .stroke();
    text(label, x, y + 22, 7);
  }
  const pages = pdf.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    pdf.switchToPage(i);
    if (b.watermarks.length) {
      pdf.save().fillColor('#ff0000').opacity(0.12).font('Bold').fontSize(42);
      pdf.rotate(-30, { origin: [pdf.page.width / 2, pdf.page.height / 2] });
      pdf.text(clean(b.watermarks.join(' / ')), 180, 280, { lineBreak: false });
      pdf.restore();
    }
    pdf.page.margins.bottom = 0;
    text(`Page ${i + 1} of ${pages.count}`, 20, pdf.page.height - 20, 7);
  }
  pdf.end();
  return ready;
}
