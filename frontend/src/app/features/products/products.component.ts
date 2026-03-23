import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ProductsService, Product } from '../../core/services/products.service';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { SessionTokenScopesComponent } from '../../shared/session-token-scopes.component';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SessionTokenScopesComponent],
  template: `
    <div class="p-4">
      <div class="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h2 class="fw-bold mb-0">Produtos</h2>
          <p class="text-muted small mb-0">Catálogo de produtos</p>
        </div>
        @if (canWrite()) {
          <button class="btn btn-primary d-flex align-items-center gap-2" (click)="showForm.set(!showForm())">
            <i class="bi bi-plus-lg"></i> Novo Produto
          </button>
        }
      </div>

      <app-session-token-scopes />

      @if (showForm()) {
        <div class="card mb-4">
          <div class="card-body">
            <h6 class="card-title fw-bold">Novo Produto</h6>
            <form [formGroup]="form" (ngSubmit)="save()">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label small fw-semibold">Nome *</label>
                  <input type="text" class="form-control" formControlName="name">
                </div>
                <div class="col-md-6">
                  <label class="form-label small fw-semibold">Preço *</label>
                  <input type="number" class="form-control" formControlName="price" min="0" step="0.01">
                </div>
                <div class="col-md-6">
                  <label class="form-label small fw-semibold">Estoque</label>
                  <input type="number" class="form-control" formControlName="stock" min="0">
                </div>
                <div class="col-md-6">
                  <label class="form-label small fw-semibold">Descrição</label>
                  <input type="text" class="form-control" formControlName="description">
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
          <p class="mt-2 text-muted">Carregando produtos...</p>
        </div>
      } @else if (error()) {
        <div class="alert alert-danger d-flex align-items-center gap-2">
          <i class="bi bi-exclamation-triangle-fill"></i>
          {{ error() }}
          <button class="btn btn-sm btn-outline-danger ms-auto" (click)="load()">Tentar novamente</button>
        </div>
      } @else {
        <div class="row g-3">
          @for (p of products(); track p.id) {
            <div class="col-md-4 col-lg-3">
              <div class="card h-100 product-card">
                <div class="card-body">
                  <h6 class="fw-bold mb-1">{{ p.name }}</h6>
                  <p class="text-muted small mb-2">{{ p.description ?? 'Sem descrição' }}</p>
                  <div class="d-flex align-items-center justify-content-between">
                    <span class="fw-bold text-primary fs-5">{{ p.price | currency:'BRL' }}</span>
                    <span class="badge bg-secondary-subtle text-secondary border small">
                      Estoque: {{ p.stock ?? 0 }}
                    </span>
                  </div>
                </div>
                @if (canWrite()) {
                  <div class="card-footer bg-transparent border-top d-flex gap-2">
                    <button class="btn btn-sm btn-outline-danger w-100" (click)="remove(p.id!)">
                      <i class="bi bi-trash"></i> Remover
                    </button>
                  </div>
                }
              </div>
            </div>
          } @empty {
            <div class="col-12 text-center text-muted py-5">Nenhum produto encontrado.</div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .product-card { border: 1px solid #e9ecef; transition: box-shadow .15s; }
    .product-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.08); }
  `],
})
export class ProductsComponent implements OnInit {
  private readonly service = inject(ProductsService);
  private readonly keycloak = inject(KeycloakService);
  private readonly fb = inject(FormBuilder);

  products = signal<Product[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  showForm = signal(false);

  canWrite = computed(() => this.keycloak.hasRole('products:write'));

  form = this.fb.group({
    name: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    stock: [0],
    description: [''],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getAll().subscribe({
      next: (data) => { this.products.set(data); this.loading.set(false); },
      error: (err) => {
        this.error.set(err.status === 403 ? 'Sem permissão para listar produtos.' : 'Erro ao carregar produtos.');
        this.loading.set(false);
      },
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.service.create(this.form.value as Product).subscribe({
      next: (created) => {
        this.products.update((list) => [...list, created]);
        this.form.reset({ price: 0, stock: 0 });
        this.showForm.set(false);
        this.saving.set(false);
      },
      error: () => { this.saving.set(false); },
    });
  }

  remove(id: number): void {
    if (!confirm('Deseja remover este produto?')) return;
    this.service.delete(id).subscribe({
      next: () => this.products.update((list) => list.filter((p) => p.id !== id)),
    });
  }
}
