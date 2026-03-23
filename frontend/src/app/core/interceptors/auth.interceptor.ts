import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { KeycloakService } from '../auth/keycloak.service';
import { environment } from '../../../environments/environment';

/**
 * Sempre o Bearer do **client da sessão atual**: `order-processing-portal` no portal ou
 * `orders-module` / `products-module` / `customers-module` dentro do módulo.
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
