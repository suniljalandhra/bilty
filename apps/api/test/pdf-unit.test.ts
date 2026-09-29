import { inflateSync } from 'node:zlib';
import { PNG } from 'pngjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFParse } from 'pdf-parse';
async function pdfParse(data: Buffer) {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return { text: result.text, numpages: result.total };
  } finally {
    await parser.destroy();
  }
}
async function pdfInfo(data: Buffer) {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getInfo({ parsePageInfo: true });
    return result;
  } finally {
    await parser.destroy();
  }
}
import {
  printOptions,
  a4GridLayout,
  a4Layout,
  renderBiltyPdf,
  LAYOUT_META,
} from '../src/modules/print/pdf';
import { createDraft, issueBilty, cancelBilty } from '../src/modules/bilty/domain';
import { BILTY_LAYOUTS, DEFAULT_LAYOUT } from '../src/modules/bilty/validation';
import { actor, id, now, later, company, completeData } from './fixtures';
import type { BiltyLayoutId, CompanySnapshot } from '@bilty/shared-types';

test('A4 layout keeps every major section in a non-overlapping printable region', () => {
  const layout = a4Layout();
  const ordered = [
    layout.header,
    layout.identity,
    layout.details,
    layout.consignor,
    layout.consignee,
    layout.goods,
    layout.total,
    layout.terms,
    layout.signatures,
  ];

  for (let i = 1; i < ordered.length; i += 1) {
    assert.ok(
      ordered[i]!.top >= ordered[i - 1]!.bottom,
      `${ordered[i]!.name} overlaps ${ordered[i - 1]!.name}`,
    );
  }
  assert.ok(layout.signatures.bottom < layout.footer.top, 'signatures overlap the page footer');
});
test('A4 grid follows traditional compact route and payment proportions', () => {
  const grid = a4GridLayout(802);
  assert.ok(grid.paymentWidth <= 150, 'payment choices should use a narrow side strip');
  assert.ok(grid.paymentWidth / 802 < 0.2, 'payment choices consume too much printable width');
  assert.ok(grid.routeWidth <= 200, 'From/To should be compact route boxes');
  assert.ok(
    grid.partyWidth >= grid.routeWidth * 2.5,
    'party address needs substantially more room than route labels',
  );
  assert.equal(grid.tableWidth + grid.paymentGap + grid.paymentWidth, 802);
});
for (const format of ['a4'] as const) {
  test(`${format} PDF includes all references, total, terms and status across pages`, async () => {
    const data = {
      ...completeData(),
      ewayBills: Array.from({ length: 60 }, (_, i) => String(440000000000 + i)),
      goodsDescription: 'Fragile instruments '.repeat(100),
    };
    const draft = createDraft(id, actor, data, now).bilty;
    const issued = issueBilty(
      draft,
      1,
      { ...company, carriageTerms: 'Handle carefully. '.repeat(60) },
      'EX/0001',
      actor,
      later,
    ).bilty;
    const pdf = await renderBiltyPdf(issued, { format, copy: 'driver' });
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
    const parsed = await pdfParse(pdf);
    assert.ok(parsed.numpages >= 2);
    for (const text of [
      'EX/0001',
      'Sender',
      'Receiver',
      '440000000059',
      '150.25',
      'DRIVER COPY',
      'Handle carefully',
    ])
      assert.ok(parsed.text.includes(text), `Missing ${text}`);
    const cancelled = cancelBilty(issued, 2, 'Cancelled', actor, later).bilty;
    assert.match(
      (await pdfParse(await renderBiltyPdf(cancelled, { format, copy: 'office' }))).text,
      /CANCELLED/,
    );
  });
}
test('draft PDF is explicitly labelled invalid', async () => {
  const b = createDraft(id, actor, {}, now).bilty;
  assert.match(
    (await pdfParse(await renderBiltyPdf(b, { format: 'a4', copy: 'office' }, company))).text,
    /DRAFT - NOT VALID/,
  );
});
test('ordinary A4 receipt fits one page without footer-only pages', async () => {
  const b = issueBilty(
    createDraft(id, actor, completeData(), now).bilty,
    1,
    company,
    'EX/0001',
    actor,
    later,
  ).bilty;
  const pdf = await renderBiltyPdf(b, { format: 'a4', copy: 'office' });
  const parsed = await pdfParse(pdf);
  assert.equal(parsed.numpages, 1);
  assert.match(parsed.text, /Page 1 of 1/);
  const info = await pdfInfo(pdf);
  const page = info.pages[0];
  assert.ok(page, 'missing A4 page metadata');
  assert.ok(page.width > page.height, 'A4 bilty must print in landscape orientation');
});

