import { app, BrowserWindow } from 'electron'
import { createWindow } from './window'

let mainWindow: BrowserWindow | null = null

app.whenReady().then(() => {
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
