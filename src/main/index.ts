import { app, BrowserWindow } from 'electron'
import { registerDashboardProtocol } from './ua/dashboard'
import { createWindow } from './window'

// Side-effect import: registers all IPC handlers
import './ipc/index'
import { setDashboardUrl } from './ipc/index'

let mainWindow: BrowserWindow | null = null

app.whenReady().then(() => {
  // Register custom protocol for UA Dashboard embedding
  const dashboardUrl = registerDashboardProtocol()
  setDashboardUrl(dashboardUrl)

  mainWindow = createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
