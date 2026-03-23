import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { KeycloakService } from './keycloak.service';

/**
 * Guard que verifica se a sessão (contexto portal vs módulo) bate com a rota.
 * Ao entrar num módulo a partir do portal (ou trocar de módulo), inicia novo fluxo OAuth
 * com o mesmo client e **client scopes** distintos (token enxuto por escopo).
 */
export const moduleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const keycloak = inject(KeycloakService);
  const router = inject(Router);

  if (!keycloak.isAuthenticated()) {
    return true; // authGuard cuida disso
  }

  const segments = route.pathFromRoot.flatMap((r) => r.url.map((u) => u.path));
  const fullPath = '/' + segments.filter(Boolean).join('/');

  const pathToCheck = fullPath || router.url;
  const moduleKey = keycloak.getModuleForRoute(pathToCheck);

  if (keycloak.isPortalSession() && moduleKey && !keycloak.hasPortalAccessToModule(moduleKey)) {
    router.navigate(['/forbidden']);
    return false;
  }

  if (keycloak.needsModuleSwitch(pathToCheck)) {
    if (moduleKey) {
      keycloak.loginForModule(moduleKey, pathToCheck);
      return false;
    }
  }

  return true;
};
