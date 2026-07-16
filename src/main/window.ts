import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'

const useCustomTitleBar = process.platform === 'win32'

export function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 800,
    show: false,
    title: 'Fieldguide',
    frame: !useCustomTitleBar,
    autoHideMenuBar: useCustomTitleBar,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  if (useCustomTitleBar) {
    win.setMenuBarVisibility(false)
    const emitMax = () => {
      win.webContents.send('window:maximize-changed', win.isMaximized())
    }
    win.on('maximize', emitMax)
    win.on('unmaximize', emitMax)
  }

  win.on('ready-to-show', () => {
    win.show()
    win.focus()
  })

  // Fallback: ensure window becomes visible even if ready-to-show is delayed
  win.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      if (!win.isDestroyed() && !win.isVisible()) win.show()
    }, 1500)
  })

  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error('[Fieldguide] did-fail-load', code, description, url)
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
