import { calculateRoundedLineTotal, sumRoundedCurrency } from './order-detail-view.utils';

describe('order-detail-view.utils', () => {
  it('calcola il totale riga usando il prezzo netto raw e arrotonda a centesimi', () => {
    expect(calculateRoundedLineTotal(0.6916, 20)).toBe(13.83);
  });

  it('somma i totali riga gia arrotondati mantenendo il totale NEW SERVICE coerente', () => {
    expect(sumRoundedCurrency([510.75, 13.83])).toBe(524.58);
  });
});
