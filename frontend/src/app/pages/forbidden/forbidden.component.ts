import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="d-flex flex-column align-items-center justify-content-center vh-100 text-center gap-3">
      <i class="bi bi-shield-x text-danger" style="font-size:5rem"></i>
      <h2 class="fw-bold">Acesso Negado</h2>
      <p class="text-muted">Você não tem permissão para acessar esta página.</p>

      @if (hasAnyReadScope()) {
        <a routerLink="/portal" class="btn btn-primary">Ir ao portal</a>
      } @else {
        <p class="text-muted small">Seu usuário não possui nenhum escopo de leitura. Contate o administrador.</p>
        <button class="btn btn-outline-secondary" (click)="logout()">Sair</button>
      }
    </div>
  `,
})
export class ForbiddenComponent {
  private readonly keycloak = inject(KeycloakService);

  hasAnyReadScope = computed(() => {
    const mods = Object.values(environment.keycloak.modulePortalScopes ?? {});
    return (
      this.keycloak.hasAnyRole(['customers:read', 'products:read', 'orders:read']) ||
      this.keycloak.hasAnyRole(mods)
    );
  });

  logout(): void {
    this.keycloak.logout();
  }
}
