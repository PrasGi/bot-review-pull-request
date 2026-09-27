export interface SearchSyncState {
  /** What the input shows. */
  text: string;
  /** Values this input pushed to the URL that the URL has not reflected yet, oldest first. */
  pending: string[];
}

/**
 * Called when the URL's search value changes. A value this input pushed itself
 * never overwrites the input (the user may have typed on since); any other
 * change (clear filters, back button, a shared link) replaces it.
 */
export function reconcileSearch(state: SearchSyncState, urlValue: string): SearchSyncState {
  const ours = state.pending.indexOf(urlValue);
  if (ours !== -1) return { text: state.text, pending: state.pending.slice(ours + 1) };
  return { text: urlValue, pending: [] };
}
