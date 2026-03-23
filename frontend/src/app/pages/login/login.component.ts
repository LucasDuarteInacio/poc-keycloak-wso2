import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <div class="login-page d-flex align-items-center justify-content-center vh-100">
      <div class="login-card text-center p-5">
        <div class="mb-4">
          <i class="bi bi-box-seam display-1 text-primary"></i>
        </div>
        <h1 class="h3 fw-bold mb-1">Order Processing</h1>
        <p class="text-muted mb-4">
          Entre no <strong>portal</strong> para ver os módulos permitidos. Ao abrir um módulo, o SSO emite um
          <strong>novo token</strong> só com as permissões daquele módulo.
        </p>

        <button
          class="btn btn-primary btn-lg w-100 d-flex align-items-center justify-content-center gap-2 mb-3"
          (click)="login()"
          [disabled]="loading"
        >
          @if (loading && !selectedModule) {
            <span class="spinner-border spinner-border-sm"></span>
          } @else {
            <i class="bi bi-grid-3x3-gap"></i>
          }
          {{ loading && !selectedModule ? 'Redirecionando...' : 'Entrar no portal' }}
        </button>

        <details class="text-start small text-muted">
          <summary class="cursor-pointer user-select-none">Acesso direto a um módulo (atalho)</summary>
          <p class="mt-2 mb-2">Pula o portal e já solicita token do client do módulo.</p>
          @for (m of moduleOptions; track m.key) {
            <button
              class="btn btn-outline-secondary btn-sm w-100 d-flex align-items-center justify-content-center gap-2 mb-2"
              type="button"
              (click)="login(m.key)"
              [disabled]="loading"
            >
              @if (loading && selectedModule === m.key) {
                <span class="spinner-border spinner-border-sm"></span>
              } @else {
                <i [class]="'bi ' + m.icon"></i>
              }
              {{ m.label }}
            </button>
          }
        </details>

        <p class="mt-4 text-muted small mb-0">
          SSO · Realm <strong>order-processing</strong>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      background: linear-gradient(135deg, #0d6efd15 0%, #6610f215 100%);
    }
    .login-card {
      background: white;
      border-radius: 1.5rem;
      box-shadow: 0 20px 60px rgba(0,0,0,.12);
      min-width: 360px;
      max-width: 420px;
      width: 100%;
    }
  `],
})
export class LoginComponent implements OnInit {
  private readonly keycloak = inject(KeycloakService);
  private readonly router = inject(Router);

  loading = false;
  selectedModule: string | null = null;

  moduleOptions = [
    { key: 'orders', label: 'Pedidos', icon: 'bi-cart3' },
    { key: 'products', label: 'Produtos', icon: 'bi-bag' },
    { key: 'customers', label: 'Clientes', icon: 'bi-people' },
  ].filter((m) => environment.keycloak.moduleClients?.[m.key]);

  ngOnInit(): void {
    if (this.keycloak.isAuthenticated()) {
      this.router.navigate(['/portal']);
    }
  }

  login(moduleKey?: string): void {
    this.loading = true;
    this.selectedModule = moduleKey ?? null;
    const returnTo = moduleKey
      ? environment.keycloak.moduleClients?.[moduleKey]?.route
      : '/portal';
    this.keycloak.login(moduleKey, returnTo);
  }
}
