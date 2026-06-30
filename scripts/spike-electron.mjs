/**
 * Spike: Minimal Electron smoke test — loads UA Dashboard.
 *
 * Usage: npx electron scripts/spike-electron.mjs
 */
import { app, BrowserWindow } from 'electron';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fieldguideRoot = resolve(__dirname, '..');
const dashboardDist = resolve(
  fieldguideRoot,
  '..',
  'Understand-Anything',
  'understand-anything-plugin',
  'packages',
  'dashboard',
  'dist',
  'index.html',
);

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load Dashboard with a sample graph
  // For a real app, we'd serve from a local server; for smoke test, load the file
  win.loadFile(dashboardDist);

  win.webContents.on('did-finish-load', () => {
    console.log('✅ UA Dashboard loaded successfully in Electron BrowserWindow');
    console.log(`   URL: file://${dashboardDist}`);
    setTimeout(() => {
      console.log('✅ Smoke test complete — closing in 3s');
      setTimeout(() => app.quit(), 3000);
    }, 2000);
  });

  win.webContents.on('did-fail-load', (event, code, desc) => {
    console.error(`❌ Load failed: ${code} — ${desc}`);
    app.exit(1);
  });
});
