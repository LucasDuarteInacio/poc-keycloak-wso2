# Setup Keycloak + WSO2 — Order Processing Management

Este guia descreve a configuração completa da integração Keycloak + WSO2 API Manager.

## Visão Geral

- **Keycloak**: Identity Provider com realm `order-processing`, grupos `admin` e `user`, scopes das rotas; **opcionalmente** User Federation **LDAP** (Samba 4 AD de laboratório — **§ 10**)
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

> **URL do Keycloak no host:** use **http://localhost:8081** (mapeamento `8081:8080`). Textos que falam em porta **8080** referem-se ao **interior** do container.

### 1.1 Require SSL em HTTP (evitar “HTTPS required”)

Com **Require SSL** em **External requests** ou **All requests**, o login na **Admin Console** (realm **`master`**, URL **http://localhost:8081/admin/**) ou no realm da aplicação pode falhar com **HTTPS required** ao usar **HTTP**, sobretudo se abrir pelo **IP da LAN** (ex.: `http://192.168.x.x:8081`) em vez de **`localhost`**.

O `docker-compose.yml` inclui o serviço one-shot **`keycloak-ssl-init`**, que partilha a rede do Keycloak e, após o servidor responder, define **`sslRequired=NONE`** nos realms **`master`** e **`order-processing`** via Admin CLI (`kcadm`). Em **`docker compose up -d`**, aguarde ~30–60 s e confira os logs: `docker compose logs keycloak-ssl-init` deve terminar com `sslRequired=NONE aplicado`. Se abrir **/admin/** antes disso, faça refresh após o init terminar.

**Desenvolvimento local (ajuste manual, se precisar):**

1. Prefira **http://localhost:8081** no browser.
2. Realm **`master`**: **Realm settings** → **Login** → **Require SSL** → **`None`** → **Save**.
3. Realm **`order-processing`**: o mesmo (ou recrie o realm a partir do JSON importado, que já vem com `sslRequired: none`).

Se o realm **já existir** na base PostgreSQL, o ficheiro `keycloak/realm/order-processing-realm.json` **não** é reaplicado em cada `docker compose up`. Para forçar **sem abrir a UI**, com o container no ar:

```bash
docker exec order_processing_keycloak bash -c '
/opt/keycloak/bin/kcadm.sh config credentials --server http://127.0.0.1:8080 --realm master --user admin --password admin
/opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=NONE
/opt/keycloak/bin/kcadm.sh update realms/order-processing -s sslRequired=NONE 2>/dev/null || true
'
```

(Altere `admin`/`admin` se mudou `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` no compose.)

Equivalente: `docker exec order_processing_keycloak bash -s < keycloak/scripts/disable-ssl-required-dev.sh`

Em **produção** use HTTPS real e **Require SSL** adequado — não use **`None`** exposto à Internet.

---

## 2. Criar o realm, client scopes e clients

Faça login na Admin UI: **http://localhost:8081** → usuário `admin` / `admin` (ou o definido no compose). Tudo abaixo é feito **sem** importar JSON.

### 2.1 Criar o realm

1. No canto superior esquerdo, abra o seletor de realm → **Create realm**.
2. **Realm name**: `order-processing` → **Create**.

Ajustes recomendados em **Realm settings** (aba **General** / **Login** / **Sessions**/ **Tokens**):

| Opção | Valor sugerido |
|--------|----------------|
| **Require SSL** | **`None`** em dev com HTTP em `localhost` (ver **§ 1.1**). Em produção com HTTPS: **External requests** ou **All requests** |
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

> **SPA deste repositório:** há **um** client público (`order-processing-portal`, PKCE, sem secret no browser). Portal vs módulos usam **client scopes opcionais** e o parâmetro **`scope`** no `/auth` — não crie clients `orders-module` / `products-module` / `customers-module` a menos que queira o modelo antigo.

Em **Clients** → **Create client** para cada linha da tabela. A SPA é **public** (Client authentication = OFF); os demais são **confidential** (ON).

| Client ID | Uso | Client authentication | Service accounts | Full scope allowed | Redirect URIs (exemplo dev) | Web origins |
|-----------|-----|------------------------|------------------|--------------------|----------------------------|-------------|
| `wso2-key-manager` | WSO2 validar tokens / DCR | ON | **ON** | **ON** | `https://localhost:9443/*`, `https://localhost:8243/*` | `*` (ou restrinja em produção) |
| `order-processing-portal` | **Única SPA** — `scope` pede `portal-module-scopes` (portal) ou `*-module-scopes` (API por módulo) | **OFF** (public) | OFF | **OFF** | `http://localhost:4200/*`, `http://localhost:4200/callback` | `http://localhost:4200` |
| `order-processing-api` | Token completo (WSO2) + testes | ON | OFF | ON | `https://localhost:9443/*`, `https://localhost:8243/*`, `http://localhost:4200/*` | `*` |

