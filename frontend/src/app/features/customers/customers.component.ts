import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CustomersService, Customer } from '../../core/services/customers.service';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { SessionTokenScopesComponent } from '../../shared/session-token-scopes.component';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SessionTokenScopesComponent],
  template: `
    <div class="p-4">
      <div class="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h2 class="fw-bold mb-0">Clientes</h2>
          <p class="text-muted small mb-0">Gerenciamento de clientes</p>
        </div>
        @if (canWrite()) {
          <button class="btn btn-primary d-flex align-items-center gap-2" (click)="showForm.set(!showForm())">
            <i class="bi bi-plus-lg"></i> Novo Cliente
          </button>
        }
      </div>

      <app-session-token-scopes />

      @if (showForm()) {
        <div class="card mb-4">
          <div class="card-body">
            <h6 class="card-title fw-bold">Novo Cliente</h6>
            <form [formGroup]="form" (ngSubmit)="save()">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label small fw-semibold">Nome *</label>
                  <input type="text" class="form-control" formControlName="name" placeholder="Nome completo">
                </div>
                <div class="col-md-6">
                  <label class="form-label small fw-semibold">E-mail *</label>
                  <input type="email" class="form-control" formControlName="email" placeholder="email@exemplo.com">
                </div>
                <div class="col-md-6">
                  <label class="form-label small fw-semibold">Telefone</label>
                  <input type="text" class="form-control" formControlName="phone" placeholder="(11) 99999-9999">
                </div>
                <div class="col-md-6">
                  <label class="form-label small fw-semibold">Endereço</label>
                  <input type="text" class="form-control" formControlName="address" placeholder="Rua, número, cidade">
                </div>
              </div>
              <div class="d-flex gap-2 mt-3">
                <button type="submit" class="btn btn-primary btn-sm" [disabled]="form.invalid || saving()">
                  @if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span> }
                  Salvar
                </button>
                <button type="button" class="btn btn-outline-secondary btn-sm" (click)="showForm.set(false)">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      }

      @if (loading()) {
        <div class="text-center py-5">
          <div class="spinner-border text-primary"></div>
          <p class="mt-2 text-muted">Carregando clientes...</p>
        </div>
      } @else if (error()) {
        <div class="alert alert-danger d-flex align-items-center gap-2">
          <i class="bi bi-exclamation-triangle-fill"></i>
          {{ error() }}
          <button class="btn btn-sm btn-outline-danger ms-auto" (click)="load()">Tentar novamente</button>
        </div>
      } @else {
        <div class="card">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th class="px-4">ID</th>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Telefone</th>
                  <th>Endereço</th>
                </tr>
              </thead>
              <tbody>
                @for (c of customers(); track c.id) {
                  <tr>
                    <td class="px-4 text-muted">#{{ c.id }}</td>
                    <td class="fw-semibold">{{ c.name }}</td>
                    <td>{{ c.email }}</td>
                    <td>{{ c.phone ?? '—' }}</td>
                    <td>{{ c.address ?? '—' }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="text-center text-muted py-4">Nenhum cliente encontrado.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
})
export class CustomersComponent implements OnInit {
  private readonly service = inject(CustomersService);
  private readonly keycloak = inject(KeycloakService);
  private readonly fb = inject(FormBuilder);

  customers = signal<Customer[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  showForm = signal(false);

  canWrite = computed(() => this.keycloak.hasRole('customers:write'));

  form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    address: [''],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getAll().subscribe({
      next: (data) => { this.customers.set(data); this.loading.set(false); },
      error: (err) => {
        this.error.set(err.status === 403 ? 'Sem permissão para listar clientes.' : 'Erro ao carregar clientes.');
        this.loading.set(false);
      },
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.service.create(this.form.value as Customer).subscribe({
      next: (created) => {
        this.customers.update((list) => [...list, created]);
        this.form.reset();
        this.showForm.set(false);
        this.saving.set(false);
      },
      error: () => { this.saving.set(false); },
    });
  }
}
