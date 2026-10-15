export type FeltReport = {
  longitude: number;
  latitude: number;
  time: string;
  rawIntensity: number;
};

export function getFeltReports(csv: string): FeltReport[] {
  return csv.split(/\r?\n/).flatMap((line) => {
    if (!line.trim() || line.startsWith('#')) return [];
    const [longitude, latitude, time = '', , rawIntensity] = line.split(',');
    const report = {
      longitude: Number.parseFloat(longitude),
      latitude: Number.parseFloat(latitude),
      time,
      rawIntensity: Number.parseFloat(rawIntensity ?? ''),
    };
    const isValid = [report.longitude, report.latitude, report.rawIntensity].every(Number.isFinite);
    return isValid ? [report] : [];
  });
}
