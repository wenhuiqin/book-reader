export function getBookFormat(filePath = '') {
  const normalized = filePath.toLowerCase();
  if (normalized.endsWith('.pdf')) return 'pdf';
  if (normalized.endsWith('.epub')) return 'epub';
  if (normalized.endsWith('.mobi')) return 'mobi';
  return 'unknown';
}

export function getBookBaseName(fileName = '') {
  return fileName.replace(/\.[^.]+$/, '');
}
