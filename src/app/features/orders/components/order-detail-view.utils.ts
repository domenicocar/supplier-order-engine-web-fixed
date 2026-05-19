import { ReviewItem, SupplierComparisonOffer } from '../../../models/order.models';

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
    return '€ -';
  }

  return `€ ${value.toFixed(2).replace('.', ',')}`;
}

export function formatSupplierOption(option: SupplierComparisonOffer): string {
  const packageSize = option.packageSize > 0 ? option.packageSize : 1;
  const packPrice =
    option.price === null ? null : option.price * packageSize;

  return `${option.supplierName}: ${formatPrice(option.price)} cad. · conf. ${packageSize} · ${formatPrice(packPrice)} a confezione`;
}

export function supplierAvailabilityLabel(count: number): string {
  if (count === 1) {
    return '1 fornitore disponibile';
  }

  return `${count} fornitori disponibili`;
}