// Layout selection tests
test('BILTY_LAYOUTS array contains all expected layouts', () => {
  assert.deepEqual(BILTY_LAYOUTS, [
    'classic-grid',
    'route-focus',
    'freight-ledger',
    'dispatch-sheet',
    'modern-panels',
  ]);
});

test('DEFAULT_LAYOUT is classic-grid', () => {
  assert.equal(DEFAULT_LAYOUT, 'classic-grid');
});

test('LAYOUT_META provides metadata for all layouts', () => {
  assert.equal(LAYOUT_META.length, BILTY_LAYOUTS.length);
  for (const layoutId of BILTY_LAYOUTS) {
    const meta = LAYOUT_META.find((m) => m.id === layoutId);
    assert.ok(meta, `Missing metadata for layout ${layoutId}`);
    assert.ok(meta.name, `Missing name for layout ${layoutId}`);
    assert.ok(meta.description, `Missing description for layout ${layoutId}`);
  }
});

test('legacy company without biltyLayout defaults to classic-grid', async () => {
  const legacyCompany: CompanySnapshot = { ...company };
  delete (legacyCompany as Partial<CompanySnapshot>).biltyLayout;
  const b = issueBilty(
    createDraft(id, actor, completeData(), now).bilty,
    1,
    legacyCompany,
    'EX/0001',
    actor,
    later,
  ).bilty;
  const pdf = await renderBiltyPdf(b, { format: 'a4', copy: 'office' });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  const parsed = await pdfParse(pdf);
  assert.ok(parsed.text.includes('EX/0001'));
});

// Test each layout renders correctly for single-page docs
for (const layoutId of BILTY_LAYOUTS) {
  test(`${layoutId} layout renders single-page A4 document correctly`, async () => {
    const layoutCompany: CompanySnapshot = { ...company, biltyLayout: layoutId };
    const b = issueBilty(
      createDraft(id, actor, completeData(), now).bilty,
      1,
      layoutCompany,
      `${layoutId.toUpperCase()}/0001`,
      actor,
      later,
    ).bilty;
    const pdf = await renderBiltyPdf(b, { format: 'a4', copy: 'office' });
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
    const parsed = await pdfParse(pdf);
    assert.equal(parsed.numpages, 1);
    // All layouts should include key content
    for (const text of [
      `${layoutId.toUpperCase()}/0001`,
      'Sender',
      'Receiver',
      'Noida',
      'Mumbai',
    ]) {
      assert.ok(parsed.text.includes(text), `${layoutId}: Missing ${text}`);
    }
    const info = await pdfInfo(pdf);
    const page = info.pages[0];
    assert.ok(page, `${layoutId}: missing page metadata`);
    assert.ok(page.width > page.height, `${layoutId}: must be landscape orientation`);
  });
}

// Test each layout renders correctly for multi-page docs
for (const layoutId of BILTY_LAYOUTS) {
  test(`${layoutId} layout renders multi-page A4 document correctly`, async () => {
    const layoutCompany: CompanySnapshot = {
      ...company,
      biltyLayout: layoutId,
      carriageTerms: 'Handle with extreme care. '.repeat(80),
    };
    const data = {
      ...completeData(),
      ewayBills: Array.from({ length: 50 }, (_, i) => String(440000000000 + i)),
      goodsDescription: 'Fragile medical instruments requiring special handling '.repeat(40),
    };
    const b = issueBilty(
      createDraft(id, actor, data, now).bilty,
      1,
      layoutCompany,
      `${layoutId.toUpperCase()}/0002`,
      actor,
      later,
    ).bilty;
    const pdf = await renderBiltyPdf(b, { format: 'a4', copy: 'driver' });
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
    const parsed = await pdfParse(pdf);
    assert.ok(parsed.numpages >= 2, `${layoutId}: expected multipage, got ${parsed.numpages}`);
    // Should include content from both first and continuation pages
    for (const text of ['DRIVER COPY', '440000000049', 'Handle with extreme care']) {
      assert.ok(parsed.text.includes(text), `${layoutId}: Missing ${text}`);
    }
  });
}

