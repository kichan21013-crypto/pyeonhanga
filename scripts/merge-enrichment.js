// Preserve already-verified API facts when a later, quota-limited pass samples different places.
// An old item keeps its original verification date; new data replaces it only for the same ID.
export function mergeEnrichmentRows(previousReport, freshRows, collectedAt) {
  const oldDate = String(previousReport?.generatedAt || '').slice(0,10);
  const freshDate = String(collectedAt || '').slice(0,10);
  const existing = (previousReport?.places || [])
    .filter(row => row?.id)
    .map(row => ({ ...row, verifiedAt: row.verifiedAt || oldDate || null }));
  const byId = new Map(existing.map(row => [row.id, row]));
  for (const row of freshRows || []) {
    if (!row?.id) continue;
    byId.set(row.id, { ...row, verifiedAt: freshDate || row.verifiedAt || null });
  }
  return [...byId.values()];
}
