import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray } from '@angular/forms';
import { OrdersService, Order, OrderStatus } from '../../core/services/orders.service';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { SessionTokenScopesComponent } from '../../shared/session-token-scopes.component';

const STATUS_LABELS: Record<OrderStatus, { label: string; cls: string }> = {
  PENDING: { label: 'Pendente', cls: 'bg-warning-subtle text-warning border' },
  PROCESSING: { label: 'Em processamento', cls: 'bg-info-subtle text-info border' },
  SHIPPED: { label: 'Enviado', cls: 'bg-primary-subtle text-primary border' },
  DELIVERED: { label: 'Entregue', cls: 'bg-success-subtle text-success border' },
  CANCELLED: { label: 'Cancelado', cls: 'bg-danger-subtle text-danger border' },
};

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SessionTokenScopesComponent],
  template: `
    <div class="p-4">
      <div class="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h2 class="fw-bold mb-0">Pedidos</h2>
          <p class="text-muted small mb-0">Acompanhamento de pedidos</p>
        </div>
        @if (canWrite()) {
          <button class="btn btn-primary d-flex align-items-center gap-2" (click)="showForm.set(!showForm())">
            <i class="bi bi-plus-lg"></i> Novo Pedido
          </button>
        }
      </div>

      <app-session-token-scopes />

      @if (showForm()) {
        <div class="card mb-4">
          <div class="card-body">
            <h6 class="card-title fw-bold">Novo Pedido</h6>
            <form [formGroup]="form" (ngSubmit)="save()">
              <div class="row g-3">
                <div class="col-md-4">
                  <label class="form-label small fw-semibold">ID do Cliente *</label>
                  <input type="number" class="form-control" formControlName="customerId" min="1">
                </div>
              </div>

              <div class="mt-3">
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <label class="form-label small fw-semibold mb-0">Itens *</label>
                  <button type="button" class="btn btn-sm btn-outline-primary" (click)="addItem()">
                    <i class="bi bi-plus-sm"></i> Adicionar Item
                  </button>
                </div>
                <div formArrayName="items">
                  @for (item of itemsArray.controls; track $index) {
                    <div [formGroupName]="$index" class="row g-2 mb-2 align-items-end">
                      <div class="col">
                        <input type="number" class="form-control form-control-sm" formControlName="productId" placeholder="ID Produto" min="1">
                      </div>
                      <div class="col">
                        <input type="number" class="form-control form-control-sm" formControlName="quantity" placeholder="Qtd" min="1">
                      </div>
                      <div class="col-auto">
                        <button type="button" class="btn btn-sm btn-outline-danger" (click)="removeItem($index)">
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <div class="d-flex gap-2 mt-3">
                <button type="submit" class="btn btn-primary btn-sm" [disabled]="form.invalid || saving()">
                  @if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span> }
                  Criar Pedido
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
          <p class="mt-2 text-muted">Carregando pedidos...</p>
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
                  <th class="px-4">Pedido</th>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Criado em</th>
                  @if (canWrite()) { <th>Ações</th> }
                </tr>
              </thead>
              <tbody>
                @for (o of orders(); track o.id) {
                  <tr>
                    <td class="px-4 fw-semibold">#{{ o.id }}</td>
                    <td>Cliente #{{ o.customerId }}</td>
                    <td>
                      <span class="badge" [class]="statusCls(o.status!)">
                        {{ statusLabel(o.status!) }}
                      </span>
                    </td>
                    <td>{{ o.totalAmount | currency:'BRL' }}</td>
                    <td class="text-muted small">{{ o.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
                    @if (canWrite()) {
                      <td>
                        <select class="form-select form-select-sm" style="width:160px"
                          [value]="o.status"
                          (change)="changeStatus(o.id!, $any($event.target).value)">
                          @for (s of statuses; track s) {
                            <option [value]="s">{{ statusLabel(s) }}</option>
                          }
                        </select>
                      </td>
                    }
                  </tr>
                } @empty {
                  <tr>
                    <td [attr.colspan]="canWrite() ? 6 : 5" class="text-center text-muted py-4">
                      Nenhum pedido encontrado.
                    </td>
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
export class OrdersComponent implements OnInit {
  private readonly service = inject(OrdersService);
  private readonly keycloak = inject(KeycloakService);
  private readonly fb = inject(FormBuilder);

  orders = signal<Order[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  showForm = signal(false);

  canWrite = computed(() => this.keycloak.hasRole('orders:write'));

  readonly statuses: OrderStatus[] = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

  form = this.fb.group({
    customerId: [null as number | null, [Validators.required, Validators.min(1)]],
    items: this.fb.array([this.createItem()]),
  });

  get itemsArray(): FormArray {
    return this.form.get('items') as FormArray;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getAll().subscribe({
      next: (data) => { this.orders.set(data); this.loading.set(false); },
      error: (err) => {
        this.error.set(err.status === 403 ? 'Sem permissão para listar pedidos.' : 'Erro ao carregar pedidos.');
        this.loading.set(false);
      },
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.service.create(this.form.value as Order).subscribe({
      next: (created) => {
        this.orders.update((list) => [created, ...list]);
        this.form.reset();
        this.itemsArray.clear();
        this.addItem();
        this.showForm.set(false);
        this.saving.set(false);
      },
      error: () => { this.saving.set(false); },
    });
  }

  changeStatus(id: number, status: OrderStatus): void {
    this.service.updateStatus(id, status).subscribe({
      next: (updated) => {
        this.orders.update((list) => list.map((o) => (o.id === id ? updated : o)));
      },
    });
  }

  addItem(): void {
    this.itemsArray.push(this.createItem());
  }

  removeItem(index: number): void {
    this.itemsArray.removeAt(index);
  }

  statusLabel(status: OrderStatus): string {
    return STATUS_LABELS[status]?.label ?? status;
  }

  statusCls(status: OrderStatus): string {
    return STATUS_LABELS[status]?.cls ?? '';
  }

  private createItem() {
    return this.fb.group({
      productId: [null as number | null, [Validators.required, Validators.min(1)]],
      quantity: [1, [Validators.required, Validators.min(1)]],
    });
  }
}
