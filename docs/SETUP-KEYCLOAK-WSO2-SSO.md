# Setup Keycloak + WSO2 — Order Processing Management

Este guia descreve a configuração completa da integração Keycloak + WSO2 API Manager.

## Visão Geral

- **Keycloak**: Identity Provider com realm `order-processing`, grupos `admin` e `user`, scopes das rotas
- **WSO2 API Manager**: API Gateway que valida tokens JWT emitidos pelo Keycloak
- **Key Manager**: Tipo `Keycloak` com client `wso2-key-manager` (service account com roles de gerenciamento)

## Mapeamento de Grupos e Scopes

| Grupo   | Scopes                                                                     |
|---------|----------------------------------------------------------------------------|
| **user** | customers:read, products:read, orders:read                                |
| **admin** | customers:read, customers:write, products:read, products:write, orders:read, orders:write |

### Mapeamento Rota → Scope

| Rota                        | Método | Scope(s)        |
|-----------------------------|--------|-----------------|
| GET /customers              | GET    | customers:read  |
| POST /customers             | POST   | customers:write |
| GET /customers/{id}         | GET    | customers:read  |
| GET /products               | GET    | products:read   |
| POST /products              | POST   | products:write  |
| GET /products/{id}          | GET    | products:read   |
| PUT /products/{id}          | PUT    | products:write  |
| DELETE /products/{id}       | DELETE | products:write  |
| GET /orders                 | GET    | orders:read     |
| POST /orders                | POST   | orders:write    |
| GET /orders/{id}            | GET    | orders:read     |
| GET /orders/customer/{id}   | GET    | orders:read     |
| PATCH /orders/{id}/status   | PATCH  | orders:write    |

---

## 1. Subir os Serviços

```bash
docker compose up -d
```

---

## 2. Criar o realm, client scopes e clients

Faça login na Admin UI: **http://localhost:8081** → usuário `admin` / `admin` (ou o definido no compose). Tudo abaixo é feito **sem** importar JSON.

### 2.1 Criar o realm

1. No canto superior esquerdo, abra o seletor de realm → **Create realm**.
2. **Realm name**: `order-processing` → **Create**.

Ajustes recomendados em **Realm settings** (aba **General** / **Login** / **Sessions**/ **Tokens**):

| Opção | Valor sugerido |
|--------|----------------|
| **Require SSL** | `External requests` (equivalente a `external`) |
| **User registration** | OFF |
| **Login with email** | ON |
| **Forgot password** | ON (se desejar reset) |
| **Brute force detection** | ON |
| **SSO Session Idle** | 30 min (1800 s) |
| **SSO Session Max** | 10 h (36000 s) |
| **Access Token Lifespan** | 5 min (300 s) |

### 2.2 Roles do realm (usadas como escopos da API)

Em **Realm roles** → **Create role**, crie:

| Role | Descrição (opcional) |
|------|----------------------|
| `customers:read` | Leitura de clientes |
| `customers:write` | Criação/edição de clientes |
| `products:read` | Leitura de produtos |
| `products:write` | Criação/edição/exclusão de produtos |
| `orders:read` | Leitura de pedidos |
| `orders:write` | Criação/edição de pedidos |

### 2.3 Grupos e atribuição de roles

Em **Groups** → **Create group**:

1. Grupo **`user`** (path `/user`): em **Role mapping** → **Assign role** → filtre **Filter by clients** desligado → atribua `customers:read`, `products:read`, `orders:read`.
2. Grupo **`admin`** (path `/admin`): atribua todas as seis realm roles acima.

### 2.4 Client scopes e protocol mappers

Use **Client scopes** → **Create client scope** quando precisar criar os dedicados. Os built-in **`profile`** e **`email`** já vêm no realm; mantenha-os com os mappers OIDC usuais (preferred_username, given_name, email, etc.) ou alinhe ao JSON de referência.

Crie estes scopes (Protocol: **OpenID Connect**), com **Include in token scope** = ON onde indicado:

#### Scope `default`

- **Name**: `default`  
- **Description**: Scope padrão exigido pelo WSO2 `AccessTokenGenerator` (`OAUTH2_DEFAULT_SCOPE`)  
- **Display on consent screen**: OFF  

