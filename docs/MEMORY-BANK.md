# Memory Bank — Order Processing Management

> Última atualização: 16/03/2026 — WSO2 migrado para PostgreSQL; persistência garantida  
> Contexto: Keycloak + WSO2 API Manager + SSO

---

## Visão Geral do Projeto

Projeto Spring Boot 3 de gerenciamento de pedidos com:

- **Backend**: Java 21 + Spring Boot 3.5.8 + JPA + Liquibase + PostgreSQL
- **Auth**: Keycloak 20.0.5 como Identity Provider (realm `order-processing`)
- **Gateway**: WSO2 API Manager 4.5.0 para proteção de rotas via scopes
- **SSO**: Habilitado nativamente no realm Keycloak

---

## Estrutura de Arquivos Relevantes

```
OrderProcessingManagement/
├── docker-compose.yml                          # Infraestrutura: Postgres, Keycloak, WSO2
├── config-wso2.toml                            # deployment.toml do WSO2
├── keycloak/
│   ├── realm/
│   │   └── order-processing-realm.json         # Referência de configuração (realm/clients criados pela UI — ver SETUP §2)
│   └── scripts/
│       └── configure-module-clients.sh         # (Opcional) Scope mappings via Admin API — ver SETUP §2.7 (UI)
├── postgres/
│   └── init/
│       └── 01-wso2-databases.sql               # Cria WSO2AM_DB e WSO2SHARED_DB no Postgres
├── docs/
│   ├── SETUP-KEYCLOAK-WSO2-SSO.md             # Guia passo a passo completo
│   ├── TROUBLESHOOTING.md                      # Erros conhecidos e soluções
│   └── MEMORY-BANK.md                          # Este arquivo
└── src/main/resources/
    ├── openapi.yaml                             # API com securitySchemes OAuth2
    └── application.yaml                         # Config Spring Boot
```

---

## Serviços e Portas

| Serviço              | Porta(s)              | Credenciais          |
|----------------------|-----------------------|----------------------|
| PostgreSQL           | 5432                  | postgres / postgres  |
| Keycloak (Admin UI)  | 8081 → 8080           | admin / admin        |
| WSO2 Admin Portal    | 9443                  | admin / admin        |
| WSO2 Gateway HTTPS   | 8243                  | —                    |
| WSO2 Gateway HTTP    | 8280                  | —                    |

## Persistência de Dados

| Serviço   | Banco                  | Onde fica                          |
|-----------|------------------------|------------------------------------|
| Keycloak  | `order_processing_db`  | Volume Docker `postgres_data`      |
| WSO2 APIM | `WSO2AM_DB`            | Volume Docker `postgres_data`      |
| WSO2 APIM | `WSO2SHARED_DB`        | Volume Docker `postgres_data`      |
| WSO2 APIM | `WSO2CARBON_DB` (local)| Dentro do container (H2 — efêmero) |

> **Regra**: nunca usar `docker compose down -v`. Usar sempre `docker compose down` para preservar o volume `postgres_data`.  
> Para reset total (Keycloak/WSO2 no volume): `docker compose down -v && docker compose up -d` (perde tudo inclusive config manual do WSO2). Depois recrie o realm na UI (SETUP §2).

O script `postgres/init/01-wso2-databases.sql` é executado automaticamente pelo PostgreSQL **apenas na primeira inicialização** do container (quando o volume não existe ainda).

---

## Keycloak — Realm `order-processing`

### Grupos e Scopes

| Grupo   | Roles atribuídas                                                                                |
|---------|-------------------------------------------------------------------------------------------------|
| `user`  | `customers:read`, `products:read`, `orders:read`                                               |
| `admin` | `customers:read`, `customers:write`, `products:read`, `products:write`, `orders:read`, `orders:write` |

### Roles do Realm (usadas como scopes)

```
customers:read   customers:write
products:read    products:write
orders:read      orders:write
```

### Client Scopes registrados

