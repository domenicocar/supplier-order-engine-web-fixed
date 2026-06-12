import { SupplierComparisonOffer, SupplierComparisonRow } from '../../../models/order.models';
import {
  calculateRoundedLineTotal,
  resolveSelectedSupplierComparisonOffer,
  sortSupplierOffersByPackPrice,
  supplierOfferPackPrice,
  sumRoundedCurrency
} from './order-detail-view.utils';

describe('order-detail-view.utils', () => {
  it('calcola il totale riga usando il prezzo netto raw e arrotonda a centesimi', () => {
    expect(calculateRoundedLineTotal(0.6916, 20)).toBe(13.83);
  });

  it('somma i totali riga gia arrotondati mantenendo il totale NEW SERVICE coerente', () => {
    expect(sumRoundedCurrency([510.75, 13.83])).toBe(524.58);
  });

  it('risolve l offerta selezionata dalla lista completa fornitori quando selectedOffer e tronco', () => {
    const row: SupplierComparisonRow = {
      ean: '8002930008301',
      description: 'BIC',
      quantity: 20,
      bestOffer: {
        supplierId: 'news',
        supplierName: 'NEW SERVICE',
        packageSize: 1,
        price: 0.69,
        netPrice: null,
        grossPrice: null
      },
      selectedOffer: {
        supplierId: 'news',
        supplierName: 'NEW SERVICE',
        packageSize: 1,
        price: 0.69,
        netPrice: null,
        grossPrice: null
      },
      availableSuppliers: [
        {
          supplierId: 'news',
          supplierName: 'NEW SERVICE',
          packageSize: 1,
          price: 0.69,
          netPrice: 0.6916,
          grossPrice: 0.6916
        }
      ]
    };

    expect(resolveSelectedSupplierComparisonOffer(row)?.netPrice).toBe(0.6916);
    expect(
      calculateRoundedLineTotal(
        resolveSelectedSupplierComparisonOffer(row)?.netPrice ?? null,
        20
      )
    ).toBe(13.83);
  });

  it('ordina le offerte per prezzo confezione e non per solo prezzo unitario', () => {
    const offers: SupplierComparisonOffer[] = [
      {
        supplierId: 'unit-cheap',
        supplierName: 'Unit cheap',
        packageSize: 12,
        price: 1.5,
        netPrice: 1.5,
        grossPrice: null
      },
      {
        supplierId: 'pack-cheap',
        supplierName: 'Pack cheap',
        packageSize: 6,
        price: 2,
        netPrice: 2,
        grossPrice: null
      }
    ];

    expect(sortSupplierOffersByPackPrice(offers).map((offer) => offer.supplierId)).toEqual([
      'pack-cheap',
      'unit-cheap'
    ]);
  });

  it('calcola il prezzo confezione usato per mostrare la differenza rispetto al migliore', () => {
    const best: SupplierComparisonOffer = {
      supplierId: 'best',
      supplierName: 'Best',
      packageSize: 6,
      price: 3.24,
      netPrice: 3.24,
      grossPrice: null
    };
    const alternative: SupplierComparisonOffer = {
      supplierId: 'alternative',
      supplierName: 'Alternative',
      packageSize: 6,
      price: 3.25,
      netPrice: 3.25,
      grossPrice: null
    };

    expect(supplierOfferPackPrice(best)).toBeCloseTo(19.44, 2);
    expect(
      (supplierOfferPackPrice(alternative) ?? 0) - (supplierOfferPackPrice(best) ?? 0)
    ).toBeCloseTo(0.06, 2);
  });

  it('seleziona automaticamente il fornitore con la confezione meno costosa', () => {
    const row: SupplierComparisonRow = {
      ean: '123',
      description: 'Prodotto',
      quantity: 1,
      bestOffer: {
        supplierId: 'unit-cheap',
        supplierName: 'Unit cheap',
        packageSize: 12,
        price: 1.5,
        netPrice: 1.5,
        grossPrice: null
      },
      selectedOffer: null,
      availableSuppliers: [
        {
          supplierId: 'unit-cheap',
          supplierName: 'Unit cheap',
          packageSize: 12,
          price: 1.5,
          netPrice: 1.5,
          grossPrice: null
        },
        {
          supplierId: 'pack-cheap',
          supplierName: 'Pack cheap',
          packageSize: 6,
          price: 2,
          netPrice: 2,
          grossPrice: null
        }
      ]
    };

    expect(resolveSelectedSupplierComparisonOffer(row)?.supplierId).toBe('pack-cheap');
  });
});
