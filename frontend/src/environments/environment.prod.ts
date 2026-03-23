import type { ModuleConfig } from './environment';

export const environment = {
  production: true,
  apiUrl: 'http://localhost:8280/order-processing/1.0.0',
  keycloak: {
    url: 'http://localhost:8081',
    realm: 'order-processing',
    clientId: 'order-processing-portal',
    portalOAuthScopes: ['portal-module-scopes'],
    modulePortalScopes: {
      orders: 'mod:orders',
      products: 'mod:products',
      customers: 'mod:customers',
    } as Record<string, string>,
    moduleClients: {
      orders: {
        label: 'Pedidos',
        route: '/orders',
        roles: ['orders:read'],
        oauthScopes: ['orders-module-scopes'],
      },
      products: {
        label: 'Produtos',
        route: '/products',
        roles: ['products:read'],
        oauthScopes: ['products-module-scopes'],
      },
      customers: {
        label: 'Clientes',
        route: '/customers',
        roles: ['customers:read'],
        oauthScopes: ['customers-module-scopes'],
      },
    } as Record<string, ModuleConfig>,
  },
};
