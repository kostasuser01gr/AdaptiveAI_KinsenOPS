/**
 * Client-side CSV export utility.
 * Generates a CSV string from an array of objects and triggers a download.
 */

function escapeCsvValue(value: unknown): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string }[],
  filename: string,
): void {
  if (rows.length === 0) return;

  const header = columns.map(c => escapeCsvValue(c.label)).join(',');
  const body = rows.map(row =>
    columns.map(c => escapeCsvValue(row[c.key])).join(',')
  ).join('\n');

  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