| Nome                     | Finalidade                                                                              |
|--------------------------|-----------------------------------------------------------------------------------------|
| `order-processing-scopes`| Mapeia roles do realm para o claim `scope` do JWT (protocol mapper `oidc-usermodel-realm-role-mapper`) |
| `default`                | Scope exigido pelo `AccessTokenGenerator` do WSO2 (`OAUTH2_DEFAULT_SCOPE = "default"`). Já existia no Keycloak; vinculado ao `wso2-key-manager` como default scope |

### Clientes registrados

| clientId               | Tipo         | Secret                                         | Uso                                        |
|------------------------|--------------|------------------------------------------------|--------------------------------------------|
| `wso2-key-manager`     | Confidential | `wso2-key-manager-secret-change-in-production` | WSO2 gerenciar tokens (service account)    |
| `order-processing-api` | Confidential | `order-api-secret-change-in-production`        | Consumo da API / testes diretos (token completo) |
| `orders-module`        | Confidential | `orders-module-secret-change-in-production`    | Frontend modular — token apenas com orders:* |
| `products-module`      | Confidential | `products-module-secret-change-in-production`  | Frontend modular — token apenas com products:* |
| `customers-module`     | Confidential | `customers-module-secret-change-in-production` | Frontend modular — token apenas com customers:* |

> **Atenção**: todos os clientes são `publicClient: false`. O `client_secret` é **obrigatório** nas chamadas.
>
> **Módulos por client**: Os clientes `*-module` têm `fullScopeAllowed: false` e usam client scopes dedicados com scope mappings, limitando o token aos escopos do respectivo módulo. Configure os scope mappings **pela UI**: ver **docs/SETUP-KEYCLOAK-WSO2-SSO.md** § **2.7**. Alternativa: `keycloak/scripts/configure-module-clients.sh`.

### Client `wso2-key-manager` — configuração crítica

O `wso2-key-manager` precisa de:

1. **`serviceAccountsEnabled: true`** — necessário para `client_credentials`
2. **Default Client Scopes**: `default`, `openid`, `roles`, `role_list`, `profile`, `email`, `order-processing-scopes`
3. **Protocol mapper** `realm-management-roles`:
   - Tipo: `oidc-usermodel-client-role-mapper`
   - `claim.name`: `resource_access.realm-management.roles`
   - `usermodel.clientRoleMapping.clientId`: `realm-management`
   - Inclui roles do `realm-management` no access token → DCR API aceita o token
4. **Service account roles** (`manage-clients`, `view-clients`, `query-clients` do client `realm-management`) — atribuídas via Admin API (não via UI do Keycloak 20.x)

### Arquitetura modular (token por client)

Para evitar token grande quando o usuário tem muitas permissões, o frontend pode usar **um client por módulo**:
- Cada módulo (Orders, Products, Customers) tem seu próprio client OAuth
- O token inclui apenas os scopes daquele módulo
- Ao trocar de módulo, o frontend faz novo login com o client do módulo (SSO evita nova senha)

**Configuração na UI**: Configure os scope mappings dos client scopes `*-module-scopes` **pela UI do Keycloak** (passo a passo em **SETUP-KEYCLOAK-WSO2-SSO.md** § **2.7**). Opcionalmente: `bash keycloak/scripts/configure-module-clients.sh`.

### Realm no Keycloak (somente UI no compose)

- **Docker Compose**: Keycloak sobe com `start-dev` **sem** import automático; não há volume `keycloak/realm` montado.
- **Configuração**: criar realm `order-processing`, roles, grupos, client scopes e clients **pela Admin UI** — ver **SETUP-KEYCLOAK-WSO2-SSO.md** § **2**. O JSON em `keycloak/realm/` permanece como **referência** (import manual na UI ou CLI, se desejar).
- Reset total: `docker compose down -v && docker compose up -d`

### SSO

| Parâmetro                 | Valor       |
|---------------------------|-------------|
| `ssoSessionIdleTimeout`   | 1800s (30 min) |
| `ssoSessionMaxLifespan`   | 36000s (10 h) |
| `accessTokenLifespan`     | 300s (5 min) |

---

## WSO2 API Manager — Key Manager Keycloak

### Tipo obrigatório: `Keycloak`