**Secrets** (clients confidenciais): em **Credentials**, defina secrets fortes — **troque em produção**.

**PKCE**: para `order-processing-portal` (public) e `order-processing-api`, em **Advanced**, **Proof Key for Code Exchange Code Challenge Method** = `S256` quando disponível.

**Realm roles `mod:*`**: crie `mod:customers`, `mod:products`, `mod:orders` e atribua aos grupos conforme o acesso ao portal (ex.: grupo `user` com os três se pode abrir os três módulos). O frontend valida esses escopos nas telas do portal.

**Client scope `portal-module-scopes`**: crie um scope (protocol mappers → **User Realm Role**, claim `roles`, multivalued) e na aba **Scope** → **Realm roles** associe **apenas** `mod:customers`, `mod:products`, `mod:orders`. Sem isso o token do portal pode carregar todas as roles do realm.

**Client scopes (aba Client scopes do client)**:

- **`wso2-key-manager`** → **Default client scopes**: inclua `default`, `openid`, `roles`, `role_list`, `profile`, `email`, `order-processing-scopes` (adicione **Add client scope** → **Default** o que faltar).  
- **`order-processing-portal`**: **Default**: `default`, `role_list`, `profile`, `email`. **Optional**: `portal-module-scopes`, `orders-module-scopes`, `products-module-scopes`, `customers-module-scopes` (a SPA envia o nome do scope no parâmetro `scope` do authorize). Não use `order-processing-scopes` neste client.  
- **`order-processing-api`**: `role_list`, `profile`, `email`, `order-processing-scopes`.

**Protocol mapper no `wso2-key-manager`** (aba **Client scopes** do client → mappers do client ou **Mappers** direto no client, conforme versão): mapper **User Client Role** (`oidc-usermodel-client-role-mapper`):

- **Name**: `realm-management-roles`  
- **Client ID** / `usermodel.clientRoleMapping.clientId`: `realm-management`  
- **Token claim name**: `resource_access.realm-management.roles`  
- **Multivalued**: ON  
- Incluir no **Access token** (mínimo); ID/Userinfo opcional  

As **roles do service account** (`manage-clients`, `view-clients`, `query-clients` do client `realm-management`) costumam ser atribuídas de forma confiável via **Admin API** — ver **§ 4.2** deste guia.

### 2.7 Token enxuto — mapeamento de roles nos client scopes

Passo a passo só na Admin Console: **docs/KEYCLOAK-SCOPE-MAPPINGS-UI.md**.

Obrigatório para a SPA com **um** client: depois de criados os client scopes, associe **apenas** as realm roles indicadas (aba **Scope** → **Realm roles** de cada client scope):

| Client scope | Realm roles |
|--------------|-------------|
| `portal-module-scopes` | `mod:orders`, `mod:products`, `mod:customers` |
| `orders-module-scopes` | `orders:read`, `orders:write` |
| `products-module-scopes` | `products:read`, `products:write` |
| `customers-module-scopes` | `customers:read`, `customers:write` |

Sem isso, o mapper pode colocar **todas** as roles do usuário no JWT.

**Conferência do client `order-processing-portal`**: **Full scope allowed** = OFF; defaults mínimos + opcionais conforme § 2.6.

**Teste**: token com `scope` contendo `orders-module-scopes` — claim **`roles`** só com orders (conforme grupo); **`azp`** = `order-processing-portal`.

> **UI detalhada** (mesmo efeito): **docs/KEYCLOAK-SCOPE-MAPPINGS-UI.md**.

---

## 3. Criar Usuários e Atribuir Grupos (Keycloak)

1. Acesse: **http://localhost:8081** (Keycloak Admin UI)
2. Login: `admin` / `admin`
3. Selecione o realm **order-processing**
4. **Users** → **Add user** → crie usuários de teste **locais**, **ou** use usuários do **LDAP** após configurar a User Federation (**§ 10**)
5. Para cada usuário: aba **Groups** → **Join Group** → escolha `/user` ou `/admin` (necessário para as roles da API como scopes)

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

## 10. (Opcional) LDAP / Active Directory — Samba 4 no Docker

