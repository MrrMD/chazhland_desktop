import { useEffect, useRef } from 'react'

// Глобальный LIFO-стек обработчиков Escape: один слушатель на окно, срабатывает ТОЛЬКО верхний
// активный оверлей (а не все сразу — window-события не всплывают, stopPropagation тут бесполезен).
const stack: { cb: () => void }[] = []
let bound = false
function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || stack.length === 0) return
  e.preventDefault()
  stack[stack.length - 1].cb() // только верхний
}

export function useEscape(onEsc: () => void, active = true) {
  const cbRef = useRef(onEsc)
  cbRef.current = onEsc // всегда свежий колбэк без пересоздания записи в стеке
  useEffect(() => {
    if (!active) return
    const entry = { cb: () => cbRef.current() }
    stack.push(entry)
    if (!bound) { window.addEventListener('keydown', onKey); bound = true }
    return () => { const i = stack.indexOf(entry); if (i >= 0) stack.splice(i, 1) }
  }, [active])
}
