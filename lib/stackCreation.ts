let _pending = false;
let _pendingSelection: string[] | null = null;

// Schedule the lists tab to enter stack-selection mode on its next focus.
// Optionally restore a set of previously-selected visit IDs (used when resuming).
export function scheduleNewStack(selectedIds?: string[]) {
  _pending = true;
  _pendingSelection = selectedIds && selectedIds.length ? selectedIds : null;
}
export function consumeNewStack(): boolean {
  if (!_pending) return false;
  _pending = false;
  return true;
}
export function consumeStackSelection(): string[] | null {
  const sel = _pendingSelection;
  _pendingSelection = null;
  return sel;
}

// "Stack in progress" flag — set when the user leaves the ranked tab mid-creation.
// The map reads this on focus to offer a "Resume stack?" prompt, mirroring resume-logging.
let _inProgress: string[] | null = null;
export function markStackInProgress(selectedIds: string[]) { _inProgress = selectedIds; }
export function clearStackInProgress() { _inProgress = null; }
export function hasStackInProgress(): boolean { return _inProgress !== null; }
export function consumeStackInProgress(): string[] | null {
  const ids = _inProgress;
  _inProgress = null;
  return ids;
}
