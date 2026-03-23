import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { environment, type ModuleClient } from '../../../environments/environment';
import { SessionTokenScopesComponent } from '../../shared/session-token-scopes.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, SessionTokenScopesComponent],
  template: `
    <div class="p-4">
      <div class="mb-4">
        <h2 class="fw-bold mb-1">Portal</h2>
        <p class="text-muted mb-1">
          Olá, {{ userName() }}! Abaixo estão os <strong>módulos</strong> que seu usuário pode usar.
        </p>
        @if (email()) {
          <p class="text-muted mb-0 small">
            <i class="bi bi-envelope me-1"></i>{{ email() }}
            @if (emailVerified()) {
              <span class="badge bg-success-subtle text-success border ms-1">verificado</span>
            }
          </p>
        }
      </div>

      <app-session-token-scopes />

      <h3 class="h6 text-uppercase text-muted mb-3">Módulos disponíveis</h3>

      <div class="row g-3">
        @for (item of accessibleModules(); track item.key) {
          <div class="col-md-4">
            <a [routerLink]="item.client.route" class="card card-hover text-decoration-none h-100 text-body">
              <div class="card-body d-flex flex-column gap-2 p-4">
                <div class="d-flex align-items-center gap-3">
                  <div class="feature-icon" [class]="item.toneClass">
                    <i [class]="'bi fs-4 ' + item.icon"></i>
                  </div>
                  <div>
                    <h6 class="fw-bold mb-0">{{ item.client.label }}</h6>
                    <small class="text-muted">{{ item.client.route }}</small>
                  </div>
                </div>
                <p class="small text-muted mb-0">
                  @if (keycloak.isPortalSession()) {
                    <span>Escopo portal: <code class="small">{{ portalScopeFor(item.key) }}</code></span>
                  } @else {
                    <span>API: <code class="small">{{ item.client.roles.join(', ') }}</code></span>
                  }
                </p>
              </div>
            </a>
          </div>
        }

        @if (accessibleModules().length === 0) {
          <div class="col-12">
            <div class="alert alert-warning d-flex align-items-center gap-2">
              <i class="bi bi-exclamation-triangle-fill"></i>
              Nenhum módulo disponível para seu usuário. Contate o administrador.
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .card-hover {
      transition: transform .15s, box-shadow .15s;
      border: 1px solid #e9ecef;
    }
    .card-hover:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,.1);
    }
    .feature-icon {
      width: 52px;
      height: 52px;
      min-width: 52px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .tone-customers { background: #dbeafe; color: #0d6efd; }
    .tone-products { background: #dcfce7; color: #198754; }
    .tone-orders { background: #fef3c7; color: #d97706; }
    .tone-default { background: #f1f5f9; color: #475569; }
  `],
})
export class DashboardComponent {
  readonly keycloak = inject(KeycloakService);

  private readonly moduleMeta: Record<
    string,
    { icon: string; toneClass: string }
  > = {
    customers: { icon: 'bi-people', toneClass: 'tone-customers' },
    products: { icon: 'bi-bag', toneClass: 'tone-products' },
    orders: { icon: 'bi-cart3', toneClass: 'tone-orders' },
  };

  private readonly clients = environment.keycloak.moduleClients ?? {};

  profile = computed(() => this.keycloak.userProfile());
  userName = computed(() => this.profile()?.name ?? this.profile()?.preferred_username ?? 'Usuário');
  email = computed(() => this.profile()?.email);
  emailVerified = computed(() => this.profile()?.email_verified ?? false);

  accessibleModules = computed(() => {
    const out: Array<{ key: string; client: ModuleClient; icon: string; toneClass: string }> = [];
    for (const [key, client] of Object.entries(this.clients)) {
      if (this.canEnterModule(key, client)) {
        const meta = this.moduleMeta[key] ?? { icon: 'bi-box-seam', toneClass: 'tone-default' };
        out.push({ key, client, icon: meta.icon, toneClass: meta.toneClass });
      }
    }
    return out;
  });

  portalScopeFor(moduleKey: string): string {
    return environment.keycloak.modulePortalScopes?.[moduleKey] ?? moduleKey;
  }

  private canEnterModule(key: string, mod: ModuleClient): boolean {
    if (this.keycloak.isPortalSession()) {
      return this.keycloak.hasPortalAccessToModule(key);
    }
    const writeAlts = mod.roles.map((r) => r.replace(':read', ':write'));
    return this.keycloak.hasAnyRole([...mod.roles, ...writeAlts]);
  }
}
