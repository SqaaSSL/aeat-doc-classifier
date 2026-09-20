import { spawn } from 'node:child_process';

/** Call from an agent tool handler. Pass document content as text, never shell code. */
export async function classifyText(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 24_000) {
    throw new Error('Expected UTF-8 page text of at most 24,000 bytes.');
  }
  return new Promise((resolve, reject) => {
    const child = spawn('aeat-classify', ['classify', '-', '--compact', '--fail-on-review'], {
      env: process.env, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
      signal: AbortSignal.timeout(180_000),
    });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', () => reject(new Error('Could not execute aeat-classify; check installation or timeout.')));
    child.stdin.on('error', () => { /* Early CLI exit is handled by close below. */ });
    child.once('close', code => {
      try {
        if (code === 0 || code === 2) resolve({ reviewRequired: code === 2, pages: JSON.parse(stdout) });
        else reject(new Error(JSON.parse(stderr).error?.message ?? 'Classification failed.'));
      } catch { reject(new Error('CLI did not return the expected JSON.')); }
    });
    child.stdin.end(text);
  });
}
