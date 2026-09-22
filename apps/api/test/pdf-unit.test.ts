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
import { a4GridLayout, a4Layout, renderBiltyPdf } from '../src/modules/print/pdf';
import { createDraft, issueBilty, cancelBilty } from '../src/modules/bilty/domain';
import { actor, id, now, later, company, completeData } from './fixtures';

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
for (const format of ['a4', 'thermal'] as const) {
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
