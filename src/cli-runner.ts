import { execFile } from 'node:child_process';
import { createReadStream, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { parseArgs, promisify } from 'node:util';
import { aeatModels, pgcAccounts, catalogVersion, classifyPage, classifyPageWithContext, planContext, readPdfPages, suggestAccount, jevBackend, JevError } from './index.js';
import { normalizeText } from './decisions.js';
import type { AccountingContext, Backend } from './index.js';

const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;
const MAX_TEXT_BYTES = 24_000;
const exec = promisify(execFile);
const HELP = `aeat-classify ${VERSION} — AEAT documents and PGC account suggestions

Usage:
  aeat-classify classify <file.txt|file.pdf|-> [--threshold 0.95] [--max-pages 100]
  aeat-classify account <file.txt|-> --direction purchase|sale|payroll|finance|unknown
                        [--plan pgc|pgc-pymes] [--activity "Business activity"]
  aeat-classify doctor [--pdf]
  aeat-classify catalog <forms|accounts>
  aeat-classify schema
  aeat-classify skill
  aeat-classify --version

Classification/account output is JSON. Use - to read UTF-8 text from stdin.
--compact          Emit single-line JSON.
--fail-on-review   Exit 2 if any result requires review (including every PGC proposal).
--experimental-context  PDF only: retry uncertain pages with bounded neighboring-page context.
--help, -h         Show this help without a key or network access.
--version, -v      Show package version.
Use -- before a filename beginning with a dash.

TYPESAFE_API_KEY supplies the credential; TYPESAFE_MODEL optionally selects the model.
Text is sent to TypeSafe. No OCR or tax filing is performed. PDF input requires Poppler.
doctor, catalog, schema, skill and help are local and make no API calls.
Errors are JSON on stderr. Exit codes: 0 completed, 1 runtime, 2 review, 3 setup, 64 usage.
`;

class CliError extends Error {
  constructor(public code: string, message: string, public exitCode = 64) { super(message); }
}

export interface CliOptions {
  stdin?: AsyncIterable<Uint8Array | string>;
  stdinIsTTY?: boolean;
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
  env?: NodeJS.ProcessEnv;
  /** For embedders/tests; never selectable by untrusted command-line input. */
  backend?: Backend;
  checkBinary?: (name: string) => Promise<boolean>;
}

async function binaryAvailable(name: string): Promise<boolean> {
  try { await exec(name, ['-v'], { timeout: 5000, maxBuffer: 64 * 1024 }); return true; }
  catch { return false; }
}

async function readText(input: AsyncIterable<Uint8Array | string>): Promise<string> {
  let bytes = 0; const chunks: Buffer[] = [];
  for await (const chunk of input) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_TEXT_BYTES) throw new CliError('INPUT_TOO_LARGE', 'Text exceeds 24,000 UTF-8 bytes; split it into pages or transaction components.');
    chunks.push(buffer);
  }
  const buffer = Buffer.concat(chunks);
  if (buffer.subarray(0, 4).toString() === '%PDF' || buffer.includes(0)) throw new CliError('INVALID_INPUT', 'Expected UTF-8 text. Pass a PDF as a .pdf file path, not stdin.');
  try { return normalizeText(new TextDecoder('utf-8', { fatal: true }).decode(buffer)); }
  catch { throw new CliError('INVALID_INPUT', 'Input must be valid UTF-8 text within the page size limit.'); }
}

