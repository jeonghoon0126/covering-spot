/** sessionStorage/localStorage — Safari 개인정보보호 모드 등 접근 제한 방어 */

export function safeSessionGet(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

export function safeSessionSet(key: string, value: string): void {
  try { sessionStorage.setItem(key, value); } catch { /* 무시 */ }
}

export function safeSessionRemove(key: string): void {
  try { sessionStorage.removeItem(key); } catch { /* 무시 */ }
}

export function safeLocalGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function safeLocalSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* 무시 */ }
}

export function safeLocalRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* 무시 */ }
}
