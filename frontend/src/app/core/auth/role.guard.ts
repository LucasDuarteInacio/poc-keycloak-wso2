import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { KeycloakService } from './keycloak.service';

function pathFromActivatedRoute(route: ActivatedRouteSnapshot, router: Router): string {
  const segments = route.pathFromRoot.flatMap((r) => r.url.map((u) => u.path));
  const fullPath = '/' + segments.filter(Boolean).join('/');
  return fullPath || router.url;
}

/** De qual JWT as `roles` da rota devem ser avaliadas (sessão ativa no KeycloakService). */
type TokenContext = 'portal' | 'module';

function tokenContextForRoute(route: ActivatedRouteSnapshot): TokenContext {
  const explicit = route.data['tokenContext'] as TokenContext | undefined;
  if (explicit === 'portal' || explicit === 'module') return explicit;
  if (route.data['portalHome'] === true) return 'portal';
  return 'module';
}

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const keycloak = inject(KeycloakService);
  const router = inject(Router);

  if (!keycloak.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  const requiredRoles: string[] = route.data['roles'] ?? [];
  if (requiredRoles.length === 0) return true;

  // `*:write` implica acesso de leitura nas telas do módulo (token pode listar só write)
  const expanded = requiredRoles.flatMap((r) =>
    r.endsWith(':read') ? [r, r.replace(/:read$/, ':write')] : [r]
  );

  const path = pathFromActivatedRoute(route, router);
  const context = tokenContextForRoute(route);

  if (context === 'portal') {
    // Não usar claims do token do módulo para decidir acesso ao portal.
    if (!keycloak.isPortalSession()) {
      router.navigate(['/forbidden']);
      return false;
    }
    if (keycloak.hasAnyRole(expanded)) return true;
    // Token do portal: `userProfile.roles` já está filtrado para `mod:*` em applyToken.
    // Se o mapper não trouxer todas as mod:*, qualquer escopo de módulo no mesmo JWT ainda autoriza a home.
    if (keycloak.hasAnyPortalModuleScope()) return true;
    router.navigate(['/forbidden']);
    return false;
  }

  // Módulo: permissões só do client da rota (ex. customers:read no JWT do customers-module).
  const moduleKey = keycloak.getModuleForRoute(path);
  if (!moduleKey) {
    router.navigate(['/forbidden']);
    return false;
  }
  if (keycloak.getCurrentModule() !== moduleKey) {
    router.navigate(['/forbidden']);
    return false;
  }
  if (keycloak.hasAnyRole(expanded)) return true;

  router.navigate(['/forbidden']);
  return false;
};
