import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { KeycloakService } from '../../core/auth/keycloak.service';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="d-flex flex-column align-items-center justify-content-center vh-100 gap-3">
      @if (!error) {
        <div class="text-center">
          <div class="spinner-border text-primary" style="width:3rem;height:3rem"></div>
          <p class="mt-3 text-muted">Autenticando...</p>
        </div>
      } @else {
        <div class="text-center">
          <i class="bi bi-x-circle text-danger display-1"></i>
          <p class="mt-3 text-danger">{{ error }}</p>
          <a routerLink="/login" class="btn btn-outline-primary">Voltar ao Login</a>
        </div>
      }
    </div>
  `,
})
export class CallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly keycloak = inject(KeycloakService);

  error: string | null = null;

  async ngOnInit(): Promise<void> {
    const code = this.route.snapshot.queryParamMap.get('code');
    const errorParam = this.route.snapshot.queryParamMap.get('error');

    if (errorParam) {
      this.error = `Erro do servidor de autenticação: ${errorParam}`;
      return;
    }

    if (!code) {
      this.error = 'Código de autorização não encontrado.';
      return;
    }

    const result = await this.keycloak.handleCallback(code);

    if (result.success) {
      this.router.navigateByUrl(result.returnTo ?? '/portal');
    } else {
      this.error = 'Falha ao trocar código por token. Tente novamente.';
    }
  }
}
