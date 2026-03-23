import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { KeycloakService } from './keycloak.service';

/**
 * Um único guard assíncrono para /portal: restaura token do portal se necessário e valida acesso.
 * Evita janela entre dois guards e permite a home quando o JWT é do client portal mesmo sem `mod:*`
 * no token (mapeamento Keycloak); o dashboard continua filtrando módulos.
 */
export const portalEntryGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const keycloak = inject(KeycloakService);
  const router = inject(Router);

  if (!keycloak.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  await keycloak.ensurePortalSessionWhenNeeded();

  if (!keycloak.isPortalSession()) {
    router.navigate(['/forbidden']);
    return false;
  }

  const requiredRoles: string[] = route.data['roles'] ?? [];
  if (requiredRoles.length === 0) {
    return true;
  }

  const expanded = requiredRoles.flatMap((r) =>
    r.endsWith(':read') ? [r, r.replace(/:read$/, ':write')] : [r]
  );

  if (keycloak.hasAnyRole(expanded) || keycloak.hasAnyPortalModuleScope()) {
    return true;
  }

  if (route.data['portalHome'] === true) {
    return true;
  }

  router.navigate(['/forbidden']);
  return false;
};
