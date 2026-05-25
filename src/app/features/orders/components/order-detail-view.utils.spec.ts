import { SupplierComparisonRow } from '../../../models/order.models';
import {
  calculateRoundedLineTotal,
  resolveSelectedSupplierComparisonOffer,
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
});
