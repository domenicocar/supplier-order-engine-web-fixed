import { ReviewItem, SupplierComparisonOffer, SupplierComparisonRow } from '../../../models/order.models';
import { SupplierComparisonSelection } from './order-detail-view.models';

export function reviewReason(item: ReviewItem): string {
  return item.reason || item.possibleReason || '-';
}

export function severityTone(severity?: string): 'danger' | 'warn' | 'info' {
  const normalized = severity?.toLowerCase() ?? '';

  if (normalized.includes('error')) {
    return 'danger';
  }

  if (normalized.includes('warn')) {
    return 'warn';
  }

  return 'info';
}

export function formatRate(value: number | null): string {
  if (value === null) {
    return '-';
  }

  if (value <= 1) {
    return `${Math.round(value * 100)}%`;
  }

  return `${Math.round(value)}%`;
}

export function formatPrice(value: number | null): string {
  if (value === null) {
    return 'EUR -';
  }

  return `EUR ${value.toFixed(2).replace('.', ',')}`;
}

export function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateRoundedLineTotal(
  unitNetPrice: number | null,
  totalPieces: number | null
): number | null {
  if (
    unitNetPrice === null ||
    totalPieces === null ||
    !Number.isFinite(unitNetPrice) ||
    !Number.isFinite(totalPieces)
  ) {
    return null;
  }

  return roundToCents(unitNetPrice * totalPieces);
}

export function sumRoundedCurrency(values: Array<number | null | undefined>): number {
  return roundToCents(
    values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  );
}

export function resolveSelectedSupplierComparisonOffer(
  row: SupplierComparisonRow,
  manualSelection?: SupplierComparisonSelection
): SupplierComparisonOffer | null {
  const selectedSupplierId =
    manualSelection?.selectedSupplierId || row.selectedOffer?.supplierId || row.bestOffer?.supplierId;

  if (selectedSupplierId) {
    return (
      row.availableSuppliers.find((option) => option.supplierId === selectedSupplierId) ??
      row.selectedOffer ??
      row.bestOffer ??
      row.availableSuppliers[0] ??
      null
    );
  }

  return row.selectedOffer ?? row.bestOffer ?? row.availableSuppliers[0] ?? null;
}

export function formatSupplierOption(option: SupplierComparisonOffer): string {
  const packageSize = option.packageSize > 0 ? option.packageSize : 1;
  const unitPrice = option.netPrice ?? option.price;
  const packPrice = unitPrice === null ? null : unitPrice * packageSize;

  return `${option.supplierName}: ${formatPrice(unitPrice)} cad. · conf. ${packageSize} · ${formatPrice(packPrice)} a confezione`;
}

export function supplierAvailabilityLabel(count: number): string {
  if (count === 1) {
    return '1 fornitore disponibile';
  }

  return `${count} fornitori disponibili`;
}
