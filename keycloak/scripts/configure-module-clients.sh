#!/bin/bash
# Configura os scope mappings dos client scopes por módulo (alternativa à UI).
# Mesmo resultado que docs/SETUP-KEYCLOAK-WSO2-SSO.md § 2.7 (Keycloak Admin → Client scopes → Scope → Realm roles).
#
# Execute APÓS o realm estar criado (UI ou import):
#   docker compose up -d && sleep 20 && bash keycloak/scripts/configure-module-clients.sh
#
# Requer: curl, jq

set -e

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8081}"
REALM="${REALM:-order-processing}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin}"

echo ">>> Obtendo token admin..."
ADMIN_TOKEN=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=admin-cli&username=${ADMIN_USER}&password=${ADMIN_PASS}" | jq -r '.access_token')

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
  echo "ERRO: Não foi possível obter token admin."
  exit 1
fi

echo ">>> Obtendo IDs dos realm roles..."
get_role_id() {
  curl -s "${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${1}" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" | jq -r '.id'
}

ORDERS_READ=$(get_role_id "orders:read")
ORDERS_WRITE=$(get_role_id "orders:write")
PRODUCTS_READ=$(get_role_id "products:read")
PRODUCTS_WRITE=$(get_role_id "products:write")
CUSTOMERS_READ=$(get_role_id "customers:read")
CUSTOMERS_WRITE=$(get_role_id "customers:write")

echo ">>> Obtendo IDs dos client scopes..."
get_scope_id() {
  curl -s "${KEYCLOAK_URL}/admin/realms/${REALM}/client-scopes" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" | jq -r ".[] | select(.name==\"$1\") | .id"
}

ORDERS_SCOPE=$(get_scope_id "orders-module-scopes")
PRODUCTS_SCOPE=$(get_scope_id "products-module-scopes")
CUSTOMERS_SCOPE=$(get_scope_id "customers-module-scopes")

add_scope_mapping_to_scope() {
  local SCOPE_ID=$1
  shift
  local ROLES=("$@")
  local BODY="["
  for i in "${!ROLES[@]}"; do
    [ $i -gt 0 ] && BODY+=","
    BODY+="{\"id\":\"${ROLES[$i]}\"}"
  done
  BODY+="]"
  curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM}/client-scopes/${SCOPE_ID}/scope-mappings/realm" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$BODY"
}

echo ">>> Adicionando scope mappings em orders-module-scopes..."
add_scope_mapping_to_scope "$ORDERS_SCOPE" "$ORDERS_READ" "$ORDERS_WRITE"

echo ">>> Adicionando scope mappings em products-module-scopes..."
add_scope_mapping_to_scope "$PRODUCTS_SCOPE" "$PRODUCTS_READ" "$PRODUCTS_WRITE"

echo ">>> Adicionando scope mappings em customers-module-scopes..."
add_scope_mapping_to_scope "$CUSTOMERS_SCOPE" "$CUSTOMERS_READ" "$CUSTOMERS_WRITE"

MOD_ORDERS=$(get_role_id "mod:orders")
MOD_PRODUCTS=$(get_role_id "mod:products")
MOD_CUSTOMERS=$(get_role_id "mod:customers")
PORTAL_SCOPE=$(get_scope_id "portal-module-scopes")
if [ -n "$PORTAL_SCOPE" ] && [ "$PORTAL_SCOPE" != "null" ]; then
  echo ">>> Adicionando scope mappings em portal-module-scopes (mod:*)..."
  add_scope_mapping_to_scope "$PORTAL_SCOPE" "$MOD_ORDERS" "$MOD_PRODUCTS" "$MOD_CUSTOMERS"
fi

echo ">>> Concluído. O client SPA único pede estes scopes via parâmetro scope; cada client scope limita as roles no token."