/** Agent-facing adapter; stdout stays data-only and the wrapper sets the returned exit code. */
export async function runCli(args: string[], options: CliOptions = {}): Promise<number> {
  const stdout = options.stdout ?? (text => { process.stdout.write(text); });
  const stderr = options.stderr ?? (text => { process.stderr.write(text); });
  const env = options.env ?? process.env;
  try {
    const parse = () => {
      try { return parseArgs({ args, allowPositionals: true, options: optionDefinitions }); }
      catch { throw new CliError('USAGE_ERROR', 'Invalid arguments. Run aeat-classify --help.'); }
    };
    const { values, positionals } = parse();
    if (values.help || !args.length) { stdout(HELP); return 0; }
    if (values.version) { stdout(`${VERSION}\n`); return 0; }
    const [command, file] = positionals;
    const allowed = commandOptions[command ?? ''];
    if (!allowed) throw new CliError('USAGE_ERROR', 'Unknown command. Run aeat-classify --help.');
    for (const key of Object.keys(values)) {
      if (!allowed.includes(key) && !['compact', 'help', 'version'].includes(key)) throw new CliError('USAGE_ERROR', 'An option does not apply to this command. Run aeat-classify --help.');
    }
    const output = (value: unknown) => stdout(JSON.stringify(value, null, values.compact ? undefined : 2) + '\n');
    const assertArity = (count: number) => { if (positionals.length !== count) throw new CliError('USAGE_ERROR', 'Wrong number of arguments. Run aeat-classify --help.'); };
    if (command === 'schema') {
      assertArity(1);
      output(JSON.parse(await readFile(new URL('../data/cli-schema.json', import.meta.url), 'utf8'))); return 0;
    }
    if (command === 'skill') {
      assertArity(1);
      stdout(await readFile(new URL('../skills/aeat-doc-classifier/SKILL.md', import.meta.url), 'utf8')); return 0;
    }
    if (command === 'catalog') {
      assertArity(2);
      if (file !== 'forms' && file !== 'accounts') throw new CliError('USAGE_ERROR', 'Choose catalog forms or catalog accounts.');
      output({ catalogVersion, [file]: file === 'forms' ? aeatModels : pgcAccounts }); return 0;
    }
    if (command === 'doctor') {
      assertArity(1);
      const check = options.checkBinary ?? binaryAvailable;
      const [pdfinfo, pdftotext] = await Promise.all([check('pdfinfo'), check('pdftotext')]);
      const nodeSupported = Number(process.versions.node.split('.')[0]) >= 22;
      const apiKeyConfigured = Boolean(env.TYPESAFE_API_KEY?.trim());
      const textReady = nodeSupported && apiKeyConfigured, pdfReady = textReady && pdfinfo && pdftotext;
      const ready = values.pdf ? pdfReady : textReady;
      output({ version: VERSION, node: process.versions.node, nodeSupported, apiKeyConfigured, pdf: { pdfinfo, pdftotext }, textReady, pdfReady, ready, networkChecked: false });
      return ready ? 0 : 3;
    }
    assertArity(2);
    const threshold = Number(values.threshold ?? '0.95');
    if (values.threshold?.trim() === '' || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new CliError('USAGE_ERROR', 'Threshold must be between 0 and 1.');
    const gate = { minConfidence: threshold, minProbability: threshold };
    const maxPages = Number(values['max-pages'] ?? '100');
    if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 1000) throw new CliError('USAGE_ERROR', 'max-pages must be an integer from 1 to 1000.');
    const isPdf = file!.toLowerCase().endsWith('.pdf');
    if (values['experimental-context'] && !isPdf) throw new CliError('USAGE_ERROR', '--experimental-context requires a PDF path with ordered pages.');
    let context: AccountingContext | undefined;
    if (command === 'account') {
      if (isPdf) throw new CliError('INVALID_INPUT', 'Extract and review one transaction component as text before requesting an account.');
      const direction = values.direction, plan = values.plan ?? 'pgc-pymes';
      if (!direction || !['purchase', 'sale', 'payroll', 'finance', 'unknown'].includes(direction)) throw new CliError('USAGE_ERROR', 'Specify --direction purchase, sale, payroll, finance or unknown.');
      if (!['pgc', 'pgc-pymes'].includes(plan)) throw new CliError('USAGE_ERROR', 'Plan must be pgc or pgc-pymes.');
      if ((values.activity?.length ?? 0) > 1000) throw new CliError('USAGE_ERROR', 'Business activity cannot exceed 1,000 characters.');
      context = { direction: direction as AccountingContext['direction'], plan: plan as AccountingContext['plan'], ...(values.activity === undefined ? {} : { activity: values.activity }) };
    }
    const backend: Backend = options.backend ?? { async ask(state, questions) {
      if (!env.TYPESAFE_API_KEY?.trim()) throw new CliError('MISSING_API_KEY', 'Set TYPESAFE_API_KEY in the agent execution environment.', 3);
      return jevBackend({ apiKey: env.TYPESAFE_API_KEY, model: env.TYPESAFE_MODEL }).ask(state, questions);
    } };
    let pages: Array<{ page: number; text: string }>;
    if (isPdf) {
      pages = await readPdfPages(file!, { maxPages });
      // Validate all pages before incurring API usage on the first page.
      for (const page of pages) normalizeText(page.text);
    } else {
      if (file === '-' && (options.stdinIsTTY ?? process.stdin.isTTY)) throw new CliError('USAGE_ERROR', 'Pipe UTF-8 text to stdin or provide a file path. Interactive input is not supported.');
      const input = file === '-' ? options.stdin ?? process.stdin : createReadStream(file!);
      pages = [{ page: 1, text: await readText(input) }];
    }
    if (command === 'account') {
      const result = await suggestAccount(pages[0]!.text, { context: context!, gate, backend });
      output(result);
      return values['fail-on-review'] && result.requiresHumanReview ? 2 : 0;
    }
    if (values['experimental-context']) for (const page of pages) planContext(pages, page.page);
    const results = [];
    for (const page of pages) results.push(values['experimental-context']
      ? await classifyPageWithContext(pages, page.page, { gate, backend })
      : { page: page.page, result: await classifyPage(page.text, { gate, backend }) });
    output(results);
    return values['fail-on-review'] && results.some(r => r.result.status !== 'accepted') ? 2 : 0;
  } catch (error) {
    let code = 'RUNTIME_ERROR', message = 'Operation failed. Check the input and run aeat-classify doctor.', exitCode = 1;
    if (error instanceof CliError) { ({ code, message, exitCode } = error); }
    else if (error instanceof JevError) {
      code = 'PROVIDER_ERROR'; message = error.message;
      if (error.status === 401 || error.status === 403) { code = 'AUTHENTICATION_ERROR'; exitCode = 3; }
    } else if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') { code = 'INPUT_NOT_FOUND'; message = 'Input file not found.'; }
    else if (error instanceof Error && error.message.startsWith('Install Poppler')) { code = 'MISSING_POPPLER'; message = error.message; exitCode = 3; }
    stderr(JSON.stringify({ error: { code, message } }) + '\n');
    return exitCode;
  }
}

const optionDefinitions = {
  help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' },
  compact: { type: 'boolean' }, 'fail-on-review': { type: 'boolean' },
  direction: { type: 'string' }, plan: { type: 'string' }, activity: { type: 'string' },
  threshold: { type: 'string' }, 'max-pages': { type: 'string' }, pdf: { type: 'boolean' },
  'experimental-context': { type: 'boolean' },
} as const;
const commandOptions: Record<string, string[]> = {
  classify: ['threshold', 'max-pages', 'fail-on-review', 'experimental-context'],
  account: ['threshold', 'direction', 'plan', 'activity', 'fail-on-review'],
  doctor: ['pdf'], catalog: [], schema: [], skill: [],
};
