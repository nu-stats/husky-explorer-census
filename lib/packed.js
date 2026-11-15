// Which built data files a site build stores gzipped (X.json.gz) so a hosted copy stays small: the value and boundary
// files the shared loader (lib/data.js) reads. Indexes, catalogs, dot layers, national files and commuting flows, which
// pages fetch for themselves, stay plain. Paths are relative to the data folder ("acs5-2024/tract/25/B01003.json").
export function packed(path) {
  return path.endsWith('.json') && !/(^|\/)(index|catalog)\.json$/.test(path) && !/^(points|national|commuting-2023\/flows|wetbulb-prism)\//.test(path)
}
