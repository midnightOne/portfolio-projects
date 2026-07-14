"use client"

import * as React from "react"

/**
 * Page scroll lock with scrollbar-width compensation, shared by every dialog
 * surface (dialog.tsx, enhanced-dialog.tsx). Locking `<html>` (not `<body>`)
 * matches Radix; the two dialog wrappers write the same element, so they MUST
 * share one source of truth or they stomp each other's lock/unlock.
 *
 * IMPORTANT — lock only while OPEN: render `<ScrollLock />` *inside*
 * `DialogPrimitive.Content` (not `useScrollLock()` at the top of the wrapper
 * component). Radix mounts the Content subtree only when the dialog is open, so
 * a child effect runs on open and cleans up on close. Calling the hook in the
 * wrapper body instead runs it whenever `<DialogContent>` is merely rendered —
 * including while closed — which silently locked page scroll on any page that
 * declares a (closed) dialog. That was the bug behind "admin page won't scroll".
 *
 * The active-lock count lives on `globalThis` behind a `Symbol.for` key rather
 * than a module-level `let`. A plain module variable is fragile in dev: Fast
 * Refresh / HMR re-evaluates the module and resets the counter to 0 while a
 * dialog is still mounted, so the eventual unmount decremented into the
 * negatives and an exact `=== 0` unlock branch would never fire — leaving
 * `<html>` stuck at `overflow: hidden`. The global survives module
 * re-evaluation, and the decrement is floored at 0 so a stray unmount can never
 * wedge the lock on.
 */
const COUNT_KEY = Symbol.for("app.ui.scrollLockCount")

type LockStore = { [COUNT_KEY]?: number }

function getStore(): LockStore {
  return globalThis as unknown as LockStore
}

function applyLock(): void {
  const root = document.documentElement
  // Already locked (e.g. StrictMode double-invoke) — don't re-measure, or a
  // second call would read the already-narrowed clientWidth as the scrollbar.
  if (root.style.overflow === "hidden") return
  const scrollbar = window.innerWidth - root.clientWidth
  root.style.overflow = "hidden"
  if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`
}

function releaseLock(): void {
  const root = document.documentElement
  root.style.overflow = ""
  root.style.paddingRight = ""
}

/**
 * Locks page scroll for the lifetime of the calling component. Nesting-safe:
 * the lock releases only when the last active dialog unmounts.
 */
export function useScrollLock(): void {
  React.useEffect(() => {
    const store = getStore()
    store[COUNT_KEY] = (store[COUNT_KEY] ?? 0) + 1
    applyLock()
    return () => {
      const s = getStore()
      s[COUNT_KEY] = Math.max(0, (s[COUNT_KEY] ?? 0) - 1)
      if (s[COUNT_KEY] === 0) releaseLock()
    }
  }, [])
}

/**
 * Locks page scroll for as long as it is mounted. Render it *inside* a dialog's
 * Content element so it mounts only when the dialog is open. Renders nothing.
 */
export function ScrollLock(): null {
  useScrollLock()
  return null
}
