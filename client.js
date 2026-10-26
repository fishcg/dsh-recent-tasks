window.__ModuleLoader__.load({
  id: '@fishcg/dsh-recent-tasks',
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement

    const NS = 'recent-tasks'
    const RECENT_LIMIT = 5
    const MIN_LIMIT = 1
    const MAX_LIMIT = 100
    const SETTINGS_KEY = 'dsh.recent-tasks.settings.v1'
    const CLOCK_INTERVAL_MS = 30 * 1000
    /** The sidebar's scrollable column, sitting above the workspace browser. */
    const REGION_SELECTOR = '[class*="_regionArea"]'
    const STYLE_TAG = 'dsh-recent-tasks-css'
    const STYLE_PLUGIN = '@fishcg/dsh-recent-tasks'

    const zh = {
      'entry.label': '最近任务',
      'folder.count': '{n}',
      'empty': '还没有任务',
      'session.untitled': '未命名任务',
      'session.running': '运行中',
      'time.now': '刚刚',
      'time.minute': '{n} 分钟前',
      'time.hour': '{n} 小时前',
      'time.day': '{n} 天前',
      'settings.title': '最近任务',
      'settings.subtitle': '调整侧边栏「最近任务」文件夹显示多少条，以及点开任务时的行为。',
      'settings.limit.label': '历史任务数量',
      'settings.limit.unit': '个',
      'settings.limit.hint': '{min}–{max} 之间，默认 {n}；改完立刻生效。',
      'settings.reveal.label': '点击任务后定位到工作区',
      'settings.reveal.hint': '开启时：切到该会话，并在左侧展开它所在的工作区分组、把会话行滚动到视野里。关闭后只切主面板。',
      'settings.reset': '恢复默认',
      'settings.resetDone': '已恢复默认：{n} 个，定位开启',
      'settings.saved': '已保存',
      'switch.on': '开',
      'switch.off': '关',
      'menu.pin': '置顶',
      'menu.unpin': '取消置顶',
      'menu.rename': '重命名',
      'menu.fork': '在新会话里接着聊',
      'menu.archive': '归档',
      'menu.hint.pinned': '置顶的任务固定在最上面，不参与时间排序',
      'menu.more': '更多操作',
      'menu.copyId': '复制会话 ID',
      'rename.placeholder': '重命名任务',
      'rename.save': '保存',
      'rename.cancel': '取消',
      'rename.failed': '重命名失败',
    }
    const en = {
      'entry.label': 'Recent tasks',
      'folder.count': '{n}',
      'empty': 'No tasks yet',
      'session.untitled': 'Untitled task',
      'session.running': 'Running',
      'time.now': 'now',
      'time.minute': '{n}m ago',
      'time.hour': '{n}h ago',
      'time.day': '{n}d ago',
      'settings.title': 'Recent tasks',
      'settings.subtitle': 'How many tasks the sidebar folder lists, and what clicking one does.',
      'settings.limit.label': 'Number of tasks',
      'settings.limit.unit': 'tasks',
      'settings.limit.hint': 'Between {min} and {max}, {n} by default. Applies immediately.',
      'settings.reveal.label': 'Reveal the task in the workspace',
      'settings.reveal.hint': 'On: switch to the session, expand its workspace group and scroll its row into view. Off: only swap the main panel.',
      'settings.reset': 'Reset to defaults',
      'settings.resetDone': 'Defaults restored: {n} tasks, reveal on',
      'settings.saved': 'Saved',
      'switch.on': 'On',
      'switch.off': 'Off',
      'menu.pin': 'Pin to top',
      'menu.unpin': 'Unpin',
      'menu.rename': 'Rename',
      'menu.fork': 'Continue in a new session',
      'menu.archive': 'Archive',
      'menu.hint.pinned': 'Pinned tasks stay on top and ignore the time order',
      'menu.more': 'More actions',
      'menu.copyId': 'Copy session ID',
      'rename.placeholder': 'Rename task',
      'rename.save': 'Save',
      'rename.cancel': 'Cancel',
      'rename.failed': 'Rename failed',
    }

    /**
     * Plugin preferences. The Client half has no config surface of its own here,
     * so this is a tiny observable store over localStorage: the sidebar folder and
     * the settings page subscribe to the same value and stay in sync.
     */
    function clampLimit(value) {
      const number = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
      if (Number.isFinite(number) === false) return RECENT_LIMIT
      return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.round(number)))
    }

    function readSettings() {
      try {
        const raw = window.localStorage.getItem(SETTINGS_KEY)
        if (raw === null) return { limit: RECENT_LIMIT, reveal: true }
        const parsed = JSON.parse(raw)
        return {
          limit: clampLimit(parsed === null || parsed === void 0 ? RECENT_LIMIT : parsed.limit),
          reveal: parsed === null || parsed === void 0 ? true : parsed.reveal !== false,
        }
      } catch {
        return { limit: RECENT_LIMIT, reveal: true }
      }
    }

    let settingsState = readSettings()
    const settingsListeners = new Set()

    function writeSettings(patch) {
      settingsState = {
        limit: clampLimit(patch.limit === void 0 ? settingsState.limit : patch.limit),
        reveal: patch.reveal === void 0 ? settingsState.reveal : patch.reveal === true,
      }
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsState))
      } catch {
        /* private mode / disabled storage: keep the in-memory value */
      }
      for (const listener of settingsListeners) listener(settingsState)
    }

    function useSettings() {
      const [value, setValue] = React.useState(settingsState)
      React.useEffect(() => {
        settingsListeners.add(setValue)
        setValue(settingsState)
        return () => {
          settingsListeners.delete(setValue)
        }
      }, [])
      return value
    }

    /**
     * Pinned task ids. Kept next to the settings in localStorage: pinning only
     * reorders this folder, it does not touch the shipped workspace grouping.
     */
    const PINS_KEY = 'dsh.recent-tasks.pins.v1'

    function readPins() {
      try {
        const raw = window.localStorage.getItem(PINS_KEY)
        if (raw === null) return []
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) === false) return []
        return parsed.filter((id) => typeof id === 'string')
      } catch {
        return []
      }
    }

    let pinsState = readPins()
    const pinListeners = new Set()

    function writePins(next) {
      const unique = []
      for (const id of next) {
        if (typeof id !== 'string') continue
        if (unique.indexOf(id) < 0) unique.push(id)
      }
      pinsState = unique
      try {
        window.localStorage.setItem(PINS_KEY, JSON.stringify(pinsState))
      } catch {
        /* private mode: keep the in-memory list */
      }
      for (const listener of pinListeners) listener(pinsState)
    }

    function usePins() {
      const [value, setValue] = React.useState(pinsState)
      React.useEffect(() => {
        pinListeners.add(setValue)
        setValue(pinsState)
        return () => {
          pinListeners.delete(setValue)
        }
      }, [])
      return value
    }

    const CSS = `
.rtasks-host{position:relative;flex:none;display:flex;flex-direction:column;min-width:0;margin:0 0 6px;}
.rtasks-head{box-sizing:border-box;width:calc(100% - 4px);min-height:36px;margin:0 2px;display:flex;align-items:center;gap:8px;padding:7px 8px;border:none;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px;text-align:left;cursor:pointer;}
.rtasks-head:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}
.rtasks-head.is-open{color:var(--dsw-alias-label-primary);}
.rtasks-glyph{flex:none;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary);}
.rtasks-glyph[data-live="true"]{color:var(--dsw-alias-state-warn-primary);}
.rtasks-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.rtasks-count{flex:none;font-size:12px;line-height:16px;padding:0 5px;border-radius:8px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);}
.rtasks-list{display:flex;flex-direction:column;gap:1px;padding:1px 0 4px 20px;}
.rtasks-row{position:relative;box-sizing:border-box;width:100%;display:flex;align-items:stretch;border-radius:var(--dsw-radius-md);}
.rtasks-row:hover{background:var(--dsw-alias-interactive-bg-hover);}
.rtasks-open{box-sizing:border-box;flex:1;min-width:0;display:flex;align-items:flex-start;gap:7px;min-height:30px;padding:5px 8px 5px 6px;border:none;border-radius:inherit;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-align:left;cursor:pointer;overflow:hidden;}
.rtasks-dot{flex:none;width:6px;height:6px;margin-top:6px;border-radius:50%;background:var(--dsw-alias-state-idle-primary);}
.rtasks-dot[data-running="true"]{background:var(--dsw-alias-state-warn-primary);}
.rtasks-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}
.rtasks-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary);}
.rtasks-meta{display:flex;align-items:center;gap:6px;min-width:0;font-size:11px;line-height:14px;color:var(--dsw-alias-label-secondary);}
.rtasks-workspace{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}
.rtasks-spinner{flex:none;width:12px;height:12px;margin-top:3px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-state-warn-primary);}
.rtasks-spinner>svg{display:block;animation:rtasks-spin 1.6s linear infinite;}
.rtasks-glyphspin{display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-state-warn-primary);}
.rtasks-glyphspin>svg{display:block;animation:rtasks-spin 1.6s linear infinite;}
@keyframes rtasks-spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
@media (prefers-reduced-motion:reduce){.rtasks-spinner>svg,.rtasks-glyphspin>svg{animation:none;}}
.rtasks-time{flex:none;font-size:11px;line-height:18px;color:var(--dsw-alias-label-secondary);}
.rtasks-rowEditing{padding:5px 8px 5px 4px;}
.rtasks-more{position:absolute;top:3px;right:4px;display:none;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;}
.rtasks-more>svg{display:block;}
.rtasks-more:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
.rtasks-more:focus-visible{outline:none;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
.rtasks-row:hover .rtasks-more,.rtasks-row:focus-within .rtasks-more,.rtasks-row.is-menu .rtasks-more{display:inline-flex;}
.rtasks-row:hover .rtasks-time,.rtasks-row:focus-within .rtasks-time,.rtasks-row.is-menu .rtasks-time{visibility:hidden;}
.rtasks-empty{padding:5px 10px 7px 20px;font-size:12px;color:var(--dsw-alias-label-secondary);}
.rtcfg-root{display:flex;flex-direction:column;gap:14px;padding:2px 0 10px;}
.rtcfg-title{margin:0;font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary);}
.rtcfg-sub{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);}
.rtcfg-card{display:flex;flex-direction:column;gap:6px;padding:12px 14px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l1);}
.rtcfg-row{display:flex;align-items:center;justify-content:space-between;gap:14px;}
.rtcfg-label{font-size:13px;color:var(--dsw-alias-label-primary);}
.rtcfg-control{display:flex;align-items:center;gap:8px;flex:none;}
.rtcfg-input{width:72px;box-sizing:border-box;padding:5px 10px;border-radius:var(--dsw-radius-sm);border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-align:center;-moz-appearance:textfield;appearance:textfield;}
.rtcfg-input::-webkit-outer-spin-button,.rtcfg-input::-webkit-inner-spin-button{-webkit-appearance:none;appearance:none;margin:0;}
.rtcfg-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary);}
.rtcfg-unit{font-size:12px;color:var(--dsw-alias-label-secondary);}
.rtcfg-hint{margin:0;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);}
.rtcfg-switch{position:relative;flex:none;width:40px;height:22px;padding:0;border:.5px solid var(--dsw-alias-border-l2);border-radius:11px;background:var(--dsw-alias-bg-layer-2);cursor:pointer;transition:background .18s ease,border-color .18s ease;box-sizing:border-box;}
.rtcfg-switch:hover{border-color:var(--dsw-alias-border-l1);}
.rtcfg-switch:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l1);}
/* DSH 主操作蓝（发送按钮/链接同款 #7aaaff）；主题 token 里没有可直接引用的蓝色，故用字面值 */
.rtcfg-switch[aria-checked="true"]{background:#7aaaff;border-color:#7aaaff;}
.rtcfg-switch::after{content:'';position:absolute;top:2.5px;left:2.5px;width:15px;height:15px;border-radius:50%;background:#ffffff;box-shadow:0 1px 2px rgba(0,0,0,.28);transition:transform .18s cubic-bezier(.2,.7,.3,1);}
.rtcfg-switch[aria-checked="true"]::after{transform:translateX(17px);}
.rtcfg-foot{display:flex;align-items:center;gap:10px;}
.rtcfg-reset{padding:5px 10px;border-radius:var(--dsw-radius-sm);border:.5px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;}
.rtcfg-reset:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);}
.rtcfg-flash{font-size:11px;color:var(--dsw-alias-state-success-primary);}
.rtasks-pinmark{display:inline-flex;vertical-align:-2px;margin-right:5px;color:var(--dsw-alias-label-secondary);}
.rtasks-pinmark>svg{display:block;}
.rtasks-menu{position:absolute;z-index:30;min-width:172px;padding:4px;display:flex;flex-direction:column;gap:1px;border-radius:10px;border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);box-shadow:0 10px 30px rgba(0,0,0,.42);}
.rtasks-menuItem{display:flex;align-items:center;gap:8px;width:100%;min-height:28px;padding:5px 9px;border:none;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;line-height:18px;text-align:left;cursor:pointer;white-space:nowrap;}
.rtasks-menuItem:hover{background:var(--dsw-alias-interactive-bg-hover);}
.rtasks-menuItem.is-danger{color:var(--dsw-alias-state-error-primary);}
.rtasks-menuSeparator{height:1px;margin:3px 4px;background:var(--dsw-alias-border-l1);}
.rtasks-edit{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;}
.rtasks-editInput{box-sizing:border-box;width:100%;min-height:24px;padding:2px 6px;border-radius:6px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:18px;outline:none;}
.rtasks-editInput:focus{border-color:#7aaaff;}
.rtasks-editHint{font-size:11px;line-height:14px;color:var(--dsw-alias-label-secondary);}

`

    function installStyles() {
      if (document.querySelector('style[data-plugin-css=' + JSON.stringify(STYLE_TAG) + ']') !== null) return () => {}
      const tag = document.createElement('style')
      tag.dataset.plugin = STYLE_PLUGIN
      tag.dataset.pluginCss = STYLE_TAG
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => {
        tag.remove()
      }
    }

    function baseName(cwd) {
      if (typeof cwd !== 'string') return ''
      const parts = cwd.split('/').filter((part) => part.length > 0)
      return parts.length === 0 ? '' : parts[parts.length - 1]
    }

    function stampOf(value) {
      const stamp = typeof value === 'string' ? Date.parse(value) : value
      return Number.isFinite(stamp) ? stamp : 0
    }

    function relativeLabel(updatedAt, now, t) {
      const stamp = stampOf(updatedAt)
      if (stamp === 0) return ''
      const minutes = Math.floor(Math.max(0, now - stamp) / 60000)
      if (minutes < 1) return t('time.now')
      if (minutes < 60) return t('time.minute', { n: minutes })
      const hours = Math.floor(minutes / 60)
      if (hours < 24) return t('time.hour', { n: hours })
      const days = Math.floor(hours / 24)
      if (days < 7) return t('time.day', { n: days })
      const date = new Date(stamp)
      return String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
    }

    function compareRecency(left, right) {
      const a = stampOf(left.updatedAt)
      const b = stampOf(right.updatedAt)
      if (a !== b) return b - a
      return left.id < right.id ? -1 : 1
    }

    /**
     * Visible task rows: pinned ids first (still newest-first among themselves),
     * then the rest by recency until `limit` is filled. Pinned rows therefore
     * never drop out of the folder because something else was touched later.
     */
    function recentRows(list, limit, pins) {
      if (list === void 0 || list === null || Array.isArray(list.ids) === false) return []
      const byId = list.byId !== void 0 && list.byId !== null ? list.byId : {}
      const pinnedIds = Array.isArray(pins) ? pins : []
      const pinned = []
      const recent = []
      for (const id of list.ids) {
        const summary = byId[id]
        if (summary === void 0 || summary === null) continue
        if (summary.blank === true || summary.archived === true) continue
        if (summary.origin === 'subagent') continue
        if (pinnedIds.indexOf(id) >= 0) pinned.push(summary)
        else recent.push(summary)
      }
      pinned.sort(compareRecency)
      recent.sort(compareRecency)
      return pinned.concat(recent).slice(0, limit)
    }

    function sessionTitle(summary, t) {
      const title = typeof summary.title === 'string' ? summary.title.trim() : ''
      return title.length > 0 ? title : t('session.untitled')
    }

    /** Session rows in the shipped browse tree are addressed by `data-row-key`. */
    function rowKeySelector(kind, key) {
      return '[data-row-key="' + kind + ':' + String(key).replace(/["\\]/g, '\\$&') + '"]'
    }

    /** Which Workspace owns this Session, per the browser's own grouping input. */
    function workspaceKeyOf(items, sessionId, fallback) {
      if (Array.isArray(items) === true) {
        for (const workspace of items) {
          if (workspace === null || workspace === void 0) continue
          if (Array.isArray(workspace.sessionIds) === false) continue
          if (workspace.sessionIds.indexOf(sessionId) >= 0) {
            return typeof workspace.workspaceId === 'string' ? workspace.workspaceId : ''
          }
        }
        return ''
      }
      return typeof fallback === 'string' ? fallback : ''
    }

    /**
     * `uiWorkspace.openSession` only swaps the main panel back to the conversation.
     * The browse tree reveals a session for its own search results only (that state
     * lives inside WorkspaceBrowser), so mirror the behaviour from the row we own:
     * expand the owning group / its overflow rows until the session row exists,
     * then scroll it into view inside the browse list.
     */
    function revealSessionRow(sessionId, candidateKeys) {
      const keys = []
      for (const key of candidateKeys) {
        if (typeof key !== 'string') continue
        if (keys.indexOf(key) < 0) keys.push(key)
      }
      if (keys.length === 0) keys.push('')
      const clicks = []
      for (let index = 0; index < keys.length; index += 1) clicks.push(0)
      let attempts = 0
      const step = () => {
        const row = document.querySelector(rowKeySelector('session', sessionId))
        if (row !== null) {
          row.scrollIntoView({ block: 'nearest' })
          return
        }
        attempts += 1
        if (attempts > 24) return
        for (let index = 0; index < keys.length; index += 1) {
          const key = keys[index]
          const overflow = document.querySelector(rowKeySelector('overflow', key))
          const group = document.querySelector(rowKeySelector('workspace', key))
          const collapsed = group === null ? false : group.getAttribute('aria-expanded') === 'false'
          if (clicks[index] >= 2) continue
          if (collapsed === true) {
            clicks[index] += 1
            group.click()
            break
          }
          if (overflow !== null) {
            clicks[index] += 1
            overflow.click()
            break
          }
        }
        window.setTimeout(step, 90)
      }
      step()
    }

    /** Counter-clockwise circular arrow: the "history / recent" mark. */
    function HistoryIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 16
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M6 3.9A5.3 5.3 0 1 0 11 3.9',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
        }),
        h('path', {
          d: 'M13.7 3.6 11 3.9 12.2 6.5',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    /** Indeterminate spinner: "this task is running right now". */
    function RunningSpinner(props) {
      const size = props !== null && props !== void 0 && props.size ? props.size : 12
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 12 12', fill: 'none', 'aria-hidden': 'true' },
        h('circle', {
          cx: 6,
          cy: 6,
          r: 4.6,
          stroke: 'currentColor',
          strokeWidth: 1.4,
          opacity: 0.25,
        }),
        h('path', {
          d: 'M6 1.4A4.6 4.6 0 0 1 10.6 6',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
        }),
      )
    }

    /** Small pin mark shown in front of a pinned task title. */
    function PinIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 11
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 12 12', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M6 1.1a2.7 2.7 0 0 0-1.2 5.1v1.3H3.1v1.4h5.8V7.5H7.2V6.2A2.7 2.7 0 0 0 6 1.1z',
          fill: 'currentColor',
        }),
        h('path', { d: 'M5.4 9.2h1.2v2.1H5.4z', fill: 'currentColor' }),
      )
    }

    /**
     * Row context menu. Rendered through the same portal as the list and
     * positioned at the pointer, clamped to the viewport.
     */
    function RowMenu(props) {
      const t = props.t
      const menu = props.menu
      const actions = props.actions
      const nodeRef = React.useRef(null)
      const [pos, setPos] = React.useState({ x: menu.x, y: menu.y })

      React.useEffect(() => {
        const node = nodeRef.current
        if (node === null) return
        const rect = node.getBoundingClientRect()
        const area = menu.area === void 0 ? null : menu.area
        const maxX = area === null ? window.innerWidth - 8 : area.width - 8
        const maxY = area === null ? window.innerHeight - 8 : area.height - 8
        const x = Math.max(4, Math.min(menu.x, maxX - rect.width))
        const y = Math.max(4, Math.min(menu.y, maxY - rect.height))
        setPos({ x, y })
      }, [menu.x, menu.y, menu.area])

      React.useEffect(() => {
        const onDown = (event) => {
          if (nodeRef.current !== null && nodeRef.current.contains(event.target) === true) return
          props.onClose()
        }
        const onKey = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            props.onClose()
          }
        }
        document.addEventListener('mousedown', onDown, true)
        document.addEventListener('keydown', onKey, true)
        window.addEventListener('blur', props.onClose)
        window.addEventListener('resize', props.onClose)
        return () => {
          document.removeEventListener('mousedown', onDown, true)
          document.removeEventListener('keydown', onKey, true)
          window.removeEventListener('blur', props.onClose)
          window.removeEventListener('resize', props.onClose)
        }
      }, [props])

      /**
       * Menus opened from the hover "more" button close themselves once the
       * pointer leaves, so they never linger over the list. A short grace
       * period keeps the pointer from triggering it while the menu is still
       * opening under the cursor.
       */
      const leaveTimerRef = React.useRef(0)
      const cancelLeave = () => {
        if (leaveTimerRef.current !== 0) {
          clearTimeout(leaveTimerRef.current)
          leaveTimerRef.current = 0
        }
      }
      const dismissOnLeave = menu.dismissOnLeave === true
      const anchor = menu.anchor === void 0 || menu.anchor === null ? null : menu.anchor

      /**
       * A pointer that strays off the popup closes it, but the trip from the
       * "more" button down into the popup (and back) is always allowed: both
       * rectangles count as inside, and leaving them only arms a short timer.
       */
      React.useEffect(() => {
        if (dismissOnLeave !== true) return
        const onMove = (event) => {
          const node = nodeRef.current
          if (node === null) return
          const x = event.clientX
          const y = event.clientY
          const rect = node.getBoundingClientRect()
          const inMenu =
            x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
          const inAnchor =
            anchor !== null &&
            x >= anchor.left - 2 &&
            x <= anchor.right + 2 &&
            y >= anchor.top - 2 &&
            y <= anchor.bottom + 2
          if (inMenu || inAnchor) {
            cancelLeave()
            return
          }
          if (leaveTimerRef.current !== 0) return
          leaveTimerRef.current = setTimeout(() => {
            leaveTimerRef.current = 0
            props.onClose()
          }, 220)
        }
        document.addEventListener('mousemove', onMove, true)
        return () => {
          document.removeEventListener('mousemove', onMove, true)
          cancelLeave()
        }
      }, [dismissOnLeave, anchor, props])

      const item = (key, label, run, danger) =>
        h(
          'button',
          {
            type: 'button',
            role: 'menuitem',
            className: danger === true ? 'rtasks-menuItem is-danger' : 'rtasks-menuItem',
            key,
            onClick: () => {
              props.onClose()
              run()
            },
          },
          label,
        )

      return h(
        'div',
        {
          className: 'rtasks-menu',
          role: 'menu',
          ref: nodeRef,
          style: { left: pos.x + 'px', top: pos.y + 'px' },
          onContextMenu: (event) => event.preventDefault(),
        },
        item(
          'pin',
          menu.pinned === true ? t('menu.unpin') : t('menu.pin'),
          () => actions.togglePin(menu.id),
        ),
        item('rename', t('menu.rename'), () => actions.beginRename(menu.id)),
        item('copy', t('menu.copyId'), () => actions.copyId(menu.id)),
        h('div', { className: 'rtasks-menuSeparator', key: 'sep' }),
        item('fork', t('menu.fork'), () => actions.fork(menu.id)),
        item('archive', t('menu.archive'), () => actions.archive(menu.id), true),
      )
    }

    function TaskRow(props) {
      const { row, now, t, onOpen, pinned, editing, draft, onDraft, onCommit, onCancel, onMenu, menuOpen } = props
      const running = row.running === true
      const workspace = baseName(row.cwd)

      if (editing === true) {
        return h(
          'div',
          { className: 'rtasks-row rtasks-rowEditing' },
          h(
            'span',
            { className: 'rtasks-edit' },
            h('input', {
              className: 'rtasks-editInput',
              value: draft,
              placeholder: t('rename.placeholder'),
              autoFocus: true,
              onChange: (event) => onDraft(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onCommit()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  onCancel()
                }
              },
              onBlur: onCancel,
            }),
            h('span', { className: 'rtasks-editHint' }, 'Enter · Esc'),
          ),
        )
      }

      const openMenuAt = (x, y, dismissOnLeave, anchorRect) =>
        onMenu({
          id: row.id,
          x,
          y,
          pinned: pinned === true,
          dismissOnLeave: dismissOnLeave === true,
          anchor:
            anchorRect === void 0 || anchorRect === null
              ? null
              : {
                  left: anchorRect.left,
                  top: anchorRect.top,
                  right: anchorRect.right,
                  bottom: anchorRect.bottom,
                },
        })

      return h(
        'div',
        {
          className: menuOpen === true ? 'rtasks-row is-menu' : 'rtasks-row',
          onContextMenu: (event) => {
            event.preventDefault()
            openMenuAt(event.clientX, event.clientY)
          },
        },
        h(
          'button',
          {
            type: 'button',
            className: 'rtasks-open',
            title: sessionTitle(row, t),
            onClick: () => onOpen(row.id, row.workspaceId),
          },
          h('span', { className: 'rtasks-dot', 'data-running': running ? 'true' : 'false' }),
        h(
          'span',
          { className: 'rtasks-main' },
          h(
            'span',
            { className: 'rtasks-name' },
            pinned === true
              ? h('span', { className: 'rtasks-pinmark', title: t('menu.hint.pinned') }, h(PinIcon))
              : null,
            sessionTitle(row, t),
          ),
          workspace.length > 0
            ? h('span', { className: 'rtasks-meta' }, h('span', { className: 'rtasks-workspace' }, workspace))
            : null,
        ),
          running
            ? h(
                'span',
                {
                  className: 'rtasks-spinner',
                  role: 'img',
                  'aria-label': t('session.running'),
                  title: t('session.running'),
                },
                h(RunningSpinner),
              )
            : null,
          h('span', { className: 'rtasks-time' }, relativeLabel(row.updatedAt, now, t)),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'rtasks-more',
            title: t('menu.more'),
            'aria-label': t('menu.more') + '：' + sessionTitle(row, t),
            'aria-haspopup': 'menu',
            onClick: (event) => {
              event.stopPropagation()
              const rect = event.currentTarget.getBoundingClientRect()
              openMenuAt(rect.right - 8, rect.bottom + 2, true, rect)
            },
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') event.stopPropagation()
            },
          },
          h(MoreIcon),
        ),
      )
    }

    /** Three-dot "more" mark shown on row hover, same affordance as the workspace rows. */
    function MoreIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 16
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
        h('circle', { cx: 3.2, cy: 8, r: 1.3, fill: 'currentColor' }),
        h('circle', { cx: 8, cy: 8, r: 1.3, fill: 'currentColor' }),
        h('circle', { cx: 12.8, cy: 8, r: 1.3, fill: 'currentColor' }),
      )
    }

    function RecentTasksFolder(props) {
      const { rows, open, onToggle, now, t, onOpen, pins, menu, actions, editing } = props
      const live = rows.some((row) => row.running === true)
      return h(
        'div',
        { className: 'rtasks-inner' },
        h(
          'button',
          {
            type: 'button',
            className: open ? 'rtasks-head is-open' : 'rtasks-head',
            'aria-expanded': open ? 'true' : 'false',
            'aria-label': t('entry.label'),
            onClick: onToggle,
          },
          h(
            'span',
            { className: 'rtasks-glyph', 'data-live': live ? 'true' : 'false' },
            live
              ? h(
                  'span',
                  {
                    className: 'rtasks-glyphspin',
                    role: 'img',
                    'aria-label': t('session.running'),
                    title: t('session.running'),
                  },
                  h(RunningSpinner, { size: 14 }),
                )
              : h(HistoryIcon, { size: 16 }),
          ),
          h('span', { className: 'rtasks-label' }, t('entry.label')),
          rows.length > 0 ? h('span', { className: 'rtasks-count' }, t('folder.count', { n: rows.length })) : null,
        ),
        open === false
          ? null
          : rows.length === 0
            ? h('div', { className: 'rtasks-empty' }, t('empty'))
            : h(
                'div',
                { className: 'rtasks-list' },
                rows.map((row) =>
                  h(TaskRow, {
                    key: row.id,
                    row,
                    now,
                    t,
                    onOpen,
                    pinned: pins.indexOf(row.id) >= 0,
                    editing: editing !== null && editing.id === row.id,
                    draft: editing !== null && editing.id === row.id ? editing.draft : '',
                    onDraft: props.onDraft,
                    onCommit: props.onCommit,
                    onCancel: props.onCancel,
                    onMenu: props.onMenu,
                    menuOpen: menu !== null && menu.id === row.id,
                  }),
                ),
              ),
        menu === null ? null : h(RowMenu, { menu, t, actions, onClose: props.onCloseMenu }),
      )
    }

    function RecentTasksMount(props) {
      const t = props.t
      const openSession = props.openSession
      const list = props.useSessions((state) => state)
      const useWorkspacesHook =
        typeof props.useWorkspaces === 'function' ? props.useWorkspaces : (select) => select(EMPTY_WORKSPACES)
      const workspaceItems = useWorkspacesHook((state) => state.items)
      const [open, setOpen] = React.useState(false)
      const [host, setHost] = React.useState(null)
      const [now, setNow] = React.useState(() => Date.now())

      React.useEffect(() => {
        let cancelled = false
        let node = null
        let tries = 0
        let timer = null
        const attach = () => {
          if (cancelled === true || node !== null) return
          const region = document.querySelector(REGION_SELECTOR)
          if (region === null) {
            if (tries < 60) {
              tries += 1
              timer = setTimeout(attach, 80)
            }
            return
          }
          const container = document.createElement('div')
          container.dataset.plugin = 'recent-tasks'
          container.className = 'rtasks-host'
          region.insertBefore(container, region.firstChild)
          node = container
          setHost(container)
        }
        attach()
        return () => {
          cancelled = true
          if (timer !== null) clearTimeout(timer)
          if (node !== null) node.remove()
          setHost(null)
        }
      }, [])

      React.useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS)
        return () => clearInterval(id)
      }, [])

      const settings = useSettings()
      const pins = usePins()
      const rows = React.useMemo(
        () => recentRows(list, settings.limit, pins),
        [list, settings.limit, pins],
      )

      const byId = list !== void 0 && list !== null && list.byId !== void 0 && list.byId !== null ? list.byId : {}
      const [menu, setMenu] = React.useState(null)
      const [editing, setEditing] = React.useState(null)

      const onOpen = React.useCallback(
        (sessionId, workspaceId) => {
          setOpen(false)
          openSession(sessionId)
          if (settings.reveal !== true) return
          const key = workspaceKeyOf(workspaceItems, sessionId, workspaceId)
          const keys = key === '' ? [workspaceId, ''] : [key, '']
          window.setTimeout(() => revealSessionRow(sessionId, keys), 80)
        },
        [openSession, settings.reveal, workspaceItems],
      )

      const actions = React.useMemo(
        () => ({
          togglePin: (sessionId) => {
            const index = pins.indexOf(sessionId)
            const next = pins.slice(0)
            if (index >= 0) next.splice(index, 1)
            else next.unshift(sessionId)
            writePins(next)
          },
          beginRename: (sessionId) => {
            const summary = byId[sessionId]
            const title = summary === void 0 || summary === null ? '' : sessionTitle(summary, t)
            setEditing({ id: sessionId, draft: title })
          },
          archive: (sessionId) => {
            if (typeof props.archiveSession !== 'function') return
            Promise.resolve(props.archiveSession(sessionId)).catch(() => void 0)
          },
          fork: (sessionId) => {
            if (typeof props.forkSession !== 'function') return
            Promise.resolve(props.forkSession(sessionId)).catch(() => void 0)
          },
          copyId: (sessionId) => {
            const clipboard = typeof navigator === 'undefined' ? void 0 : navigator.clipboard
            if (clipboard === void 0 || clipboard === null || typeof clipboard.writeText !== 'function') return
            Promise.resolve(clipboard.writeText(sessionId)).catch(() => void 0)
          },
        }),
        [pins, byId, t, props],
      )

      const commitRename = React.useCallback(() => {
        if (editing === null) return
        const title = editing.draft.trim()
        const target = editing
        setEditing(null)
        if (title.length === 0) return
        if (typeof props.renameSession !== 'function') return
        Promise.resolve(props.renameSession(target.id, title)).catch(() => void 0)
      }, [editing, props])

      /**
       * The sidebar canvas can deliver a stray duplicate click for a node it
       * re-measures right after a render, which would toggle twice and look like
       * "nothing happened". Collapse rapid duplicates into one toggle.
       */
      const lastToggleRef = React.useRef(0)
      const onToggle = React.useCallback(() => {
        const stamp = Date.now()
        if (stamp - lastToggleRef.current < 260) return
        lastToggleRef.current = stamp
        setOpen((value) => value === false)
      }, [])

      if (host === null) return null
      return ReactDOM.createPortal(
        h(RecentTasksFolder, {
          rows,
          open,
          onToggle,
          now,
          t,
          onOpen,
          pins,
          menu,
          actions,
          editing,
          onDraft: (value) => setEditing((current) => (current === null ? current : { id: current.id, draft: value })),
          onCommit: commitRename,
          onCancel: () => setEditing(null),
          onMenu: (next) => {
            if (next === null || host === null) return setMenu(next)
            const rect = host.getBoundingClientRect()
            const region = host.parentElement
            const bounds = region === null ? rect : region.getBoundingClientRect()
            setMenu({
              ...next,
              x: next.x - rect.left,
              y: next.y - rect.top,
              area: { width: rect.width, height: Math.max(160, bounds.bottom - rect.top) },
            })
          },
          onCloseMenu: () => setMenu(null),
        }),
        host,
      )
    }

    /** Settings page: task count + whether a click also reveals the row in the workspace. */
    function RecentTasksSettings(props) {
      const t = props.t
      const settings = useSettings()
      const [draft, setDraft] = React.useState(String(settings.limit))
      const [flash, setFlash] = React.useState('')

      React.useEffect(() => {
        setDraft(String(settings.limit))
      }, [settings.limit])

      React.useEffect(() => {
        if (flash === '') return void 0
        const timer = window.setTimeout(() => setFlash(''), 1800)
        return () => window.clearTimeout(timer)
      }, [flash])

      const commitLimit = (raw) => {
        const next = clampLimit(raw)
        setDraft(String(next))
        if (next !== settings.limit) {
          writeSettings({ limit: next })
          setFlash('saved')
        }
      }

      const toggleReveal = () => {
        writeSettings({ reveal: settings.reveal !== true })
        setFlash('saved')
      }

      const reset = () => {
        writeSettings({ limit: RECENT_LIMIT, reveal: true })
        setFlash('reset')
      }

      return h(
        'div',
        { className: 'rtcfg-root' },
        h('h3', { className: 'rtcfg-title' }, t('settings.title')),
        h('p', { className: 'rtcfg-sub' }, t('settings.subtitle')),
        h(
          'div',
          { className: 'rtcfg-card' },
          h(
            'div',
            { className: 'rtcfg-row' },
            h('span', { className: 'rtcfg-label' }, t('settings.limit.label')),
            h(
              'span',
              { className: 'rtcfg-control' },
              h('input', {
                className: 'rtcfg-input',
                type: 'text',
                inputMode: 'numeric',
                min: MIN_LIMIT,
                max: MAX_LIMIT,
                step: 1,
                value: draft,
                'aria-label': t('settings.limit.label'),
                onChange: (event) => setDraft(event.target.value),
                onBlur: (event) => commitLimit(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') commitLimit(event.currentTarget.value)
                  if (event.key === 'Escape') setDraft(String(settings.limit))
                },
              }),
              h('span', { className: 'rtcfg-unit' }, t('settings.limit.unit')),
            ),
          ),
          h(
            'p',
            { className: 'rtcfg-hint' },
            t('settings.limit.hint', { min: MIN_LIMIT, max: MAX_LIMIT, n: RECENT_LIMIT }),
          ),
        ),
        h(
          'div',
          { className: 'rtcfg-card' },
          h(
            'div',
            { className: 'rtcfg-row' },
            h('span', { className: 'rtcfg-label' }, t('settings.reveal.label')),
            h('button', {
              type: 'button',
              className: 'rtcfg-switch',
              role: 'switch',
              'aria-checked': settings.reveal === true ? 'true' : 'false',
              'aria-label': t('settings.reveal.label'),
              title: settings.reveal === true ? t('switch.on') : t('switch.off'),
              onClick: toggleReveal,
            }),
          ),
          h('p', { className: 'rtcfg-hint' }, t('settings.reveal.hint')),
        ),
        h(
          'div',
          { className: 'rtcfg-foot' },
          h('button', { type: 'button', className: 'rtcfg-reset', onClick: reset }, t('settings.reset')),
          flash === 'saved' ? h('span', { className: 'rtcfg-flash' }, t('settings.saved')) : null,
          flash === 'reset'
            ? h('span', { className: 'rtcfg-flash' }, t('settings.resetDone', { n: RECENT_LIMIT }))
            : null,
        ),
      )
    }

    return {
      inject: ['slots', 'locale', 'uiWorkspace', 'sessions'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'recent-tasks: dictionaries')
        ctx.effect(() => installStyles(), 'recent-tasks: styles')
        const t = ctx.locale.bind(NS)
        const openSession = (sessionId) => {
          ctx.uiWorkspace.openSession(sessionId)
        }
        /**
         * Rename goes through the generated Remote namespace: the Client slot
         * props expose no title writer, while `remote.session.rename` is the
         * same Host entry the shipped context menu uses. Resolved lazily so a
         * missing namespace degrades to a no-op instead of stalling `apply`.
         */
        /**
         * Rename goes through the Session face (`ISession.rename`), the same entry
         * the shipped row menu uses; the list snapshot then refreshes itself.
         * A summary row normally has no binding, so fall back to a short-lived
         * retain/release around the write.
         */
        const renameSession = (sessionId, title) => {
          const sessions = ctx.sessions
          if (sessions === void 0 || sessions === null) return
          const write = (face) =>
            Promise.resolve(face.rename(title)).then((result) => {
              if (result !== void 0 && result !== null && result.ok === false) return
              if (typeof sessions.refresh === 'function') sessions.refresh()
            })
          const bound = typeof sessions.binding === 'function' ? sessions.binding(sessionId) : void 0
          if (bound !== void 0 && bound !== null && typeof bound.session?.rename === 'function') {
            return write(bound.session)
          }
          if (typeof sessions.retain !== 'function') return
          let reference
          try {
            reference = sessions.retain(sessionId, { source: 'controllerOperation' })
          } catch (error) {
            return
          }
          return Promise.resolve(reference.ready)
            .then((ready) => write(ready.session))
            .catch(() => void 0)
            .then(() => {
              try {
                reference.release()
              } catch (error) {
                void error
              }
            })
        }
        const archiveSession = (sessionId) => ctx.uiWorkspace.archiveSession(sessionId)
        const forkSession = (sessionId) =>
          ctx.uiWorkspace.forkSession(sessionId, (childId) => {
            ctx.uiWorkspace.openSession(childId)
          })
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'recent-tasks',
              order: 130,
              locale: NS,
              label: () => t('settings.title'),
              inject: () => ({ t }),
            },
            RecentTasksSettings,
          ),
        )
        ctx.slots.inject('sidebar.footer.action', () =>
          ctx.slots.register(
            {
              name: 'sidebar.footer.action',
              id: 'recent-tasks',
              order: 0,
              locale: NS,
              inject: () => ({ t, openSession, renameSession, archiveSession, forkSession }),
            },
            RecentTasksMount,
          ),
        )
      },
    }
  },
})
