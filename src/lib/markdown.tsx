import { Fragment, type ReactNode } from 'react'
import { MENTION_RE, IS_MENTION } from './mentions'

// Лёгкий рендер форматирования сообщений БЕЗ библиотек и БЕЗ dangerouslySetInnerHTML:
// возвращаем React-узлы, поэтому весь текст экранируется автоматически (XSS невозможен).
// Поддержка: ```блок кода```, `строчный код`, **жирный**, ~~зачёркнутый~~, *курсив* / _курсив_,
// ссылки http(s), переносы строк (через whiteSpace:pre-wrap на контейнере), упоминания @.

// язык-тег у одностолбцового кода срезаем ТОЛЬКО если за ним перевод строки (иначе ```code``` потерял бы «code»)
const FENCE_SRC = '```([a-zA-Z0-9]*\\n)?([\\s\\S]*?)```'
// порядок альтернатив = приоритет: строчный код (его содержимое буквально) → **жирный** →
// ~~зачёркнутый~~ → *курсив* / _курсив_ → ссылка. Без переходов через \n (кроме fence выше).
// У курсива — границы (?<!буква/цифра)…(?!буква/цифра), чтобы get_user_by_id, пути и 3*5 не ломались
// (как в CommonMark — без внутрисловного выделения); тело *курсива* допускает вложенный **жирный**.
const INLINE_SRC =
  '(`[^`\\n]+`)' +
  '|(\\*\\*[^\\n]+?\\*\\*)' +
  '|(~~[^\\n]+?~~)' +
  '|((?<![\\p{L}\\p{N}])\\*(?!\\s)(?:\\*\\*[^\\n]+?\\*\\*|[^*\\n])+\\*(?![\\p{L}\\p{N}]))' +
  '|((?<![\\p{L}\\p{N}_])_(?!\\s)[^_\\n]+?_(?![\\p{L}\\p{N}_]))' +
  '|(https?://[^\\s<]+)'

const CODE_STYLE: React.CSSProperties = { background: 'var(--surface-3)', borderRadius: 5, padding: '1px 5px', fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontSize: 12.5 }
const PRE_STYLE: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px', margin: '5px 0', overflow: 'auto', fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre' }
const LINK_STYLE: React.CSSProperties = { color: 'var(--accent)', textDecoration: 'underline' }
const MENTION_STYLE: React.CSSProperties = { background: 'var(--accent)', color: '#fff', borderRadius: 6, padding: '1px 7px', fontWeight: 600 }

// упоминания подсвечиваем на самом внутреннем уровне — на обычных текстовых прогонах
function mentionNodes(text: string, key: () => number): ReactNode[] {
  return text.split(MENTION_RE).map((p) =>
    IS_MENTION.test(p)
      ? <span key={key()} style={MENTION_STYLE}>{p}</span>
      : <Fragment key={key()}>{p}</Fragment>,
  )
}

function inlineNodes(text: string, key: () => number): ReactNode[] {
  const out: ReactNode[] = []
  const re = new RegExp(INLINE_SRC, 'gu') // СВОЙ инстанс на вызов — рекурсия не должна делить lastIndex; u — для \p{L}
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(...mentionNodes(text.slice(last, m.index), key))
    const [, code, bold, strike, italic1, italic2, link] = m
    if (code) {
      out.push(<code key={key()} style={CODE_STYLE}>{code.slice(1, -1)}</code>)
    } else if (bold) {
      out.push(<strong key={key()}>{inlineNodes(bold.slice(2, -2), key)}</strong>)
    } else if (strike) {
      out.push(<s key={key()}>{inlineNodes(strike.slice(2, -2), key)}</s>)
    } else if (italic1) {
      out.push(<em key={key()}>{inlineNodes(italic1.slice(1, -1), key)}</em>)
    } else if (italic2) {
      out.push(<em key={key()}>{inlineNodes(italic2.slice(1, -1), key)}</em>)
    } else if (link) {
      // отрезаем хвостовую пунктуацию, чтобы она не попала в href; href только http(s) → безопасно.
      // ')' и ']' срезаем ТОЛЬКО когда они не сбалансированы внутри URL — иначе /wiki/Foo_(bar) уцелеет.
      let url = link, trail = ''
      for (;;) {
        const c = url[url.length - 1]
        if ('.,!?:;'.includes(c)) { trail = c + trail; url = url.slice(0, -1); continue }
        if (c === ')' && url.split('(').length < url.split(')').length) { trail = c + trail; url = url.slice(0, -1); continue }
        if (c === ']' && url.split('[').length < url.split(']').length) { trail = c + trail; url = url.slice(0, -1); continue }
        break
      }
      out.push(<a key={key()} href={url} target="_blank" rel="noopener noreferrer" style={LINK_STYLE}>{url}</a>)
      if (trail) out.push(<Fragment key={key()}>{trail}</Fragment>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(...mentionNodes(text.slice(last), key))
  return out
}

export function renderRichText(text: string): ReactNode {
  let k = 0
  const key = () => k++
  const out: ReactNode[] = []
  const fence = new RegExp(FENCE_SRC, 'g')
  let last = 0
  let m: RegExpExecArray | null
  while ((m = fence.exec(text))) {
    if (m.index > last) out.push(...inlineNodes(text.slice(last, m.index), key))
    out.push(<pre key={key()} style={PRE_STYLE}><code>{m[2].replace(/\n$/, '')}</code></pre>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(...inlineNodes(text.slice(last), key))
  return out
}
