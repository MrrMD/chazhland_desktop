// Упоминание пользователя в тексте: @everyone/@here или @<ник> как отдельный токен
// (\p{L} — кириллические ники тоже). Используется для cross-channel уведомлений.
export function mentionsUser(content: string | null | undefined, username?: string): boolean {
  if (!content) return false
  // граница перед @ — начало строки или не-словосимвол (как и у @ника), чтобы поведение совпадало
  if (/(^|[^\p{L}\p{N}_])@(everyone|here)(?![\p{L}\p{N}_])/u.test(content)) return true
  if (!username) return false
  const esc = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}_])@${esc}(?![\\p{L}\\p{N}_])`, 'u').test(content)
}