> Tipo `Auth0` é **incompatível** com Keycloak: envia `scope=""` (vazio) e `audience=` no token request.  
> Tipo `Keycloak` usa o conector `keycloak.key.manager_2.1.1.jar` com suporte nativo a DCR da Keycloak Admin API.

### Configuração (via Admin Portal — não via `deployment.toml`)

URL: `https://localhost:9443/admin` → Key Managers → **Add Key Manager**

| Campo                        | Valor                                                                                 |
|------------------------------|---------------------------------------------------------------------------------------|
| Name                         | `Keycloak`                                                                            |
| **Key Manager Type**         | **`Keycloak`**                                                                        |
| Well-known URL               | `http://keycloak:8080/realms/order-processing/.well-known/openid-configuration`      |
| Issuer                       | `http://localhost:8081/realms/order-processing`                                      |
| Scope Management Endpoint    | `http://keycloak:8080/realms/order-processing/protocol/openid-connect/token` *(obrigatório na UI; usar token endpoint como placeholder)* |
| JWKS Endpoint                | `http://keycloak:8080/realms/order-processing/protocol/openid-connect/certs`         |
| **Client ID**                | `wso2-key-manager`                                                                   |
| **Client Secret**            | `wso2-key-manager-secret-change-in-production`                                       |
| Consumer Key Claim URI       | `azp`                                                                                 |
| Scopes Claim URI             | `roles`                                                                               |
| Grant Types                  | `client_credentials password refresh_token`                                           |
| Key Manager Permission       | **Allow for roles** → `admin`                                                         |
| Token Validation Method      | Self Validate JWT                                                                     |
| Token Handling Options       | JWT                                                                                   |
| Token Generation             | ON                                                                                    |
| **OAuth App Creation**       | **OFF** — não cria clientes dinamicamente no Keycloak                                |
| **Out Of Band Provisioning** | **ON** — aceita clientes pré-criados via "Provide Existing OAuth Keys"               |

### Key Manager Permission

| Opção | Comportamento |
|-------|---------------|
| **Public** | Qualquer usuário do Admin Portal pode gerenciar |
| **Allow for roles** | Apenas as roles listadas podem gerenciar *(usar esta)* |
| **Deny for roles** | Todos podem, exceto as roles listadas |

---

## OpenAPI — Mapeamento Rota × Scope

| Rota                        | Método | Scope exigido     |
|-----------------------------|--------|-------------------|
| GET /customers              | GET    | `customers:read`  |
| POST /customers             | POST   | `customers:write` |
| GET /customers/{id}         | GET    | `customers:read`  |
| GET /products               | GET    | `products:read`   |
| POST /products              | POST   | `products:write`  |
| GET /products/{id}          | GET    | `products:read`   |
| PUT /products/{id}          | PUT    | `products:write`  |
| DELETE /products/{id}       | DELETE | `products:write`  |
| GET /orders                 | GET    | `orders:read`     |
| POST /orders                | POST   | `orders:write`    |
| GET /orders/{id}            | GET    | `orders:read`     |
| GET /orders/customer/{id}   | GET    | `orders:read`     |
| PATCH /orders/{id}/status   | PATCH  | `orders:write`    |

---

## Decisões e Observações Importantes