#### Scope `order-processing-scopes`

- **Name**: `order-processing-scopes`  
- **Description**: Escopos da API Order Processing (todos os módulos); expõe as realm roles do usuário no claim **roles** do token para o WSO2 e o backend validarem autorização.  
- **Display on consent screen**: ON (ou OFF, se preferir)
- Aba **Mappers** → **Configure a new mapper** → **User Realm Role** (`oidc-usermodel-realm-role-mapper`):  
  - **Name**: ex. `realm-roles-to-scope`  
  - **Token claim name**: `roles`  
  - **Multivalued**: ON  
  - Incluir em **Access token**, **ID token** e **Userinfo** conforme necessidade  

#### Scopes `orders-module-scopes`, `products-module-scopes`, `customers-module-scopes`

Crie **três** client scopes (um por linha). Em todos: **Protocol** OpenID Connect, **Include in token scope** ON.

| Name | Description (campo na UI) | Display on consent screen |
|------|---------------------------|---------------------------|
| `orders-module-scopes` | Escopos somente do módulo **Orders**; o claim **roles** no token fica restrito às realm roles de pedidos (`orders:read` / `orders:write`) após o mapeamento na aba **Scope** (§ 2.7). | OFF |
| `products-module-scopes` | Escopos somente do módulo **Products**; o claim **roles** reflete apenas `products:read` / `products:write` quando mapeado em **Scope** (§ 2.7). | OFF |
| `customers-module-scopes` | Escopos somente do módulo **Customers**; o claim **roles** reflete apenas `customers:read` / `customers:write` quando mapeado em **Scope** (§ 2.7). | OFF |

Para cada um, adicione um mapper **User Realm Role** igual ao acima (claim `roles`, multivalued). O **filtro** de quais roles entram no token é feito na aba **Scope** de cada client scope (**Realm roles** — ver **§ 2.7**).

### 2.5 Client scopes padrão do realm(rever)

Em **Realm settings** → **Client scopes** → aba **Default client scopes**, adicione à lista padrão (além do que o Keycloak já trouxer, tipicamente `role_list`):

- `profile`  
- `email`  
- `order-processing-scopes`  

(Se `role_list` não existir no seu realm, crie-o ou use o padrão da sua versão.)

### 2.6 Clients OAuth

Em **Clients** → **Create client** para cada linha da tabela. Todos são **confidential** (Client authentication = ON), protocolo **OpenID Connect**.

| Client ID | Uso | Client authentication | Service accounts | Full scope allowed | Redirect URIs (exemplo dev) | Web origins |
|-----------|-----|------------------------|------------------|--------------------|----------------------------|-------------|
| `wso2-key-manager` | WSO2 validar tokens / DCR | ON | **ON** | **ON** | `https://localhost:9443/*`, `https://localhost:8243/*` | `*` (ou restrinja em produção) |
| `order-processing-portal` | Login **portal** — token só com `mod:*` (quais módulos pode abrir) | ON | OFF | **OFF** | `http://localhost:4200/*`, `http://localhost:4200/callback` | `http://localhost:4200` |
| `order-processing-api` | Token completo (WSO2) + 2º passo OAuth `prompt=none` após portal | ON | OFF | ON | `https://localhost:9443/*`, `https://localhost:8243/*`, `http://localhost:4200/*` | `*` |
| `orders-module` | Frontend modular Orders | ON | OFF | **OFF** | `http://localhost:4200/*`, `http://localhost:4200/callback` | `http://localhost:4200` |
| `products-module` | Frontend modular Products | ON | OFF | **OFF** | idem | idem |
| `customers-module` | Frontend modular Customers | ON | OFF | **OFF** | idem | idem |

**Secrets**: em **Credentials**, copie ou defina secrets fortes; o projeto usa placeholders no JSON de referência (`wso2-key-manager-secret-change-in-production`, `order-api-secret-change-in-production`, etc.) — **troque em produção**.

**PKCE**: para `order-processing-portal`, `order-processing-api` e clients `*-module`, em **Advanced** / **Advanced settings**, defina **Proof Key for Code Exchange Code Challenge Method** = `S256` (se disponível na sua UI).

