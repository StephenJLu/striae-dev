/**
 * Client helper for reading email lists from the lists-worker via service binding.
 * Returns a CSV string compatible with isEmailAllowed() and resolveReportFormat().
 * Returns an empty string on any failure (fail-open for list reads).
 */
export async function fetchListFromWorker(
  binding: Fetcher,
  list: 'members' | 'primershear'
): Promise<string> {
  try {
    const response = await binding.fetch(`https://worker/${list}`);
    if (!response.ok) {
      console.error(`lists-client: GET /${list} returned ${response.status}`);
      return '';
    }
    const data = await response.json() as { list?: unknown };
    return typeof data.list === 'string' ? data.list : '';
  } catch (err) {
    console.error(`lists-client: failed to fetch /${list}`, err);
    return '';
  }
}
