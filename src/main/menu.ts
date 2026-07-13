/**
 * Electron application menu — localized labels for system menu bar.
 */
import { app, Menu, BrowserWindow, shell, type MenuItemConstructorOptions } from 'electron'
import type { AppConfig } from './config'

type MenuLocale = AppConfig['locale']

interface MenuStrings {
  file: string
  edit: string
  view: string
  help: string
  openProjectsFolder: string
  quit: string
  undo: string
  redo: string
  cut: string
  copy: string
  paste: string
  selectAll: string
  reload: string
  toggleDevTools: string
  about: string
}

const MENU_STRINGS: Record<MenuLocale, MenuStrings> = {
  'zh-CN': {
    file: '文件',
    edit: '编辑',
    view: '视图',
    help: '帮助',
    openProjectsFolder: '打开项目根目录',
    quit: '退出',
    undo: '撤销',
    redo: '重做',
    cut: '剪切',
    copy: '复制',
    paste: '粘贴',
    selectAll: '全选',
    reload: '重新加载',
    toggleDevTools: '切换开发者工具',
    about: '关于 Fieldguide',
  },
  'zh-TW': {
    file: '檔案',
    edit: '編輯',
    view: '檢視',
    help: '說明',
    openProjectsFolder: '開啟專案根目錄',
    quit: '結束',
    undo: '復原',
    redo: '重做',
    cut: '剪下',
    copy: '複製',
    paste: '貼上',
    selectAll: '全選',
    reload: '重新載入',
    toggleDevTools: '切換開發者工具',
    about: '關於 Fieldguide',
  },
  'en-US': {
    file: 'File',
    edit: 'Edit',
    view: 'View',
    help: 'Help',
    openProjectsFolder: 'Open Projects Folder',
    quit: 'Quit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    reload: 'Reload',
    toggleDevTools: 'Toggle Developer Tools',
    about: 'About Fieldguide',
  },
}

function focusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

export function buildApplicationMenu(locale: MenuLocale): Menu {
  const s = MENU_STRINGS[locale] ?? MENU_STRINGS['en-US']
  const isMac = process.platform === 'darwin'

  const fileSubmenu: MenuItemConstructorOptions[] = [
    {
      label: s.openProjectsFolder,
      click: () => {
        const win = focusedWindow()
        win?.webContents.send('menu:openProjectsFolder')
      },
    },
    { type: 'separator' },
    isMac
      ? { role: 'close', label: s.quit }
      : { role: 'quit', label: s.quit },
  ]

  const editSubmenu: MenuItemConstructorOptions[] = [
    { role: 'undo', label: s.undo },
    { role: 'redo', label: s.redo },
    { type: 'separator' },
    { role: 'cut', label: s.cut },
    { role: 'copy', label: s.copy },
    { role: 'paste', label: s.paste },
    { type: 'separator' },
    { role: 'selectAll', label: s.selectAll },
  ]

  const viewSubmenu: MenuItemConstructorOptions[] = [
    {
      label: s.reload,
      accelerator: 'CmdOrCtrl+R',
      click: () => focusedWindow()?.webContents.reload(),
    },
    {
      label: s.toggleDevTools,
      accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I',
      click: () => focusedWindow()?.webContents.toggleDevTools(),
    },
  ]

  const helpSubmenu: MenuItemConstructorOptions[] = [
    {
      label: s.about,
      click: () => focusedWindow()?.webContents.send('menu:about'),
    },
    { type: 'separator' },
    {
      label: 'GitHub',
      click: () => shell.openExternal('https://github.com/fieldguide-app/fieldguide'),
    },
  ]

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { label: s.about, click: () => focusedWindow()?.webContents.send('menu:about') },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const, label: s.quit },
      ],
    }] : []),
    { label: s.file, submenu: fileSubmenu },
    { label: s.edit, submenu: editSubmenu },
    { label: s.view, submenu: viewSubmenu },
    { label: s.help, submenu: helpSubmenu },
  ]

  return Menu.buildFromTemplate(template)
}

export function setApplicationMenu(locale: MenuLocale): void {
  Menu.setApplicationMenu(buildApplicationMenu(locale))
}
