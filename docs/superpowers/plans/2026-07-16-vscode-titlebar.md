# VS Code Title Bar Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Replace native Windows title + menu bars with a frameless VS Code–like custom title bar that hosts File/Edit/View/Help and window controls.

**Architecture:** Main process keeps `Menu.setApplicationMenu` for accelerators; renderer pops submenus via IPC. Frameless window only on `win32`. Title bar spans full width above Activity Bar.

**Tech Stack:** Electron `frame: false`, `Menu.popup`, React TitleBar, preload IPC.

## Global Constraints

- Windows-first; macOS keeps native frame/menu for this change.
- Do not change menu business actions (open project, zoom, about).
- Preserve existing menu: IPC event names.

---

### Task 1: Window + IPC

- [x] `src/main/window.ts` — `frame: false`, `autoHideMenuBar: true` when `process.platform === 'win32'`; set `title: 'Fieldguide'`.
- [x] `src/main/menu.ts` — `popupTopLevelMenu(id, x, y)` using built menu items.
- [x] `src/main/ipc/index.ts` — register window + menu popup handlers.
- [x] `src/preload/index.ts` + `env.d.ts` — expose APIs.

### Task 2: Title bar UI + layout

- [x] Refactor `TitleBar` → `AppTitleBar`: menus, project, tools, window controls; drag region.
- [x] Restructure App shell: TitleBar full width on top; Activity Bar below.
- [x] Remove `FG` / redundant module title from title bar.
- [x] Locale keys for window control aria-labels.

### Task 3: Verify

- [x] `pnpm typecheck`
- [ ] Manual: drag, menus, min/max/close, accelerators (Ctrl+O, zoom).
