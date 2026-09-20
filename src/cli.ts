#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { classifyPage, readPdfPages, suggestAccount } from './index.js';
import type { AccountingContext } from './index.js';

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({ allowPositionals: true, options: {
    help: { type: 'boolean', short: 'h' }, direction: { type: 'string' }, plan: { type: 'string', default: 'pgc-pymes' },
    activity: { type: 'string' }, threshold: { type: 'string', default: '0.95' }, 'max-pages': { type: 'string', default: '100' },
  } });
  if (values.help) {
    console.log('Usage: aeat-classify <classify|account> <file.txt|file.pdf> [--threshold 0.95]\nAccount: --direction purchase|sale|payroll|finance --plan pgc|pgc-pymes [--activity "..."]\nPDF: --max-pages 100 (classification only)\nReads TYPESAFE_API_KEY. Text is sent to TypeSafe; output JSON excludes input text.');
    return;
  }
  const [command, file] = positionals;
  if (!['classify', 'account'].includes(command ?? '') || !file || positionals.length !== 2) throw new Error('Use --help for usage.');
  const threshold = Number(values.threshold);
  if (!values.threshold?.trim() || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('Threshold must be between 0 and 1.');
  const gate = { minConfidence: threshold, minProbability: threshold };
  const isPdf = file.toLowerCase().endsWith('.pdf');
  if (command === 'account' && isPdf) throw new Error('Extract and review one transaction component as text before requesting an account suggestion.');
  if (command === 'account') {
    const context = { direction: values.direction ?? 'unknown', plan: values.plan, activity: values.activity } as AccountingContext;
    console.log(JSON.stringify(await suggestAccount(await readFile(file, 'utf8'), { context, gate }), null, 2));
    return;
  }
  const pages = isPdf ? await readPdfPages(file, { maxPages: Number(values['max-pages']) }) : [{ page: 1, text: await readFile(file, 'utf8') }];
  // Sequential calls bound API spending and preserve page order.
  const results = [];
  for (const page of pages) results.push({ page: page.page, result: await classifyPage(page.text, { gate }) });
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Classification failed.');
  process.exitCode = 1;
});
