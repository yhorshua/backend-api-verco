export function isUserActive(value: unknown): boolean {
  if (value === true || value === 1 || value === '1') return true;

  if (Buffer.isBuffer(value)) {
    return value.length > 0 && value[0] === 1;
  }

  if (value && typeof value === 'object' && 'data' in value) {
    const data = (value as { data?: unknown }).data;
    return Array.isArray(data) && Number(data[0]) === 1;
  }

  return false;
}
