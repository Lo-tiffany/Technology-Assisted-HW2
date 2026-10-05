const KEYS = ['time', 'magnitude', 'depth'];

/** 排序(回傳新陣列)。值為 null 的事件不論升降冪一律排在最後。 */
export function sortEvents(events, key = 'time', order = 'desc') {
  if (!KEYS.includes(key)) throw new Error(`sortBy must be one of: ${KEYS.join(', ')}`);
  if (order !== 'asc' && order !== 'desc') throw new Error("order must be 'asc' or 'desc'");
  const dir = order === 'asc' ? 1 : -1;
  return [...events].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * dir;
  });
}