**Realm roles `mod:*`**: crie `mod:customers`, `mod:products`, `mod:orders` e atribua aos grupos conforme o acesso ao portal (ex.: grupo `user` com os três se pode abrir os três módulos). O frontend valida esses escopos nas telas do portal.

**Client scope `portal-module-scopes`**: crie um scope (protocol mappers → **User Realm Role**, claim `roles`, multivalued) e na aba **Scope** → **Realm roles** associe **apenas** `mod:customers`, `mod:products`, `mod:orders`. Sem isso o token do portal pode carregar todas as roles do realm.

**Client scopes (aba Client scopes do client)**:

- **`wso2-key-manager`** → **Default client scopes**: inclua `default`, `openid`, `roles`, `role_list`, `profile`, `email`, `order-processing-scopes` (adicione **Add client scope** → **Default** o que faltar).  
- **`order-processing-portal`**: `role_list`, `profile`, `email`, `portal-module-scopes` (não use `order-processing-scopes` neste client).  
- **`order-processing-api`**: `role_list`, `profile`, `email`, `order-processing-scopes`.  
- **`orders-module`**: `role_list`, `profile`, `email`, `orders-module-scopes` (não use `order-processing-scopes` neste client).  
- **`products-module`**: `role_list`, `profile`, `email`, `products-module-scopes`.  
- **`customers-module`**: `role_list`, `profile`, `email`, `customers-module-scopes`.

**Protocol mapper no `wso2-key-manager`** (aba **Client scopes** do client → mappers do client ou **Mappers** direto no client, conforme versão): mapper **User Client Role** (`oidc-usermodel-client-role-mapper`):

- **Name**: `realm-management-roles`  
- **Client ID** / `usermodel.clientRoleMapping.clientId`: `realm-management`  
- **Token claim name**: `resource_access.realm-management.roles`  
- **Multivalued**: ON  
- Incluir no **Access token** (mínimo); ID/Userinfo opcional  

As **roles do service account** (`manage-clients`, `view-clients`, `query-clients` do client `realm-management`) costumam ser atribuídas de forma confiável via **Admin API** — ver **§ 4.2** deste guia.

### 2.7 (Opcional) Token enxuto por módulo — mapeamento de roles nos client scopes

Use se o frontend usa um client OAuth por módulo (`orders-module`, `products-module`, `customers-module`). Depois de criados os client scopes `*-module-scopes` e os clients (**§ 2.6**), associe **apenas** as realm roles indicadas em cada scope (aba **Scope** → **Realm roles**):

| Client scope | Realm roles |
|--------------|-------------|
| `orders-module-scopes` | `orders:read`, `orders:write` |
| `products-module-scopes` | `products:read`, `products:write` |
| `customers-module-scopes` | `customers:read`, `customers:write` |

Sem isso, o mapper pode colocar **todas** as roles do usuário no JWT.

**Conferência dos clients `*-module`**: **Full scope allowed** = OFF; **Default client scopes** inclui o scope do módulo + `role_list`, `profile`, `email`.

**Teste**: gere um token com `orders-module` e verifique no JWT o claim **`roles`** (só orders, conforme grupo) e **`azp`** = `orders-module`.

> **Alternativa**: `keycloak/scripts/configure-module-clients.sh` aplica os mapeamentos via Admin API.

---

## 3. Criar Usuários e Atribuir Grupos (Keycloak)

1. Acesse: **http://localhost:8081** (Keycloak Admin UI)
2. Login: `admin` / `admin`
3. Selecione o realm **order-processing**
4. **Users** → **Add user** → crie usuários de teste
5. Para cada usuário: aba **Groups** → **Join Group** → escolha `/user` ou `/admin`

> Usuários no grupo `admin` recebem automaticamente todas as roles (incluindo write).  
> Usuários no grupo `user` recebem apenas roles de leitura.

---

## 4. Configurar Keycloak como Key Manager no WSO2

O WSO2 precisa de um Key Manager do tipo **Keycloak** para validar tokens JWT e gerenciar clientes OAuth via DCR.

