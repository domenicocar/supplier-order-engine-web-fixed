export interface SupplierDefinition {
  id: string;
  name: string;
}

export const SESSION_SUPPLIERS: SupplierDefinition[] = [
  { id: 'pagano', name: 'Pagano' },
  { id: 'new-service', name: 'New Service' },
  { id: 'new-grieco', name: 'New Grieco' }
];
