#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_STATE_FILE = '.backfill-data-at-rest-state.json';
const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 1000;

function parseArgs(argv) {
  const args = {
    dryRun: false,
    prefix: '',
    cursor: undefined,
    resume: false,
    maxBatches: undefined,
    batchSize: DEFAULT_BATCH_SIZE,
    workerDomain: undefined,
    r2Secret: undefined,
    stateFile: DEFAULT_STATE_FILE,
    keepState: false,
    timeoutMs: 60000
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      printHelp();
      process.exit(0);
    }

    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (token === '--resume') {
      args.resume = true;
      continue;
    }

    if (token === '--keep-state') {
      args.keepState = true;
      continue;
    }

    const valueToken = argv[index + 1];

    if (token === '--prefix') {
      args.prefix = valueToken ?? '';
      index += 1;
      continue;
    }

    if (token === '--cursor') {
      args.cursor = valueToken;
      index += 1;
      continue;
    }

    if (token === '--state-file') {
      args.stateFile = valueToken ?? DEFAULT_STATE_FILE;
      index += 1;
      continue;
    }

    if (token === '--worker-domain') {
      args.workerDomain = valueToken;
      index += 1;
      continue;
    }

    if (token === '--r2-secret') {
      args.r2Secret = valueToken;
      index += 1;
      continue;
    }

    if (token === '--max-batches') {
      const parsed = Number(valueToken);
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error('Invalid --max-batches value. It must be a positive number.');
      }
      args.maxBatches = Math.floor(parsed);
      index += 1;
      continue;
    }

    if (token === '--batch-size') {
      const parsed = Number(valueToken);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_BATCH_SIZE) {
        throw new Error(`Invalid --batch-size value. Use a number between 1 and ${MAX_BATCH_SIZE}.`);
      }
      args.batchSize = Math.floor(parsed);
      index += 1;
      continue;
    }

    if (token === '--timeout-ms') {
      const parsed = Number(valueToken);
      if (!Number.isFinite(parsed) || parsed < 1000) {
        throw new Error('Invalid --timeout-ms value. It must be >= 1000.');
      }
      args.timeoutMs = Math.floor(parsed);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function printHelp() {
  console.log('Usage: node scripts/encrypt-r2-backfill.mjs [options]');
  console.log('');
  console.log('Options:');
  console.log('  --dry-run               Scan and report, do not write encrypted objects');
  console.log('  --prefix <value>        Restrict scan to an R2 key prefix');
  console.log('  --batch-size <1-1000>   Number of objects per request (default: 100)');
  console.log('  --max-batches <n>       Stop after n batches');
  console.log('  --cursor <token>        Start from an explicit cursor');
  console.log('  --resume                Resume from state file cursor');
  console.log('  --state-file <path>     State file path (default: .backfill-data-at-rest-state.json)');
  console.log('  --keep-state            Keep state file even when completed');
  console.log('  --worker-domain <host>  Override DATA_WORKER_DOMAIN from .env');
  console.log('  --r2-secret <value>     Override R2_KEY_SECRET from .env');
  console.log('  --timeout-ms <ms>       Request timeout (default: 60000)');
  console.log('  -h, --help              Show this help text');
}

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function getConfigValue(name, overrides, envMap) {
  const overrideValue = overrides[name];
  if (typeof overrideValue === 'string' && overrideValue.length > 0) {
    return overrideValue;
  }

  const processValue = process.env[name];
  if (typeof processValue === 'string' && processValue.length > 0) {
    return processValue;
  }

  const envFileValue = envMap[name];
  if (typeof envFileValue === 'string' && envFileValue.length > 0) {
    return envFileValue;
  }

  return '';
}

function readStateFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeStateFile(filePath, state) {
  fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function removeStateFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

async function postBackfillBatch({ workerDomain, r2Secret, body, timeoutMs }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`https://${workerDomain}/api/admin/data-at-rest-backfill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Auth-Key': r2Secret
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = json && typeof json.error === 'string' ? json.error : `${response.status} ${response.statusText}`;
      throw new Error(`Backfill request failed: ${detail}`);
    }

    if (!json || typeof json !== 'object') {
      throw new Error('Backfill response was not valid JSON');
    }

    return json;
  } finally {
    clearTimeout(timeoutId);
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envPath = path.resolve(process.cwd(), '.env');
  const envFromFile = parseDotEnv(envPath);

  const workerDomain = getConfigValue('DATA_WORKER_DOMAIN', { DATA_WORKER_DOMAIN: args.workerDomain }, envFromFile)
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  const r2Secret = getConfigValue('R2_KEY_SECRET', { R2_KEY_SECRET: args.r2Secret }, envFromFile);

  if (!workerDomain) {
    throw new Error('Missing DATA_WORKER_DOMAIN. Set it in .env or pass --worker-domain.');
  }

  if (!r2Secret) {
    throw new Error('Missing R2_KEY_SECRET. Set it in .env or pass --r2-secret.');
  }

  const statePath = path.resolve(process.cwd(), args.stateFile);
  const priorState = args.resume ? readStateFile(statePath) : null;

  let cursor = args.cursor;
  if (!cursor && priorState && typeof priorState.cursor === 'string') {
    cursor = priorState.cursor;
  }

  const totals = {
    scanned: 0,
    eligible: 0,
    encrypted: 0,
    skippedEncrypted: 0,
    skippedNonJson: 0,
    failed: 0,
    batches: 0
  };

  console.log('R2 data-at-rest backfill starting');
  console.log(`Worker: https://${workerDomain}`);
  console.log(`Mode: ${args.dryRun ? 'dry-run' : 'write'}`);
  console.log(`Prefix: ${args.prefix || '(all keys)'}`);
  console.log(`Batch size: ${args.batchSize}`);
  if (cursor) {
    console.log(`Starting cursor: ${cursor}`);
  }

  while (true) {
    if (args.maxBatches !== undefined && totals.batches >= args.maxBatches) {
      console.log(`Stopping after max batches: ${args.maxBatches}`);
      break;
    }

    const batchBody = {
      dryRun: args.dryRun,
      prefix: args.prefix,
      cursor,
      batchSize: args.batchSize
    };

    const result = await postBackfillBatch({
      workerDomain,
      r2Secret,
      body: batchBody,
      timeoutMs: args.timeoutMs
    });

    totals.batches += 1;
    totals.scanned += Number(result.scanned || 0);
    totals.eligible += Number(result.eligible || 0);
    totals.encrypted += Number(result.encrypted || 0);
    totals.skippedEncrypted += Number(result.skippedEncrypted || 0);
    totals.skippedNonJson += Number(result.skippedNonJson || 0);
    totals.failed += Number(result.failed || 0);

    cursor = typeof result.nextCursor === 'string' && result.nextCursor.length > 0
      ? result.nextCursor
      : undefined;

    writeStateFile(statePath, {
      updatedAt: new Date().toISOString(),
      dryRun: args.dryRun,
      prefix: args.prefix,
      batchSize: args.batchSize,
      cursor: cursor ?? null,
      hasMore: Boolean(result.hasMore),
      totals
    });

    console.log(
      `Batch ${totals.batches}: scanned=${formatNumber(Number(result.scanned || 0))}, ` +
      `eligible=${formatNumber(Number(result.eligible || 0))}, ` +
      `encrypted=${formatNumber(Number(result.encrypted || 0))}, ` +
      `failed=${formatNumber(Number(result.failed || 0))}`
    );

    if (Array.isArray(result.failures) && result.failures.length > 0) {
      for (const failure of result.failures) {
        if (!failure || typeof failure.key !== 'string') {
          continue;
        }
        const errorMessage = typeof failure.error === 'string' ? failure.error : 'Unknown error';
        console.error(`  failure: ${failure.key} -> ${errorMessage}`);
      }
    }

    if (!result.hasMore) {
      break;
    }
  }

  if (!args.keepState && !cursor) {
    removeStateFile(statePath);
  }

  console.log('Backfill summary');
  console.log(`  batches: ${formatNumber(totals.batches)}`);
  console.log(`  scanned: ${formatNumber(totals.scanned)}`);
  console.log(`  eligible: ${formatNumber(totals.eligible)}`);
  console.log(`  encrypted: ${formatNumber(totals.encrypted)}`);
  console.log(`  skippedEncrypted: ${formatNumber(totals.skippedEncrypted)}`);
  console.log(`  skippedNonJson: ${formatNumber(totals.skippedNonJson)}`);
  console.log(`  failed: ${formatNumber(totals.failed)}`);

  if (totals.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown backfill error';
  console.error(`Backfill aborted: ${message}`);
  process.exit(1);
});
