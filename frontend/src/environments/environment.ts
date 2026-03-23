/** Configuração de um cliente OAuth por módulo (token enxuto por escopo) */
export interface ModuleClient {
  clientId: string;
  clientSecret: string;
  label: string;
  route: string;
  roles: string[];
}

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8280/order-processing/1.0.0',
  keycloak: {
    url: 'http://localhost:8081',
    realm: 'order-processing',
    /**
     * Portal: token com escopos `mod:*` (quais módulos pode abrir).
     * Chamadas HTTP usam este token quando a sessão é do portal (subscrição WSO2 para este client).
     */
    portalClientId: 'order-processing-portal',
    portalClientSecret: 'order-processing-portal-secret-change-in-production',
    modulePortalScopes: {
      orders: 'mod:orders',
      products: 'mod:products',
      customers: 'mod:customers',
    } as Record<string, string>,
    moduleClients: {
      orders: {
        clientId: 'orders-module',
        clientSecret: 'orders-module-secret-change-in-production',
        label: 'Pedidos',
        route: '/orders',
        roles: ['orders:read'],
      },
      products: {
        clientId: 'products-module',
        clientSecret: 'products-module-secret-change-in-production',
        label: 'Produtos',
        route: '/products',
        roles: ['products:read'],
      },
      customers: {
        clientId: 'customers-module',
        clientSecret: 'customers-module-secret-change-in-production',
        label: 'Clientes',
        route: '/customers',
        roles: ['customers:read'],
      },
    } as Record<string, ModuleClient>,
  },
};