| Decisão | Motivo |
|---------|--------|
| WSO2 usa PostgreSQL (não H2) | H2 é embutido no container — perdido em todo restart/recriação. PostgreSQL persiste no volume `postgres_data` |
| Keycloak 20.0.5 fixado | Versões mais novas mudam a UI e os caminhos de endpoints |
| Clientes como `confidential` | Mais seguro; exige `client_secret` em todas as chamadas |
| Roles do realm como scopes | Protocol mapper mapeia roles → claim `scope` do JWT; WSO2 lê esse claim para validar autorização |
| Scope Management Endpoint = token endpoint | Campo obrigatório na UI do WSO2 4.5.0; Keycloak não expõe esse endpoint; valor usado apenas para satisfazer validação de formulário |
| Tipo `Keycloak` (não `Auth0`) | Auth0 hardcoda `scope=""` e parâmetro `audience=` incompatíveis com Keycloak. Tipo `Keycloak` usa DCR API nativa |
| NÃO usar `wso2-key-manager` em "Provide Existing OAuth Keys" | Esse client é reservado para uso interno do WSO2. Para subscrições, usar `order-processing-api` |
| OAuth App Creation = OFF + Out of Band Provisioning = ON | Evita que WSO2 tente criar clientes dinamicamente; aceita o client pré-criado `order-processing-api` |
| Scope `default` vinculado ao `wso2-key-manager` | `AccessTokenGenerator` do WSO2 (`org.wso2.carbon.apimgt.impl`) sempre envia `scope=default` (`OAUTH2_DEFAULT_SCOPE = "default"`). Sem esse vínculo, Keycloak retorna `invalid_scope` |
| Roles do service account via Admin API | A UI do Keycloak 20.x para Service Account Roles não persiste corretamente via "Assign role". Usar: `POST /admin/realms/{realm}/users/{sa-uuid}/role-mappings/clients/{rm-uuid}` |
| Protocol mapper para DCR API | O mapper `oidc-usermodel-client-role-mapper` no client `wso2-key-manager` inclui `resource_access.realm-management.roles` no token. Sem ele, token não tem as roles e DCR API retorna `insufficient_scope` |

---

## Status da Integração

### Resolvidos ✅

| Data       | Erro                       | Causa Raiz                                                                 | Fix Aplicado                                                                 |
|------------|----------------------------|----------------------------------------------------------------------------|------------------------------------------------------------------------------|
| 16/03/2026 | `invalid_scope` (Auth0)    | Conector Auth0 envia `scope=""` hardcoded                                  | Trocar Key Manager para tipo `Keycloak`                                      |
| 16/03/2026 | `invalid_token` (DCR API)  | Consumer Key `wso2-key-manager` usado por engano; sem RAT                  | Usar `order-processing-api`; ativar Out Of Band + desativar OAuth App Creation |
| 16/03/2026 | `insufficient_scope` (DCR) | Roles `manage-clients` ausentes no token; falta do protocol mapper         | Atribuir roles via Admin API + adicionar `oidc-usermodel-client-role-mapper` |
| 16/03/2026 | `invalid_request` (token)  | `AccessTokenGenerator` envia `scope=default`; scope não vinculado ao client | Vincular scope `default` ao `wso2-key-manager` via Admin API (**confirmado**) |
| 16/03/2026 | `401` na chamada via WSO2  | `iss` do token era diferente do configurado no Key Manager                 | Padronizar Issuer do Key Manager para `http://localhost:8081/realms/order-processing` e sempre gerar tokens via `http://localhost:8081` |
| 16/03/2026 | `403` na chamada via WSO2  | Claim `scope` duplicado no JWT (string OIDC + array de roles conflitavam)  | Renomear `claim.name` do mapper `order-processing-scopes` de `scope` → `roles`; `Scopes Claim URI = roles` no Key Manager |

> **Token correto para chamadas via WSO2** (deve ter `iss=http://localhost:8081/...`):
> ```bash
> # Gerar sempre via localhost:8081 (host) para que o iss bata com o Issuer configurado no WSO2
> curl -X POST "http://localhost:8081/realms/order-processing/protocol/openid-connect/token" \
>   -d "grant_type=password&client_id=order-processing-api&client_secret=order-api-secret-change-in-production&username=SEU_USER&password=SENHA&scope=openid"
> ```

---

## Próximos Passos

- [ ] Atualizar Key Manager no WSO2: `Scopes Claim URI = roles` e confirmar que o `iss` no token bate com `http://localhost:8081/realms/order-processing`
- [ ] Testar "Provide Existing OAuth Keys" com `order-processing-api` no Developer Portal
- [ ] Publicar a API no WSO2 Publisher com scopes por recurso (SETUP §5)
- [ ] Criar usuários de teste nos grupos `user` e `admin` no Keycloak (SETUP §3)
- [ ] Testar chamada à API via WSO2 gateway com token gerado via `http://keycloak:8081`
- [ ] Validar fluxo completo: login → token → chamada protegida → scope enforcement
