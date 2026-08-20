import fs from 'fs';

import { InkEngine } from '../src/lib/ink-engine';

async function main() {
  const bytes = fs.readFileSync('fixtures/epub_reader_test_suite_fixed.epub');
  const book = await InkEngine.load(bytes);
  console.log('title', book.metadata.title);
  console.log('authors', book.metadata.authors);
  console.log(
    'spine',
    book.spine.length,
    book.spine.map((s) => s.href).join(', ')
  );
  console.log(
    'toc',
    book.toc.length,
    book.toc.map((t) => t.label).join(' | ')
  );
  const section = await book.getSection(0);
  console.log('section0', section.id, section.href, section.xhtml.includes('<strong>'));
  const html = await book.getRenderableHtml(section.id);
  console.log(
    'renderable has strong',
    html.includes('<strong>'),
    'has reader css',
    html.includes('data-ink-reader')
  );
  console.log('next', book.getNextSection(section.id)?.href);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
