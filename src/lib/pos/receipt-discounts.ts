/**
 * POS Retail V8: reconcile ticket discounts against the committed sale ledger.
 * Line discounts already include automatic campaigns and manual item promotions.
 * General discount is stored only on the sale header, not the sale lines.
 * Never recalculate discounts from today's campaign catalogue.
 */
export type ReceiptDiscountLine = { discount_amount?: number | string | null };
export type ReceiptDiscountSale = {
  subtotal: number | string;
  discount_amount: number | string;
  total: number | string;
  items?: ReceiptDiscountLine[] | null;
};
const cents = (value: number | string | null | undefined) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) throw new Error("INVALID_RECEIPT_AMOUNT");
  return Math.round((n + Number.EPSILON) * 100);
};
export function receiptDiscountBreakdown(sale: ReceiptDiscountSale) {
  const subtotal = cents(sale.subtotal);
  const total = cents(sale.total);
  const discount = cents(sale.discount_amount);
  const lines = (sale.items || []).reduce((sum, line) => sum + cents(line.discount_amount), 0);
  if (subtotal < 0 || total < 0 || discount < 0 || lines < 0 ||
      subtotal - discount !== total || lines > discount) {
    throw new Error("RECEIPT_LEDGER_MISMATCH");
  }
  const general = discount - lines;
  return {
    original: subtotal / 100,
    itemSavings: lines / 100,
    generalSavings: general / 100,
    totalSavings: discount / 100,
    final: total / 100
  };
}