Esta seção é **opcional**: o fluxo Keycloak + WSO2 descrito nas seções anteriores **não** exige LDAP. Use apenas para simular **Active Directory** em laboratório e federar usuários no realm `order-processing`.

O `docker-compose.yml` define o serviço **`samba-ad`** (imagem **`nowsci/samba-domain`**, Samba 4 como DC com LDAP no estilo AD). Em **Apple Silicon**, a imagem usa `platform: linux/amd64` (emulação).

### 10.1 Subir o Samba AD

```bash
docker compose up -d samba-ad
```

- **Container**: `order_processing_samba_ad`  
- Na **primeira** execução o domínio é **provisionado**; aguarde o healthcheck (cerca de **1–2 minutos**).  

| Item | Valor |
|------|--------|
| Realm (DNS / Kerberos) | `LAB.ORDER.LOCAL` |
| NetBIOS (1.º label) | `LAB` |
| Base LDAP (`DOMAIN_DC`) | `dc=lab,dc=order,dc=local` |
| Senha do **Administrator** | `SAMBA_DOMAIN_PASSWORD` no host ou padrão do compose (`DOMAINPASS`, ex.: `LabAdmin!ChangeMe`) |

**Portas no host** (ferramentas LDAP fora da rede Docker):

| Host | Container |
|------|-----------|
| **1389** | LDAP 389 |
| **1636** | LDAPS 636 |

Na rede Docker, o Keycloak deve usar o hostname do serviço **`samba-ad`** e a porta **389**.

### 10.2 User Federation no Keycloak

**Pré-requisitos**: `samba-ad` saudável; Keycloak no ar (ex.: `docker compose up -d samba-ad postgres keycloak`).

1. Admin UI → realm **`order-processing`**.  
2. **User federation** → **Add provider** → **ldap**.  
3. **Vendor**: **Active Directory**. Campos principais:

| Campo | Valor |
|--------|--------|
| **Console display name** | Ex.: `Samba AD` |
| **Connection URL** | **`ldap://samba-ad:389`** (Keycloak no mesmo `docker compose`) |
| **Bind DN** | `CN=Administrator,CN=Users,DC=lab,DC=order,DC=local` |
| **Bind credential** | **Só a senha** do `Administrator` (a mesma de `DOMAINPASS` / `SAMBA_DOMAIN_PASSWORD`, ex.: `LabAdmin!ChangeMe`) |
| **Users DN** | `CN=Users,DC=lab,DC=order,DC=local` |
| **Username LDAP attribute** | `sAMAccountName` |
| **RDN LDAP attribute** | `cn` |
| **UUID LDAP attribute** | `objectGUID` |
| **User object classes** | `person, organizationalPerson, user` |

4. **Edit mode** recomendado: **`READ_ONLY`**.  
5. **Save** → **Test connection** → **Test authentication** (ver **§ 10.3** — utilize o **sAMAccountName**, ex.: `testuser`, **não** o `CN` LDAP).

**Synchronization settings** (mesma página do provedor LDAP): com **Import users** = **On**, o utilizador é criado no realm no **primeiro login** bem-sucedido; em muitas versões **não há** botão “Synchronize all users”. Para importação periódica em massa, pode ativar **Periodic full sync** temporariamente (defina o intervalo) ou confiar no primeiro login.

Se o Keycloak **não** correr no Docker na mesma rede, use **`ldap://localhost:1389`** como **Connection URL**.

> O compose define **`INSECURELDAP=true`** no Samba para **LDAP simples** na 389 (só laboratório). Em produção use **LDAPS**, certificados e conta de serviço com o mínimo de permissões.

### 10.3 Utilizador LDAP no Samba — criar, senha, DN e validação

#### Criar o utilizador

```bash
docker exec -it order_processing_samba_ad samba-tool user create testuser 'SenhaSegura123' \
  --given-name=Test --surname=User
```

- **`testuser`** é o **sAMAccountName** (login).  
- **`--given-name`** e **`--surname`** definem o **CN** da entrada em `CN=Users,...` (ver abaixo).

A opção **`--must-change-at-next-login`** do `samba-tool` é uma **flag** (sem `=false`); omita-a se não quiser forçar troca de senha.

#### Definir a palavra-passe de forma explícita (recomendado)

Para evitar **Invalid credentials** no LDAP / Keycloak quando a palavra-passe efetiva não coincide com a que usou em `user create`, defina-a de novo após criar o utilizador:

```bash
docker exec -it order_processing_samba_ad samba-tool user setpassword testuser --newpassword='SenhaSegura123'
```

