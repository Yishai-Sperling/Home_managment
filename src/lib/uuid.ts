/** UUID v4 ללקוח, כדי שהפריט האופטימי ישתמש באותו id שיישמר בשרת (key יציב, בלי אנימציה חוזרת). */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
