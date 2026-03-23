# Keycloak — Mapeamento de realm roles nos client scopes (somente UI)

Este guia substitui o script removido `keycloak/scripts/configure-module-clients.sh`. O objetivo é **restringir quais realm roles entram no JWT** quando cada client scope opcional é solicitado no login da SPA (`order-processing-portal`).

**Pré-requisitos**

- Realm **`order-processing`** criado (ver **docs/SETUP-KEYCLOAK-WSO2-SSO.md**).
- Client scopes existentes com mappers **User Realm Role** (claim `roles`, multivalued), conforme o SETUP § 2.4 / 2.7:
  - `portal-module-scopes`
  - `orders-module-scopes`
  - `products-module-scopes`
  - `customers-module-scopes`

Sem os mapeamentos abaixo na aba **Scope** de cada client scope, o Keycloak pode colocar **todas** as roles do usuário no token.

---

## Resumo (o que associar em cada scope)

| Client scope | Realm roles a associar |
|--------------|-------------------------|
| `portal-module-scopes` | `mod:orders`, `mod:products`, `mod:customers` |
| `orders-module-scopes` | `orders:read`, `orders:write` |
| `products-module-scopes` | `products:read`, `products:write` |
| `customers-module-scopes` | `customers:read`, `customers:write` |

---

## Passo a passo na Admin Console

1. Abra o Keycloak Admin (ex.: **http://localhost:8081/admin**), realm **`order-processing`**.
2. Menu **Client scopes**.
3. Clique no **nome** do client scope (ex.: `orders-module-scopes`).
4. Aba **Scope** (não confundir com **Mappers**).
5. Em **Realm roles**, use **Assign role** e selecione **apenas** as roles da tabela acima para esse scope.
6. Se já existirem roles incorretas ou a mais, remova-as (**Unassign**) até ficar só o conjunto indicado.
7. Repita para os **quatro** client scopes.

**Conferência rápida**

- `portal-module-scopes` → só as três roles `mod:*`.
- Cada `*-module-scopes` de API → só as duas roles `*:read` e `*:write` daquele domínio.

---

## Leitura adicional

- Contexto do client único da SPA e lista de scopes opcionais: **docs/SETUP-KEYCLOAK-WSO2-SSO.md** § **2.6** e § **2.7**.
- Decisões do projeto: **docs/MEMORY-BANK.md** (Keycloak / client scopes).
