import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const apiKey = process.env.GEMINI_API_KEY?.trim();
const files = [...new Set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean))];
const tracked = new Set(git('ls-files', '-z').split('\0').filter(Boolean));
const leaks = [];
const looksLikeKey = (text) => /\bAIza[A-Za-z0-9_-]{30,}\b/u.test(text) || /\bAQ\.[A-Za-z0-9_-]{30,}\b/u.test(text);
const containsSecret = (text) => looksLikeKey(text) || Boolean(apiKey && (text.includes(apiKey) || text.includes(encodeURIComponent(apiKey))));
let envIgnored = false;
try { envIgnored = git('check-ignore', '--no-index', 'src/.env.local').trim() === 'src/.env.local'; } catch { /* Fail below. */ }
for (const file of files) {
  const name = basename(file);
  if (/^\.env(?:\.|$)/u.test(name) && name !== '.env.example') leaks.push({ file, reason: 'environment-file-would-be-published' });
  const content = await readFile(resolve(root, file));
  if (containsSecret(content.toString('utf8'))) leaks.push({ file, reason: 'credential-detected' });
}
for (const [label, diff] of [
  ['staged changes', git('diff', '--cached', '--binary')],
  ['committed branch changes', git('diff', '--binary', 'origin/main...HEAD')],
]) {
  if (containsSecret(diff)) leaks.push({ file: label, reason: 'credential-detected' });
}
const report = {
  keyConfiguredLocally: Boolean(apiKey),
  envIgnored,
  envTracked: tracked.has('src/.env.local'),
  filesChecked: files.length,
  leaksFound: leaks.length,
  ...(leaks.length ? { findings: leaks } : {}),
};
console.log(JSON.stringify(report, null, 2));
if (!envIgnored || report.envTracked || leaks.length) process.exitCode = 1;
