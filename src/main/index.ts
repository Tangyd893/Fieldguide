import { app, BrowserWindow, dialog } from 'electron'
import { registerDashboardProtocol } from './ua/dashboard'
import { createWindow } from './window'
import { logError } from './logger'

// Side-effect import: registers all IPC handlers
import './ipc/index'
import { setDashboardUrl } from './ipc/index'

let mainWindow: BrowserWindow | null = null

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  let dashboardUrl = ''
  try {
    dashboardUrl = registerDashboardProtocol()
    setDashboardUrl(dashboardUrl)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logError('dashboard:register-failed', { message })
    dialog.showErrorBox(
      'Fieldguide 启动警告',
      `代码地图 Dashboard 加载失败，图谱功能不可用。\n\n${message}`,
    )
  }

  mainWindow = createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
}).catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  logError('app:ready-failed', { message })
  dialog.showErrorBox('Fieldguide 启动失败', message)
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
