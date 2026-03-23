#!/usr/bin/env bash
# Define sslRequired=NONE nos realms master e order-processing (HTTP em dev).
# Executar no host: docker exec order_processing_keycloak /bin/bash -s < keycloak/scripts/disable-ssl-required-dev.sh
# Requer Keycloak em execução e credenciais de admin (variáveis ou padrão admin/admin).
set -euo pipefail

KC_ADM="/opt/keycloak/bin/kcadm.sh"
SERVER="${KCADM_SERVER:-http://127.0.0.1:8080}"
USER="${KEYCLOAK_ADMIN:-admin}"
PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

"$KC_ADM" config credentials --server "$SERVER" --realm master --user "$USER" --password "$PASS"
"$KC_ADM" update realms/master -s sslRequired=NONE
if "$KC_ADM" get realms/order-processing >/dev/null 2>&1; then
  "$KC_ADM" update realms/order-processing -s sslRequired=NONE
fi
echo "OK: sslRequired=NONE em master (e order-processing se existir)."
