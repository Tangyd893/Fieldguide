# VS Code–style custom title bar

> 2026-07-16 · Approved in chat (approach 1 + merge File/Edit/View/Help)

## Problem

Windows shows a native title bar (dark strip + “Fieldguide” + min/max/close) plus a separate app menu bar. Both feel foreign to VS Code–style chrome.

## Design

1. `BrowserWindow({ frame: false, autoHideMenuBar: true })` on Windows (keep default frame on macOS for traffic lights).
2. Full-width custom title bar above Activity Bar:
   - Left: File / Edit / View / Help → `Menu.popup` from existing application menu (accelerators unchanged).
   - Center-left: project switcher (existing).
   - Right: layout tools + search + custom window controls.
3. Remove `FG` brand chip; app name only in About / OS taskbar title.
4. `-webkit-app-region: drag` on title bar; `no-drag` on buttons/menus.
5. IPC: `window:minimize|maximize|close|isMaximized`; `menu:popupTopLevel`.

## Out of scope

macOS custom title bar; menu item set changes; Activity Bar redesign.
