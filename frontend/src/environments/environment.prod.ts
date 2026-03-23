import type { ModuleClient } from './environment';

export const environment = {
  production: true,
  apiUrl: 'http://localhost:8280/order-processing/1.0.0',
  keycloak: {
    url: 'http://localhost:8081',
    realm: 'order-processing',
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
