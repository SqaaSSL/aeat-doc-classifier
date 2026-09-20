export interface CandidateSource {
  id: string; url: string; sha256: string; bytes: number; pageCount: number;
  split: 'calibration' | 'validation-reserved'; familyGroup: string; note: string;
  cases: Array<{ page: number; proposed: { kind: string; jurisdiction: string; form: string | null };
    nativeInputSha256: string; nativeInputBytes: number; requiresOcrForVisualContent: boolean }>;
}
export interface CandidateManifest { schemaVersion: number; id: string; labelStatus: string; sources: CandidateSource[] }
const hosts = new Set(['www.boe.es', 'sede.agenciatributaria.gob.es', 'www.facturae.gob.es', 'www.seg-social.es', 'atc.gencat.cat']);
export function validateCandidates(manifest: CandidateManifest, previous: Array<{ url: string; sha256: string }>) {
  if (manifest.schemaVersion !== 1 || !manifest.sources?.length) throw new Error('Invalid candidate manifest.');
  const ids = new Set<string>(), hashes = new Set(previous.map(s => s.sha256)), urls = new Set(previous.map(s => s.url));
  const splits = new Map<string, string>();
  for (const source of manifest.sources) {
    const url = new URL(source.url);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.id) || ids.has(source.id)
        || url.protocol !== 'https:' || !hosts.has(url.hostname) || url.username || url.password
        || !/^[a-f0-9]{64}$/.test(source.sha256) || hashes.has(source.sha256) || urls.has(source.url)
        || !Number.isInteger(source.bytes) || source.bytes < 4 || source.bytes > 50 * 1024 * 1024
        || !Number.isInteger(source.pageCount) || source.pageCount < 1 || source.pageCount > 100
        || !['calibration', 'validation-reserved'].includes(source.split) || !source.familyGroup || !source.cases.length) {
      throw new Error('Invalid, repeated or previously used candidate source.');
    }
    ids.add(source.id); hashes.add(source.sha256); urls.add(source.url);
    for (const group of [source.familyGroup, ...source.cases.flatMap(c => c.proposed.form ? [c.proposed.form] : [])]) {
      if (splits.has(group) && splits.get(group) !== source.split) throw new Error('A model/source family crosses the calibration boundary.');
      splits.set(group, source.split);
    }
    const pages = new Set<number>();
    for (const c of source.cases) {
      if (!Number.isInteger(c.page) || c.page < 1 || c.page > source.pageCount || pages.has(c.page)
          || !/^[a-f0-9]{64}$/.test(c.nativeInputSha256) || !Number.isInteger(c.nativeInputBytes) || c.nativeInputBytes < 0 || c.nativeInputBytes > 24_000) {
        throw new Error('Invalid candidate page or extraction fingerprint.');
      }
      pages.add(c.page);
    }
  }
}
