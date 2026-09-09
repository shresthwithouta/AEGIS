#!/usr/bin/env node
/**
 * Start the Python vision service.
 *
 * Exists so nobody has to remember a platform-specific venv path mid-demo.
 * Finds the interpreter, checks what is installed, tells you plainly what the
 * service will and will not be able to do, and starts it.
 *
 *   npm run vision
 *   npm run vision -- --port 8001
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SERVICE = path.join(here, '..', 'services', 'vision');

const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const PORT = portIdx >= 0 ? args[portIdx + 1] : '8000';

const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const YEL = '\x1b[33m';
const GRN = '\x1b[32m';
const OFF = '\x1b[0m';

/** The venv interpreter, whichever layout this platform uses. */
function findPython() {
  const candidates = [
    path.join(SERVICE, '.venv', 'Scripts', 'python.exe'), // Windows
    path.join(SERVICE, '.venv', 'bin', 'python3'), // macOS / Linux
    path.join(SERVICE, '.venv', 'bin', 'python'),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

const python = findPython();

if (!python) {
  console.error(`
${BOLD}No virtualenv found in services/vision.${OFF}

Create one, then install:

  cd services/vision
  python -m venv .venv
  .venv/Scripts/python -m pip install -r requirements.txt      ${DIM}# Windows${OFF}
  .venv/bin/python -m pip install -r requirements.txt          ${DIM}# macOS / Linux${OFF}

The command centre runs fine without this — stage 1 falls back to the incident
model and labels itself SIMULATED.
`);
  process.exit(1);
}

/** Report what is actually importable, so the capability line is not a guess. */
function has(mod) {
  const r = spawnSync(python, ['-c', `import ${mod}`], { stdio: 'ignore' });
  return r.status === 0;
}

const torch = has('torch');
const ultra = has('ultralytics');
const weights = existsSync(path.join(SERVICE, 'weights', 'unet_floodnet.pt'));

console.log(`\n${BOLD}AEGIS vision service${OFF}  ${DIM}${python}${OFF}\n`);
console.log(
  `  flood extent   ${weights ? `${GRN}trained U-Net${OFF}` : `${YEL}classical water index${OFF} ${DIM}(no weights — see services/vision/README.md)${OFF}`}`
);
console.log(
  `  detection      ${ultra ? `${GRN}YOLOv8, real COCO classes${OFF}` : `${YEL}unavailable${OFF} ${DIM}(pip install ultralytics)${OFF}`}`
);
console.log(`  torch          ${torch ? `${GRN}installed${OFF}` : `${YEL}not installed${OFF}`}`);
console.log(`\n  ${DIM}Point the app at it:  VISION_SERVICE_URL=http://127.0.0.1:${PORT}  in .env.local${OFF}\n`);

const child = spawn(python, ['-m', 'uvicorn', 'app:app', '--port', PORT, '--host', '127.0.0.1'], {
  cwd: SERVICE,
  stdio: 'inherit',
});

const stop = () => {
  child.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => process.exit(code ?? 0));