### 4.1 Pré-requisito: verificar o client scope `default` no Keycloak

O `AccessTokenGenerator` do WSO2 sempre envia `scope=default` ao solicitar tokens de gerenciamento. Esse scope deve existir no Keycloak e estar atribuído ao client `wso2-key-manager`.

1. Acesse o Keycloak Admin UI em `http://localhost:8081` e selecione o realm **order-processing**.  
2. No menu lateral, vá em **Client scopes**.  
3. Verifique se existe um client scope chamado **`default`** na lista.  
4. Se o scope **não existir**, clique em **Create client scope** e preencha:
   - **Name**: `default`  
   - **Description**: `Scope padrão exigido pelo WSO2 AccessTokenGenerator`  
   - **Protocol**: `openid-connect`  
5. Salve o client scope e, na aba de configurações:
   - Garanta que **Include in token scope** esteja habilitado/`true`.  
   - Defina **Display on consent screen** como **false**.  

Vincule o scope `default` ao client `wso2-key-manager` pela UI do Keycloak:

1. No Keycloak Admin UI, ainda no realm **order-processing**, acesse **Clients**.  
2. Clique no client **`wso2-key-manager`**.  
3. Vá até a aba **Client scopes**.  
4. Clique em **Add client scope**.  
5. Na lista, selecione o client scope **`default`** e confirme.  

Teste para confirmar:

```bash
BASE64=$(echo -n "wso2-key-manager:wso2-key-manager-secret-change-in-production" | base64)

curl -s -X POST "http://localhost:8081/realms/order-processing/protocol/openid-connect/token" \
  -H "Authorization: Basic $BASE64" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&scope=default"
```

O retorno deve conter um `access_token` com `"scope": "default ..."`.

### 4.2 Verificar roles do service account

O service account `service-account-wso2-key-manager` precisa das roles `manage-clients`, `view-clients` e `query-clients` do client `realm-management`. Verifique via Admin API:

```bash
# Obter UUID do service account
SA_UUID=$(curl -s "http://localhost:8081/admin/realms/order-processing/users?username=service-account-wso2-key-manager" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')

# Listar roles atribuídas
RM_UUID=$(curl -s "http://localhost:8081/admin/realms/order-processing/clients?clientId=realm-management" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')

curl -s "http://localhost:8081/admin/realms/order-processing/users/$SA_UUID/role-mappings/clients/$RM_UUID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[].name'
```

Se as roles não aparecerem (`manage-clients`, `view-clients`, `query-clients`), atribua-as:

```bash
ROLES_JSON=$(curl -s "http://localhost:8081/admin/realms/order-processing/clients/$RM_UUID/roles" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | \
  jq '[.[] | select(.name == "manage-clients" or .name == "view-clients" or .name == "query-clients")]')

curl -s -X POST "http://localhost:8081/admin/realms/order-processing/users/$SA_UUID/role-mappings/clients/$RM_UUID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$ROLES_JSON"
```

### 4.3 Adicionar protocol mapper para roles do `realm-management`

Para que o token do `wso2-key-manager` (ou `wso2-key-manager-dedicated`, dependendo do nome que você usou) inclua as roles do client `realm-management` (necessárias para a DCR/Admin API), adicione um protocol mapper ao client:

1. No Keycloak Admin UI, ainda no realm **order-processing**, acesse **Clients** → **Client details** → clique no client `wso2-key-manager` (ou `wso2-key-manager-dedicated`).  
2. Vá até a aba **Mappers** (ou **Client scopes**, dependendo da versão da UI).  
3. Clique em **Add mapper** → **By configuration** (ou equivalente na sua UI). Na tabela **Configure a new mapper**, escolha a opção **User Client Role** (que é o `oidc-usermodel-client-role-mapper`) e então preencha:
   - **Name**: `realm-management-roles`  
   - **Client ID** (ou `usermodel.clientRoleMapping.clientId`): `realm-management`  
   - **Token Claim Name** / `claim.name`: `resource_access.realm-management.roles`  
4. Marque para **incluir no Access Token** (e no ID Token apenas se desejar).  
5. Salve o mapper.