Use **a mesma** palavra-passe no **Test authentication** do Keycloak, no login da **Account Console** e nos `ldapsearch` de teste abaixo.

#### `CN` da entrada LDAP ≠ login (`sAMAccountName`)

No Samba/AD o **RDN** costuma ser o **`cn`** = `givenName` + espaço + `surname` (ex.: **`Test User`**), **não** o nome de login.

| Onde | Valor (exemplo deste guia) |
|------|----------------------------|
| Login no Keycloak / **Test authentication** | `testuser` |
| DN da entrada | `CN=Test User,CN=Users,DC=lab,DC=order,DC=local` |
| Atributo | `sAMAccountName=testuser` |

Um bind LDAP com **`CN=testuser,CN=Users,...`** falha; o DN correto inclui **`CN=Test User,...`** (ou o `cn` que resultar dos nomes que passou ao `samba-tool`). No Keycloak, com **Username LDAP attribute** = `sAMAccountName` e **RDN LDAP attribute** = `cn`, o servidor procura por `testuser`, obtém a entrada e faz o bind com o DN real — **não** altere estes campos salvo saber o efeito.

#### Validar no Samba antes do Keycloak

**1.** Obter o DN com o `Administrator` (substitua a senha se alterou `DOMAINPASS`):

```bash
docker exec order_processing_samba_ad ldapsearch -x -H ldap://127.0.0.1 \
  -D "CN=Administrator,CN=Users,DC=lab,DC=order,DC=local" -w 'LabAdmin!ChangeMe' \
  -b "CN=Users,DC=lab,DC=order,DC=local" \
  "(sAMAccountName=testuser)" dn sAMAccountName
```

Copie o valor de **`dn:`** (ex.: `CN=Test User,CN=Users,DC=lab,DC=order,DC=local`).

**2.** Testar bind com esse DN e a palavra-passe do utilizador:

```bash
docker exec order_processing_samba_ad ldapsearch -x -H ldap://127.0.0.1 \
  -D "CN=Test User,CN=Users,DC=lab,DC=order,DC=local" \
  -w 'SenhaSegura123' \
  -b "CN=Users,DC=lab,DC=order,DC=local" "(sAMAccountName=testuser)"
```

O resultado deve terminar com **`result: 0 Success`**. Se aparecer **`Invalid credentials (49)`**, execute **`samba-tool user setpassword`** (passo acima) e repita.

**3.** (Opcional) Autenticação Winbind:

```bash
docker exec order_processing_samba_ad wbinfo -a 'LAB\testuser%SenhaSegura123'
```

#### Fazer o utilizador aparecer no Keycloak

Com **Import users** = **On** no provedor LDAP:

1. Garanta que **Test authentication** com `testuser` + senha **passa**.  
2. Abra **`http://localhost:8081/realms/order-processing/account`** → **Sign in** com **`testuser`** e a mesma senha.  
3. Na **Admin Console** → **Users**, o utilizador federado deve surgir na lista.

### 10.4 Grupos Keycloak e roles da API

Usuários vindos do LDAP **não** entram sozinhos nos grupos **`/user`** ou **`/admin`** nem recebem as realm roles usadas como scopes. O **primeiro login** é o primeiro **acesso autenticado ao Keycloak** com esse usuário (por exemplo login na **aplicação** via OIDC, **Account Console** do realm, ou *Resource Owner Password* de teste): o Keycloak cria ou sincroniza o usuário federado no realm `order-processing`. **Depois disso**, na **Admin Console** (como `admin`):

- **Users** → selecione o usuário federado → **Groups** → **Join Group** → `/user` ou `/admin`; ou  
- Configure um **mapper** LDAP → grupos (*group-ldap-mapper*) para mapear grupos do AD para grupos do Keycloak com as *role mappings* corretas.

A gestão do domínio Samba faz-se com **`samba-tool`** (não há console web AD incluída no projeto).

---

## Referências

- [WSO2 APIM — Configure Keycloak Key Manager](https://apim.docs.wso2.com/en/latest/administer/key-managers/configure-keycloak-connector/)
- [WSO2 APIM — Third-party Key Manager](https://apim.docs.wso2.com/en/latest/install-and-setup/setup/distributed-deployment/configure-a-third-party-key-manager/)
- [Keycloak — Service Account Roles](https://www.keycloak.org/docs/latest/server_admin/#_service_accounts)
- [Keycloak — Dynamic Client Registration](https://www.keycloak.org/docs/latest/securing_apps/#_client_registration)
