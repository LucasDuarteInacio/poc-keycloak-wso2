import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { KeycloakService } from '../auth/keycloak.service';
import { environment } from '../../../environments/environment';

/**
 * Bearer do token da sessão (portal ou módulo): um único client OAuth (`environment.keycloak.clientId`);
 * o conteúdo do JWT varia conforme os client scopes pedidos no login.
 * No WSO2, inscreva cada um desses clients na API (Provide Existing OAuth Keys).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const keycloak = inject(KeycloakService);
  const apiRoot = environment.apiUrl;
  if (!req.url.startsWith(apiRoot)) {
    return next(req);
  }

  return from(keycloak.getOrRefreshSessionTokenForApi()).pipe(
    switchMap((token) => {
      if (token) {
        return next(
          req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        );
      }
      return next(req);
    })
  );
};
