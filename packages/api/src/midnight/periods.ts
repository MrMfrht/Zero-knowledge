/**
 * `Period` (`"2026-04"`) ↔ the `Uint<32>` the contract's circuits actually
 * take. The contract treats `period` as an opaque number — `payroll.compact`
 * never interprets it, only hashes it into `periodKey`. This encoding is
 * entirely this api package's own decision, unlike anything that needs
 * verifying against the contract: as long as `periodToUint32` is a stable,
 * injective function used identically by `approveHours`, `confirmPayment`
 * and `proveContribution`, any encoding works. Month index since year 0
 * keeps it monotonic and trivially reversible for `uint32ToPeriod`.
 */
export function periodToUint32(period: string): bigint {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) throw new Error(`Period must be "YYYY-MM", got "${period}"`);
  const [, yearStr, monthStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (month < 1 || month > 12) throw new Error(`Month out of range in period "${period}"`);
  return BigInt(year * 12 + (month - 1));
}

export function uint32ToPeriod(n: bigint): string {
  const value = Number(n);
  const year = Math.floor(value / 12);
  const month = (value % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}