> Sem esse mapper, o token de `wso2-key-manager` não carrega as roles `manage-clients`, `view-clients` e `query-clients` do `realm-management`, e a DCR API retorna `insufficient_scope`.

### 4.4 Configurar o Key Manager no Admin Portal

1. Acesse: **https://localhost:9443/admin**
2. Login: `admin` / `admin`
3. **Key Managers** → **Add Key Manager**
4. Preencha os campos:

| Seção / Campo               | Valor                                                                                              |
|-----------------------------|----------------------------------------------------------------------------------------------------|
| **Basic Info**              |                                                                                                    |
| Name                        | `Keycloak`                                                                                         |
| Display Name                | `Keycloak`                                                                                         |
| Key Manager Type            | **`Keycloak`**                                                                                     |
| Description                 | `Keycloak realm order-processing` (opcional)                                                       |
| **Key Manager Endpoints**   |                                                                                                    |
| Well-known URL              | `http://keycloak:8080/realms/order-processing/.well-known/openid-configuration`                   |
| Issuer                      | `http://localhost:8081/realms/order-processing`                                                    |
| Client Registration Endpoint| (preenchido automaticamente; manter)                                                               |
| Introspection Endpoint      | (preenchido automaticamente; manter)                                                               |
| Token Endpoint              | (preenchido automaticamente; manter)                                                               |
| Revoke Endpoint             | (opcional; manter o sugerido ou em branco)                                                         |
| Userinfo Endpoint           | (preenchido automaticamente; manter)                                                               |
| Authorize Endpoint          | (preenchido automaticamente; manter)                                                               |
| Scope Management Endpoint   | `http://keycloak:8080/realms/order-processing/protocol/openid-connect/token` *(campo obrigatório na UI; Keycloak não expõe este endpoint — use o token endpoint para satisfazer a validação)* |
| **Connector Configurations**|                                                                                                    |
| Client ID                   | `wso2-key-manager`                                                                                 |
| Client Secret               | `wso2-key-manager-secret-change-in-production`                                                    |
| Consumer Key Claim URI      | `azp`                                                                                              |
| Scopes Claim URI            | `roles`                                                                                            |
| **Certificates**            |                                                                                                    |
| JWKS Endpoint               | `http://keycloak:8080/realms/order-processing/protocol/openid-connect/certs`                      |
| PEM Certificate             | deixar em branco (usamos JWKS)                                                                     |
| **Key Manager Permission**  |                                                                                                    |
| Mode                        | `Allow for roles`                                                                                  |
| Roles                       | `admin`                                                                                            |
| **Advanced Configurations** |                                                                                                    |
| Token Generation            | ON                                                                                                 |
| Out Of Band Provisioning    | **ON**                                                                                             |
| OAuth App Creation          | **OFF**                                                                                            |
| Token Validation Method     | `Self Validate JWT`                                                                                |
| Token Handling Options      | `JWT`                                                                                              |

> **Por que OAuth App Creation = OFF e Out Of Band Provisioning = ON?**  
> Com essas opções, o WSO2 não tenta criar clientes OAuth dinamicamente no Keycloak. O client `order-processing-api` já existe no Keycloak e é referenciado via "Provide Existing OAuth Keys".

### Key Manager Permission — Opções

| Opção | Comportamento |
|-------|---------------|
| **Public** | Qualquer usuário do Admin Portal pode gerenciar |
| **Allow for roles** | Apenas as roles listadas podem gerenciar *(recomendado: `admin`)* |
| **Deny for roles** | Todos podem, exceto as roles listadas |

---

## 5. Publicar API e Proteger Rotas no WSO2

### 5.1 Acessar o Publisher

1. Acesse: **https://localhost:9443/publisher**
2. Login: `admin` / `admin`
3. Clique em **Create API**

### 5.2 Opção A — Importar o OpenAPI (recomendado)

1. Selecione **Import Open API**
2. Faça upload de `src/main/resources/openapi.yaml` ou informe a URL:
   `http://host.docker.internal:8080/api/v3/api-docs`
3. O WSO2 preenche automaticamente os campos principais; revise conforme abaixo

### 5.3 Opção B — Criar manualmente