test('layout choice is frozen in issued company snapshot', async () => {
  const layoutCompany: CompanySnapshot = { ...company, biltyLayout: 'modern-panels' };
  const b = issueBilty(
    createDraft(id, actor, completeData(), now).bilty,
    1,
    layoutCompany,
    'MP/0001',
    actor,
    later,
  ).bilty;
  // The bilty's company snapshot should preserve the layout choice
  assert.equal(b.companySnapshot?.biltyLayout, 'modern-panels');
});

for (const layoutId of BILTY_LAYOUTS.filter((id) => id !== 'classic-grid')) {
  test(`${layoutId} preserves populated fields and measured overflow`, async () => {
    const data = {
      ...completeData(),
      deliveryMode: 'door',
      gstPayableBy: 'agency',
      insurance: { status: 'insured', company: 'InsurerMarker', policyNumber: 'PolicyMarker' },
    };
    const profile = {
      ...company,
      biltyLayout: layoutId,
      bankDetails: 'BankMarker',
      demurrageTerms: 'DemurrageMarker',
      pan: 'PanMarker',
    };
    const record = issueBilty(
      createDraft(id, actor, data, now).bilty,
      1,
      profile,
      'EX/0001',
      actor,
      later,
    ).bilty;
    const parsed = await pdfParse(await renderBiltyPdf(record, { format: 'a4', copy: 'office' }));
    assert.equal(parsed.numpages, 1);
    for (const value of [
      'InsurerMarker',
      'PolicyMarker',
      'BankMarker',
      'DemurrageMarker',
      'PanMarker',
      '320',
      'INV-1',
      'agency',
      'door',
    ])
      assert.ok(parsed.text.includes(value), `${layoutId} missing ${value}`);
    record.data.consignor.address = 'Long address '.repeat(140) + 'ADDRESS-END';
    const long = await renderBiltyPdf(record, { format: 'a4', copy: 'office' });
    const overflow = await pdfParse(long);
    assert.ok(overflow.numpages > 1);
    assert.ok(overflow.text.includes('ADDRESS-END'));
    for (const page of (await pdfInfo(long)).pages) {
      assert.ok(Math.abs(page.width - 841.89) < 1 && Math.abs(page.height - 595.28) < 1);
    }
  });
}

function decodedStreams(pdf: Buffer) {
  const raw = pdf.toString('latin1');
  return Array.from(raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g), (match) => {
    try {
      return inflateSync(Buffer.from(match[1]!, 'latin1')).toString('latin1');
    } catch {
      return '';
    }
  }).join('\n');
}
test('every layout embeds the logo and both selected colours', async () => {
  const png = new PNG({ width: 2, height: 2 });
  png.data.fill(255);
  const logoUrl = 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');
  for (const biltyLayout of BILTY_LAYOUTS) {
    const profile = {
      ...company,
      biltyLayout,
      logoUrl,
      primaryColor: '#ff0000',
      accentColor: '#00ff00',
    };
    const record = issueBilty(
      createDraft(id, actor, completeData(), now).bilty,
      1,
      profile,
      'EX/0001',
      actor,
      later,
    ).bilty;
    const pdf = await renderBiltyPdf(record, { format: 'a4', copy: 'office' });
    assert.match(pdf.toString('latin1'), /\/Subtype \/Image/, biltyLayout);
    const streams = decodedStreams(pdf);
    assert.match(streams, /1 0 0 (scn|SCN)/, biltyLayout);
    assert.match(streams, /0 1 0 (scn|SCN)/, biltyLayout);
  }
});
test('legacy issued PDFs keep Classic even when current settings choose another layout', async () => {
  const record = issueBilty(
    createDraft(id, actor, completeData(), now).bilty,
    1,
    company,
    'EX/0001',
    actor,
    later,
  ).bilty;
  delete record.companySnapshot!.biltyLayout;
  const legacy = await pdfParse(
    await renderBiltyPdf(
      record,
      { format: 'a4', copy: 'office' },
      { ...company, biltyLayout: 'modern-panels' },
    ),
  );
  record.companySnapshot!.biltyLayout = 'classic-grid';
  const explicit = await pdfParse(await renderBiltyPdf(record, { format: 'a4', copy: 'office' }));
  assert.equal(legacy.text, explicit.text);
});
test('PDF options accept only A4, including the default', () => {
  assert.equal(printOptions.parse({}).format, 'a4');
  assert.throws(() => printOptions.parse({ format: 'thermal' }));
});
