import { Component, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { KeycloakService } from '../core/auth/keycloak.service';
import { environment } from '../../environments/environment';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  /** Chave em `moduleClients` / `modulePortalScopes`; ausente no item Portal. */
  moduleKey?: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="d-flex vh-100 overflow-hidden">
      <!-- Sidebar -->
      <nav class="sidebar d-flex flex-column p-3">
        <div class="sidebar-brand d-flex align-items-center gap-2 mb-4 px-2">
          <i class="bi bi-box-seam fs-4 text-primary"></i>
          <span class="fw-bold fs-6">Order Processing</span>
        </div>

        <ul class="nav flex-column gap-1 flex-grow-1">
          @for (item of visibleNavItems(); track item.route) {
            <li class="nav-item">
              <a
                [routerLink]="item.route"
                routerLinkActive="active"
                class="nav-link d-flex align-items-center gap-2 rounded-2 px-3 py-2"
              >
                <i [class]="'bi ' + item.icon"></i>
                {{ item.label }}
              </a>
            </li>
          }
        </ul>

        <!-- User info -->
        <div class="sidebar-user mt-auto pt-3 border-top">
          @if (currentModuleLabel(); as mod) {
            <div class="badge bg-info bg-opacity-25 text-info mb-2 w-100 text-center py-1" style="font-size:0.65rem">
              Módulo: {{ mod }}
            </div>
          }
          <div class="d-flex align-items-center gap-2 px-2 mb-2">
            <div class="avatar-circle">
              {{ userInitial() }}
            </div>
            <div class="overflow-hidden">
              <div class="fw-semibold text-truncate small">{{ fullName() }}</div>
              @if (userEmail()) {
                <div class="text-muted text-truncate" style="font-size:0.7rem">{{ userEmail() }}</div>
              } @else {
                <div class="text-muted" style="font-size:0.7rem">{{ userRoleLabel() }}</div>
              }
            </div>
          </div>
          <button class="btn btn-outline-secondary btn-sm w-100 d-flex align-items-center justify-content-center gap-1" (click)="logout()">
            <i class="bi bi-box-arrow-right"></i> Sair
          </button>
        </div>
      </nav>

      <!-- Main content -->
      <main class="flex-grow-1 overflow-auto bg-light">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .sidebar {
      width: 240px;
      min-width: 240px;
      background: #fff;
      border-right: 1px solid #e9ecef;
      box-shadow: 2px 0 8px rgba(0,0,0,.04);
    }
    .sidebar-brand span {
      color: #212529;
    }
    .nav-link {
      color: #495057;
      font-size: .875rem;
      transition: background .15s, color .15s;
    }
    .nav-link:hover {
      background: #f8f9fa;
      color: #0d6efd;
    }
    .nav-link.active {
      background: #e7f1ff;
      color: #0d6efd;
      font-weight: 600;
    }
    .avatar-circle {
      width: 32px;
      height: 32px;
      min-width: 32px;
      border-radius: 50%;
      background: #0d6efd;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: .875rem;
    }
  `],
})
export class ShellComponent {
  private readonly keycloak = inject(KeycloakService);

  private readonly navItems: NavItem[] = [
    { label: 'Portal', icon: 'bi-grid-1x2', route: '/portal' },
    {
      label: 'Clientes',
      icon: 'bi-people',
      route: '/customers',
      moduleKey: 'customers',
    },
    {
      label: 'Produtos',
      icon: 'bi-bag',
      route: '/products',
      moduleKey: 'products',
    },
    {
      label: 'Pedidos',
      icon: 'bi-cart3',
      route: '/orders',
      moduleKey: 'orders',
    },
  ];

  /**
   * Lista todos os módulos com `mod:*` no portal (token atual ou backup). Trocar de módulo
   * pelo menu dispara o moduleGuard → SSO com o client certo, sem passar por /portal.
   */
  visibleNavItems = computed(() => {
    this.keycloak.userProfile();
    return this.navItems.filter((item) => {
      if (!item.moduleKey) return true;
      return this.keycloak.hasPortalGrantForModule(item.moduleKey);
    });
  });

  private profile = computed(() => this.keycloak.userProfile());

  userName = computed(() => this.profile()?.preferred_username ?? 'Usuário');

  fullName = computed(() => {
    const p = this.profile();
    if (p?.given_name || p?.family_name) {
      return [p.given_name, p.family_name].filter(Boolean).join(' ');
    }
    return p?.name ?? p?.preferred_username ?? 'Usuário';
  });

  userEmail = computed(() => this.profile()?.email ?? null);

  userInitial = computed(() => {
    const p = this.profile();
    const first = p?.given_name?.charAt(0) ?? p?.name?.charAt(0) ?? p?.preferred_username?.charAt(0) ?? 'U';
    const last = p?.family_name?.charAt(0) ?? '';
    return (first + last).toUpperCase();
  });

  userRoleLabel = computed(() => {
    const roles = this.keycloak.userProfile()?.roles ?? [];
    if (roles.includes('customers:write') || roles.includes('orders:write') || roles.includes('products:write')) {
      return 'Administrador';
    }
    return 'Usuário';
  });

  /** Módulo ativo (token enxuto por client) */
  currentModuleLabel = computed(() => {
    const mod = this.keycloak.getCurrentModule();
    if (!mod || mod === 'full') return null;
    return environment.keycloak.moduleClients?.[mod]?.label ?? mod;
  });

  logout(): void {
    this.keycloak.logout();
  }
}