| Campo        | Valor                                  | Explicação                                                                                  |
|--------------|----------------------------------------|---------------------------------------------------------------------------------------------|
| **Name**     | `OrderProcessingAPI`                   | Identificador da API no WSO2, sem espaços                                                   |
| **Context**  | `/order-processing`                    | Prefixo de rota no Gateway. **Deve ser único no WSO2.**                                    |
| **Version**  | `1.0.0`                                | Versão da API; compõe a URL final: `/order-processing/1.0.0/...`                            |
| **Endpoint** | `http://host.docker.internal:8080/api` | URL base do backend (Spring Boot). O WSO2 faz proxy das chamadas para esse endereço.       |

> **Por que `host.docker.internal`?**  
> O WSO2 roda dentro do Docker e precisa de um endereço que aponte para o host onde o Spring Boot está rodando.  
> Se o Spring Boot também estiver em container na mesma rede, use o nome do serviço (ex.: `http://app:8080/api`).

### 5.4 Cadastrar os Scopes na API

Em **Scopes** (menu lateral da API), cadastre os scopes:

| Scope Name        | Display Name    | Description                      |
|-------------------|-----------------|----------------------------------|
| `customers:read`  | Customers Read  | Leitura de clientes              |
| `customers:write` | Customers Write | Criação e edição de clientes     |
| `products:read`   | Products Read   | Leitura de produtos              |
| `products:write`  | Products Write  | Criação, edição e exclusão       |
| `orders:read`     | Orders Read     | Leitura de pedidos               |
| `orders:write`    | Orders Write    | Criação e atualização de pedidos |

### 5.5 Configurar Scopes por Recurso

Vá em **API Definition** → **Resources** e configure o scope de cada operação:

| Recurso                         | Método   | Scope exigido     |
|---------------------------------|----------|-------------------|
| `/customers`                    | `GET`    | `customers:read`  |
| `/customers`                    | `POST`   | `customers:write` |
| `/customers/{id}`               | `GET`    | `customers:read`  |
| `/products`                     | `GET`    | `products:read`   |
| `/products`                     | `POST`   | `products:write`  |
| `/products/{id}`                | `GET`    | `products:read`   |
| `/products/{id}`                | `PUT`    | `products:write`  |
| `/products/{id}`                | `DELETE` | `products:write`  |
| `/orders`                       | `GET`    | `orders:read`     |
| `/orders`                       | `POST`   | `orders:write`    |
| `/orders/{id}`                  | `GET`    | `orders:read`     |
| `/orders/customer/{customerId}` | `GET`    | `orders:read`     |
| `/orders/{id}/status`           | `PATCH`  | `orders:write`    |

### 5.6 Deploy no Gateway

1. Vá em **Deploy** (menu lateral da API)
2. Clique em **Deploy New Revision**
3. Em **API Gateways**, selecione o ambiente **Default** → clique em **Deploy**
4. Vá em **Lifecycle** → clique em **Publish**

A API estará disponível em:
- HTTPS: `https://localhost:8243/order-processing/1.0.0/`
- HTTP: `http://localhost:8280/order-processing/1.0.0/`

> **Se aparecer "No Gateway Environments Configured":**  
> O `config-wso2.toml` precisa ter a seção `[[apim.gateway.environment]]`. Reinicie o container após qualquer alteração:
> ```bash
> docker compose restart wso2am
> ```

---

## 6. Gerar OAuth Keys no Developer Portal

Acesse `https://localhost:9443/devportal`, crie uma aplicação e assine a API.

### 6.1 Gerar novas chaves

Vá em **Production Keys** → **Generate Keys**. O WSO2 criará um novo client no Keycloak via DCR automaticamente.

### 6.2 Fornecer chaves existentes (Provide Existing OAuth Keys)

Use esta opção se já tem um client criado no Keycloak:

| Campo           | Valor                                   |
|-----------------|-----------------------------------------|
| Consumer Key    | `order-processing-api`                  |
| Consumer Secret | `order-api-secret-change-in-production` |

> **Atenção**: NÃO use o client `wso2-key-manager` aqui. Esse client é reservado para uso interno do WSO2. O client correto para consumir a API é `order-processing-api`.

