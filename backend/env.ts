import fs from 'fs';
import path from 'path';

let loaded = false;

function parseAndAssign(content: string) {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Assign if not present or present but empty (avoid silently keeping empty values)
    if (!(key in process.env) || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

export function loadEnv(): void {
  if (loaded) return;
  loaded = true;

  const candidates: string[] = [];

  // 1) current working directory (where the process was started)
  candidates.push(path.resolve(process.cwd(), '.env'));

  // 2) same directory as this file (helps when the process cwd is different)
  try {
    const fileDir = path.dirname(new URL(import.meta.url).pathname);
    // On Windows the URL pathname may start with a leading slash; normalize it
    const normalized = fileDir.replace(/^\//, '');
    candidates.push(path.resolve(normalized, '.env'));
  } catch (err) {
    // ignore if import.meta.url isn't available for some loaders
  }

  for (const envPath of candidates) {
    if (!envPath) continue;
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        parseAndAssign(content);
        return;
      }
    } catch (e) {
      // continue to next candidate
    }
  }
}