/** Metadados de módulo + nomes dos client scopes Keycloak solicitados no login */
export interface ModuleConfig {
  label: string;
  route: string;
  roles: string[];
  /** Client scopes opcionais (ex.: orders-module-scopes) — controlam claims do token */
  oauthScopes: string[];
}

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8280/order-processing/1.0.0',
  keycloak: {
    url: 'http://localhost:8081',
    realm: 'order-processing',
    /** Único client público da SPA (PKCE). Escopos finos via client scopes opcionais no Keycloak. */
    clientId: 'order-processing-portal',
    /** Client scopes pedidos no login do portal (ex.: só mod:* no token) */
    portalOAuthScopes: ['portal-module-scopes'],
    /**
     * Portal: token com escopos `mod:*` (quais módulos pode abrir).
     * Chamadas HTTP usam este token quando a sessão é do portal (subscrição WSO2 para este client).
     */
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