---

## 7. Obter Token e Testar

> **Pré-requisito**: adicione `127.0.0.1 keycloak` ao `/etc/hosts` (ver seção 1). Tokens devem ser gerados via `http://keycloak:8081/...` para que o `iss` coincida com o configurado no WSO2 (`http://keycloak:8080/...`).

```bash
# Obter token via Direct Grant (usuário/senha)
# Use http://keycloak:8081 (não localhost:8081) para que o iss fique keycloak:8080
curl -X POST "http://keycloak:8081/realms/order-processing/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=order-processing-api" \
  -d "client_secret=order-api-secret-change-in-production" \
  -d "username=SEU_USUARIO" \
  -d "password=SUA_SENHA" \
  -d "scope=openid"

# Chamar API via WSO2 gateway
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  https://localhost:8243/order-processing/1.0.0/customers -k
```

> As roles do usuário (`customers:read`, `products:read`, etc.) são incluídas no claim `roles` do JWT pelo protocol mapper `order-processing-scopes`. O WSO2 Key Manager está configurado com `Scopes Claim URI = roles` para ler esse claim.

---

## 8. SSO

O SSO está habilitado no realm. Após login em uma aplicação, a sessão é reutilizada em outras apps do mesmo realm.

| Parâmetro                  | Valor     |
|----------------------------|-----------|
| `ssoSessionIdleTimeout`    | 30 min    |
| `ssoSessionMaxLifespan`    | 10 h      |
| `accessTokenLifespan`      | 5 min     |

---

## 9. Proteção do Backend — Mediation Policy (Gateway Secret)

O backend valida que toda requisição veio pelo WSO2 checando o header `X-Gateway-Secret`.
Como o WSO2 não envia esse header por padrão, é preciso configurar uma **mediation policy** na API via Publisher.

### 9.1 Criar o arquivo de sequência

Crie localmente o arquivo `gateway-secret-in-sequence.xml`:

```xml
<sequence xmlns="http://ws.apache.org/ns/synapse" name="GatewaySecretInSequence">
    <header name="X-Gateway-Secret"
            value="change-this-in-production-use-env-var"
            scope="transport"/>
</sequence>
```

> O valor de `value` deve ser **idêntico** ao configurado em `wso2.gateway.validation.secret` no `application.yaml`.

### 9.2 Adicionar a mediation policy no Publisher

1. Acesse `https://localhost:9443/publisher`
2. Abra a API `order-processing`
3. No menu lateral clique em **Policies**
4. Selecione a aba **Request**
5. Arraste o componente **Add Header** da paleta para o fluxo, ou use a opção **Upload** de sequence
6. Configure:
   - **Header Name**: `X-Gateway-Secret`
   - **Header Value**: `change-this-in-production-use-env-var`
7. Clique em **Save** e depois **Deploy**

### 9.3 Usar variável de ambiente em produção

Nunca deixe o secret hardcoded. Use variável de ambiente no Spring Boot:

```bash
# Iniciar com variável de ambiente
GATEWAY_SECRET=meu-secret-seguro ./mvnw spring-boot:run

# Ou via docker / systemd
export GATEWAY_SECRET=meu-secret-seguro
```

```yaml
# application.yaml — referenciar a variável
wso2:
  gateway:
    validation:
      secret: ${GATEWAY_SECRET:change-this-in-production-use-env-var}
```

### 9.4 Desabilitar temporariamente (apenas dev)

```yaml
# application.yaml
wso2:
  gateway:
    validation:
      enabled: false
```

---

## Referências

- [WSO2 APIM — Configure Keycloak Key Manager](https://apim.docs.wso2.com/en/latest/administer/key-managers/configure-keycloak-connector/)
- [WSO2 APIM — Third-party Key Manager](https://apim.docs.wso2.com/en/latest/install-and-setup/setup/distributed-deployment/configure-a-third-party-key-manager/)
- [Keycloak — Service Account Roles](https://www.keycloak.org/docs/latest/server_admin/#_service_accounts)
- [Keycloak — Dynamic Client Registration](https://www.keycloak.org/docs/latest/securing_apps/#_client_registration)
