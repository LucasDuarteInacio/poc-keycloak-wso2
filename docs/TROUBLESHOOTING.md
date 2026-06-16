# Troubleshooting — Keycloak + WSO2 API Manager

> Erros identificados e resolvidos durante a integração Keycloak 25.0.4 + WSO2 APIM 4.5.0

---

## Índice

1. [invalid_scope — scope vazio (conector Auth0)](#1-invalid_scope--scope-vazio-conector-auth0)
2. [unauthorized_client — credenciais inválidas](#2-unauthorized_client--credenciais-inválidas)
3. [invalid_request — scope=default não reconhecido](#3-invalid_request--scopedefault-não-reconhecido)
4. [invalid_token — DCR API rejeita o token](#4-invalid_token--dcr-api-rejeita-o-token)
5. [insufficient_scope — roles ausentes no token](#5-insufficient_scope--roles-ausentes-no-token)
6. [401 via WSO2 — Issuer mismatch](#6-401-unauthorized-na-chamada-via-wso2--issuer-mismatch)
7. [403 via WSO2 — Duplicate scope claim](#7-403-forbidden-na-chamada-via-wso2--duplicate-scope-claim)
8. [No Gateway Environments Configured](#8-no-gateway-environments-configured)
9. [Fluxo de Diagnóstico](#9-fluxo-de-diagnóstico)
10. [`900908` — Subscription validation failed](#10-900908--subscription-validation-failed)
11. [Keycloak — HTTPS required (HTTP em dev)](#11-keycloak--https-required-http-em-dev)

---

## 1. `invalid_scope` — scope vazio (conector Auth0)

### Sintoma

**Log WSO2:**
```
feign.FeignException$BadRequest: [400 Bad Request]
{"error":"invalid_scope","error_description":"Invalid scopes: "}
```

**Log Keycloak:**
```
type=CLIENT_LOGIN_ERROR, error=invalid_request, grant_type=client_credentials
```

### Causa

O tipo `Auth0` no WSO2 Key Manager usa o conector `auth0.key.manager` internamente. Esse conector **sempre envia `scope=` (string vazia)** ao endpoint de token do Keycloak. O Keycloak rejeita `client_credentials` com scope vazio.

O campo `Audience` na UI do WSO2 **não resolve** o problema — ele vira o parâmetro `audience=` (padrão Auth0, não OAuth2 padrão), e o Keycloak não interpreta isso como `scope=`.

### Solução

Recriar o Key Manager usando o tipo **`Keycloak`** (não `Auth0`).

---

## 2. `unauthorized_client` — credenciais inválidas

### Sintoma

**Log WSO2:**
```
feign.FeignException$Unauthorized: [401 Unauthorized]
{"error":"unauthorized_client","error_description":"Invalid client or Invalid client credentials"}
```

**Log Keycloak:**
```
type=CLIENT_LOGIN_ERROR, error=invalid_client_credentials, userId=null
```

### Causa

O `userId=null` no log do Keycloak indica que o `clientId` informado **não existe** no realm, ou que a `clientSecret` está incorreta.

### Solução

Verificar os campos no Key Manager do WSO2:

| Campo         | Valor correto                                  |
|---------------|------------------------------------------------|
| Client ID     | `wso2-key-manager`                             |
| Client Secret | `wso2-key-manager-secret-change-in-production` |

> Se `userId=<uuid>` aparece no log (credenciais corretas), mas o erro persiste, o problema é outro — ver seção 1 ou 3.

---

## 3. `invalid_request` — `scope=default` não reconhecido

### Sintoma

**Log Keycloak (evento):**
```
type=CLIENT_LOGIN_ERROR, error=invalid_request, grant_type=client_credentials
```

**Teste direto confirma:**
```bash
curl -X POST "http://localhost:8081/realms/order-processing/protocol/openid-connect/token" \
  -H "Authorization: Basic <base64(wso2-key-manager:secret)>" \
  -d "grant_type=client_credentials&scope=default"

# Resposta:
{"error":"invalid_scope","error_description":"Invalid scopes: default"}
```

### Causa (raiz identificada)

A classe interna do WSO2 `org.wso2.carbon.apimgt.impl.recommendationmgt.AccessTokenGenerator` define:

```java
public static final String OAUTH2_DEFAULT_SCOPE = "default";

public String getAccessToken() {
    return getAccessToken(new String[]{APIConstants.OAUTH2_DEFAULT_SCOPE});
    // sempre envia scope=default
}
```

Essa classe é usada pelo conector Keycloak (`keycloak.key.manager_2.1.1.jar`) para obter o token de gerenciamento antes de cada chamada à DCR API. O scope `default` não existia vinculado ao client `wso2-key-manager` no Keycloak.

### Solução

Criar (se não existir) e vincular o client scope `default` ao `wso2-key-manager`:

```bash
# 1. Obter token admin
ADMIN_TOKEN=$(curl -s -X POST "http://localhost:8081/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=admin-cli&username=admin&password=admin" \
  | jq -r '.access_token')

# 2. Criar o scope (ignora erro se já existir)
curl -s -X POST "http://localhost:8081/admin/realms/order-processing/client-scopes" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "default",
    "description": "Scope padrão exigido pelo WSO2 AccessTokenGenerator",
    "protocol": "openid-connect",
    "attributes": {
      "include.in.token.scope": "true",
      "display.on.consent.screen": "false"
    }
  }'

# 3. Pegar IDs
SCOPE_ID=$(curl -s "http://localhost:8081/admin/realms/order-processing/client-scopes" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[] | select(.name=="default") | .id')

CLIENT_ID=$(curl -s "http://localhost:8081/admin/realms/order-processing/clients?clientId=wso2-key-manager" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')

# 4. Vincular
curl -s -X PUT "http://localhost:8081/admin/realms/order-processing/clients/$CLIENT_ID/default-client-scopes/$SCOPE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 5. Verificar
BASE64=$(echo -n "wso2-key-manager:wso2-key-manager-secret-change-in-production" | base64)
curl -s -X POST "http://localhost:8081/realms/order-processing/protocol/openid-connect/token" \
  -H "Authorization: Basic $BASE64" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&scope=default"
# Esperado: retorna access_token com "scope": "default ..."
```

---

## 4. `invalid_token` — DCR API rejeita o token

### Sintoma

**Log WSO2:**
```
feign.FeignException$Unauthorized: [401 Unauthorized]
during [GET] to [http://keycloak:8080/realms/order-processing/clients-registrations/openid-connect/wso2-key-manager]
[DCRClient#getApplication(String)]: [{"error":"invalid_token","error_description":"Failed decode token"}]
```

**Log Keycloak:**
```
type=CLIENT_INFO_ERROR, clientId=null, error=invalid_token, reason='Failed decode token'
```

### Causa

Duas causas possíveis:

**A) Consumer Key errado**: o usuário passou `wso2-key-manager` como Consumer Key no "Provide Existing OAuth Keys". Esse client é interno do WSO2. O WSO2 tenta chamar a DCR API com a URL `.../clients-registrations/openid-connect/wso2-key-manager`, mas esse client não tem Registration Access Token (RAT).

**B) Consumer Key correto (`order-processing-api`), mas sem RAT**: a DCR API do Keycloak (`/clients-registrations/openid-connect/{clientId}`) exige um Registration Access Token emitido **no momento da criação via DCR**. Clients criados manualmente no Admin UI **nunca possuem RAT**.

### Solução

- **Consumer Key**: sempre usar `order-processing-api` (nunca `wso2-key-manager`) em "Provide Existing OAuth Keys"
- Com `OAuth App Creation = OFF` + `Out Of Band Provisioning = ON`, o WSO2 não faz chamada à DCR API para clientes pré-provisionados
- Garantir que essas opções estão **ativas** no Key Manager

---

## 5. `insufficient_scope` — roles ausentes no token

### Sintoma

**Log WSO2:**
```
feign.FeignException$Forbidden: [403 Forbidden]
{"error":"insufficient_scope","error_description":"Forbidden"}
```

**Log Keycloak (DCR API):**
```
type=CLIENT_INFO_ERROR, error=insufficient_scope
```

### Causa

O token de gerenciamento obtido pelo WSO2 não contém as roles `manage-clients` / `view-clients` / `query-clients` do client `realm-management` no claim `resource_access`. A DCR API rejeita tokens sem essas roles.

Causas comuns:
1. Roles não atribuídas ao service account `service-account-wso2-key-manager`
2. Roles atribuídas, mas **não incluídas no token** (falta do protocol mapper)

### Solução

**Passo 1** — Atribuir as roles ao service account via Admin API:

```bash
ADMIN_TOKEN=$(curl -s -X POST "http://localhost:8081/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=admin-cli&username=admin&password=admin" | jq -r '.access_token')

SA_UUID=$(curl -s "http://localhost:8081/admin/realms/order-processing/users?username=service-account-wso2-key-manager" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')

RM_UUID=$(curl -s "http://localhost:8081/admin/realms/order-processing/clients?clientId=realm-management" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')

ROLES_JSON=$(curl -s "http://localhost:8081/admin/realms/order-processing/clients/$RM_UUID/roles" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | \
  jq '[.[] | select(.name == "manage-clients" or .name == "view-clients" or .name == "query-clients")]')

curl -s -X POST "http://localhost:8081/admin/realms/order-processing/users/$SA_UUID/role-mappings/clients/$RM_UUID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$ROLES_JSON"
```

> **Atenção**: em algumas versões, a UI (aba "Service Account Roles" → "Assign role") **não persiste as roles** corretamente. Sempre usar a Admin API acima.

**Passo 2** — Verificar o protocol mapper no client `wso2-key-manager`:

O client deve ter um mapper do tipo `oidc-usermodel-client-role-mapper` com esta configuração:

```json
{
  "name": "realm-management-roles",
  "protocol": "openid-connect",
  "protocolMapper": "oidc-usermodel-client-role-mapper",
  "config": {
    "multivalued": "true",
    "access.token.claim": "true",
    "claim.name": "resource_access.realm-management.roles",
    "usermodel.clientRoleMapping.clientId": "realm-management"
  }
}
```

Sem esse mapper, o claim `resource_access` não aparece no token mesmo que as roles estejam atribuídas.

**Verificar o token resultante:**

```bash
BASE64=$(echo -n "wso2-key-manager:wso2-key-manager-secret-change-in-production" | base64)

TOKEN=$(curl -s -X POST "http://localhost:8081/realms/order-processing/protocol/openid-connect/token" \
  -H "Authorization: Basic $BASE64" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&scope=default" | jq -r '.access_token')

# Decodificar e verificar resource_access
echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq '.resource_access'
```

Esperado:
```json
{
  "realm-management": {
    "roles": ["view-clients", "manage-clients", "query-clients"]
  }
}
```

---

## 6. `401 Unauthorized` na chamada via WSO2 — Issuer Mismatch

### Sintoma

```bash
curl -H "Authorization: Bearer <TOKEN>" https://localhost:8243/order-processing/1.0.0/customers -k
# HTTP 401
```

**Log WSO2:**
```
JWT token validation failure: invalid issuer
```

### Causa

O WSO2 valida o campo `iss` do JWT contra o Issuer configurado no Key Manager. Se você gerar tokens por uma URL diferente da que está configurada no Issuer, o valor de `iss` não vai bater e o Gateway retorna 401.

### Solução

- No Key Manager do WSO2, configurar o campo **Issuer** como `http://localhost:8081/realms/order-processing`
- Sempre gerar tokens via `http://localhost:8081/realms/order-processing/protocol/openid-connect/token`

Exemplo:

```bash
curl -X POST "http://localhost:8081/realms/order-processing/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=order-processing-api&..."
```

---

## 7. `403 Forbidden` na chamada via WSO2 — Duplicate `scope` claim

### Sintoma

```bash
curl -H "Authorization: Bearer <TOKEN>" https://localhost:8243/order-processing/1.0.0/customers -k
# HTTP 403 — "Scope validation failed"
```

### Causa

O JWT contém a chave `scope` duplicada:

```json
"scope": "openid order-processing-scopes",   // string OIDC padrão
"scope": ["orders:read", "customers:read", ...]  // array do nosso mapper
```

JSON com chaves duplicadas é inválido. Dependendo do parser, o WSO2 pode ler apenas o primeiro valor (`"openid order-processing-scopes"`), que não contém `customers:read`. Como o recurso exige esse scope, retorna 403.

### Causa raiz

O protocol mapper `realm-roles-to-scope` no client scope `order-processing-scopes` estava configurado com `claim.name = "scope"`, colidindo com o claim OIDC padrão `scope` que o Keycloak gera automaticamente.

### Solução

**Passo 1** — Alterar `claim.name` do mapper de `scope` para `roles` no realm JSON:

```json
{
  "name": "realm-roles-to-scope",
  "config": {
    "claim.name": "roles"
  }
}
```

**Passo 2** — Atualizar `Scopes Claim URI` no WSO2 Key Manager de `scope` para `roles`.

O token passa a ter:
```json
"scope": "openid order-processing-scopes",   // apenas o padrão OIDC (string)
"roles": ["customers:read", "orders:read", ...]  // nosso claim sem colisão
```

O WSO2 lê o claim `roles` para validar autorização por scope.

---

## 8. No Gateway Environments Configured

### Sintoma

Ao tentar fazer deploy da API no WSO2 Publisher, aparece a mensagem:
```
No Gateway Environments Configured
```

### Causa

O `config-wso2.toml` (deployment.toml) não possui a seção `[[apim.gateway.environment]]` configurada, ou o WSO2 foi iniciado antes dessa configuração ser adicionada.

### Solução

Verificar se `config-wso2.toml` contém:

```toml
[[apim.gateway.environment]]
name = "Default"
type = "hybrid"
display_in_api_console = true
description = "Default Gateway Environment"
show_as_token_endpoint_url = true
service_url = "https://localhost:${mgt.transport.https.port}/services/"
ws_endpoint = "ws://localhost:9099"
wss_endpoint = "wss://localhost:8099"
http_endpoint = "http://localhost:${http.nio.port}"
https_endpoint = "https://localhost:${https.nio.port}"
```

Reiniciar o container após qualquer alteração:

```bash
docker compose restart wso2am
```

---

## 9. Fluxo de Diagnóstico

```
Erro ao GERAR OAuth Keys no WSO2 (Key Manager)
          │
          ├─► Log Keycloak: userId=null?
          │       └─► SIM → Client ID ou Secret incorretos no Key Manager
          │                  Verificar: clientId=wso2-key-manager, secret correto
          │
          ├─► Log WSO2: invalid_scope + "Invalid scopes: " (vazio)?
          │       └─► SIM → Tipo Auth0 selecionado — envia scope="" por design
          │                  Recriar Key Manager com tipo Keycloak
          │
          ├─► Log Keycloak: invalid_request + grant_type=client_credentials?
          │       └─► SIM → AccessTokenGenerator envia scope=default
          │                  Vincular client scope "default" ao wso2-key-manager
          │                  (ver seção 3)
          │
          ├─► Log WSO2: invalid_token + clients-registrations/openid-connect/?
          │       └─► SIM → Consumer Key errado (wso2-key-manager ao invés de order-processing-api)
          │                  OU client criado manualmente (sem RAT)
          │                  Usar order-processing-api + OAuth App Creation=OFF + Out Of Band=ON
          │
          └─► Log WSO2: insufficient_scope + Forbidden?
                  └─► SIM → Roles manage-clients/view-clients/query-clients ausentes no token
                             Atribuir roles via Admin API + verificar protocol mapper
                             (ver seção 5)

Erro ao CHAMAR a API via WSO2 Gateway
          │
          ├─► HTTP 401?
          │       └─► Verificar iss do token: decode o JWT e checar o campo "iss"
          │           ├─► iss diferente do Issuer configurado no Key Manager? → Issuer mismatch
          │           │       Padronizar Issuer para http://localhost:8081/realms/order-processing
          │           │       + gerar tokens sempre via http://localhost:8081
          │           │       (ver seção 6)
          │           └─► iss correto mas ainda 401? → Token expirado ou API não publicada
          │
          └─► HTTP 403?
                  ├─► Corpo JSON code 900908 + "API Subscription validation failed"?
                  │       └─► Consumer Key do JWT (azp) sem subscrição na API
                  │           → Login pelo portal (order-processing-api) ou inscrever o client do módulo no WSO2
                  │           (ver seção 10)
                  └─► Caso contrário: verificar claim "scope" no token: é string ou array?
                      ├─► scope duplicado (string + array)? → Duplicate claim
                      │       Renomear claim.name do mapper: scope → roles
                      │       + Scopes Claim URI no Key Manager: scope → roles
                      │       (ver seção 7)
                      └─► scope OK mas ainda 403? → Scope não configurado no recurso da API no Publisher
```

---

## 10. `900908` — Subscription validation failed

### Sintoma

Resposta JSON do gateway HTTP (ex.: 403):

```json
{
  "code": "900908",
  "message": "Resource forbidden",
  "description": "User is NOT authorized to access the Resource. API Subscription validation failed."
}
```

### Causa

O WSO2 associa o acesso à API à **subscrição** de uma aplicação no Developer Portal. O **Consumer Key** no JWT (claim **`azp`** com Keycloak) tem de corresponder a uma aplicação **inscrita** nessa API. A SPA usa o client **`order-processing-portal`** para portal e módulos (só mudam os **scopes** do token); a subscrição no Developer Portal deve usar esse **Consumer Key** (sem secret no fluxo público + PKCE) ou, em cenários de teste, **`order-processing-api`** conforme o guia.

### Solução

- **Frontend atual:** inscreva a API Order Processing numa aplicação cujo **Consumer Key** = **`order-processing-portal`** (Provide Existing OAuth Keys / client público no Keycloak). Assim, o token enxuto do módulo (`orders-module-scopes`, etc.) continua com **`azp`** = `order-processing-portal` e passa na validação de subscrição.
- Se ainda usa o modelo antigo com clients `*-module` no Keycloak, cada um precisa de aplicação + subscrição correspondente no WSO2, ou migre para o client único acima.

---

## 11. Keycloak — HTTPS required (HTTP em dev)

### Sintoma

Ao abrir **http://localhost:8081** (ou outro URL em **HTTP**), o Keycloak responde com **HTTPS required** / **We are sorry…** no fluxo de login (em especial na **Admin Console**, realm **`master`**).

### Causa

1. O realm tem **Require SSL** = **External requests** ou **All requests**. Pedidos feitos por **HTTP** a partir de um host que o Keycloak trata como “externo” (por exemplo **IP da LAN** em vez de `localhost`) são recusados. O realm **`master`** não vem do JSON do projeto — mantém o padrão até alterar na UI ou via API.
2. **Keycloak 25+ (imagem Docker)**: o pacote **`curl` foi removido** da imagem. O serviço **`keycloak-ssl-init`** antigo usava `curl` para esperar o servidor; o comando falhava e **`sslRequired=NONE` nunca era aplicado**. O compose atual usa **Admin CLI (`kcadm`)** em loop e **healthcheck** na porta de gestão **9000** (sem `curl`).

### Solução

1. Com o compose do projeto, suba os serviços e deixe o one-shot **`keycloak-ssl-init`** concluir com sucesso (`docker compose logs keycloak-ssl-init`). Só então abra **http://localhost:8081/admin/** (ou atualize a página). O Keycloak está configurado com **`KC_HOSTNAME` / `KC_HOSTNAME_ADMIN`** em `http://localhost:8081` — prefira esse URL em dev (em vez de `http://127.0.0.1:8081`) para coincidir com o hostname.
2. Use **http://localhost:8081** no browser (evite só o IP da máquina na rede, em dev).
3. **Realm settings** → **Login** → **Require SSL** → **`None`** no realm **`master`** e no **`order-processing`**.
4. **Base já criada:** o import `order-processing-realm.json` só aplica `sslRequired: none` em **novas** importações. Para corrigir sem UI, com o container no ar:

```bash
docker exec order_processing_keycloak bash -s < keycloak/scripts/disable-ssl-required-dev.sh
```

Ou veja o bloco equivalente em **docs/SETUP-KEYCLOAK-WSO2-SSO.md** § **1.1**.

---

## Referências

- [WSO2 APIM — Configure Keycloak Key Manager](https://apim.docs.wso2.com/en/latest/administer/key-managers/configure-keycloak-connector/)
- [Keycloak — Service Account Roles](https://www.keycloak.org/docs/latest/server_admin/#_service_accounts)
- [Keycloak — Dynamic Client Registration API](https://www.keycloak.org/docs/latest/securing_apps/#_client_registration)
- [WSO2 source — AccessTokenGenerator.java (v9.31.86)](https://github.com/wso2/carbon-apimgt/blob/v9.31.86/components/apimgt/org.wso2.carbon.apimgt.impl/src/main/java/org/wso2/carbon/apimgt/impl/recommendationmgt/AccessTokenGenerator.java)
