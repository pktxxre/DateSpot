let _pending = false;
export function scheduleNewStack() { _pending = true; }
export function consumeNewStack(): boolean {
  if (!_pending) return false;
  _pending = false;
  return true;
}
