import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KeycloakService } from '../core/auth/keycloak.service';

/**
 * Alerta + badges de escopos do token (igual ao bloco superior do dashboard /portal).
 */
@Component({
  selector: 'app-session-token-scopes',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (keycloak.isPortalSession()) {
      <div class="alert alert-info d-flex gap-2 align-items-start mb-3">
        <i class="bi bi-key mt-1"></i>
        <div>
          <strong>Sessão do portal.</strong> O token traz apenas escopos <code>mod:*</code> (quais módulos você pode abrir).
          Ao entrar num módulo, o SSO emite um token com permissões finas (<code>orders:read</code>, etc.) para a API.
        </div>
      </div>
    } @else if (moduleLabel()) {
      <div class="alert alert-secondary d-flex gap-2 align-items-start mb-3">
        <i class="bi bi-shield-lock mt-1"></i>
        <div>
          <p class="mb-1">
            Você está no módulo <strong>{{ moduleLabel() }}</strong> com token restrito.
            Para abrir outro módulo, use o menu lateral — o SSO refaz o login com outros client scopes no mesmo client.
          </p>
          @if (portalModScope()) {
            <p class="mb-0 small text-muted">
              Escopo no <strong>token do portal</strong> que libera este módulo no menu:
              <code>{{ portalModScope() }}</code>
              (mantido em backup enquanto você usa o token do módulo).
            </p>
          }
        </div>
      </div>
    }

    <div class="mb-3 d-flex flex-wrap gap-2">
      <span class="badge bg-secondary-subtle text-secondary border">
        <i class="bi bi-shield-check me-1"></i>{{ badgeLabel() }}
      </span>
      @for (role of scopeBadges(); track role) {
        <span class="badge bg-primary-subtle text-primary border">{{ role }}</span>
      }
    </div>
  `,
})
export class SessionTokenScopesComponent {
  readonly keycloak = inject(KeycloakService);

  moduleLabel = computed(() => {
    this.keycloak.userProfile();
    return this.keycloak.getActiveModuleLabel();
  });

  portalModScope = computed(() => {
    this.keycloak.userProfile();
    return this.keycloak.getPortalModScopeForActiveModule();
  });

  scopeBadges = computed(() => {
    this.keycloak.userProfile();
    return this.keycloak.getScopeBadgesForDisplay();
  });

  badgeLabel = computed(() => {
    this.keycloak.userProfile();
    return this.keycloak.getSessionBadgeLabel();
  });
}
