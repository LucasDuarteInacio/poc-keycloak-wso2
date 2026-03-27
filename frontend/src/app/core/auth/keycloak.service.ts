/**
 * @file Autenticação OIDC da SPA com Keycloak (PKCE).
 *
 * ## Leitura obrigatória para quem mantém este ficheiro
 * - Conceitos: **OAuth2/OIDC**, **access token** (JWT), **refresh token**, **PKCE** (login seguro sem client secret no browser).
 * - Documentação de negócio e Keycloak neste repo: `docs/MEMORY-BANK.md` e `docs/SETUP-KEYCLOAK-WSO2-SSO.md`.
 * - Configuração usada aqui: `environment.keycloak` (URL, realm, `clientId`, `moduleClients`, `portalOAuthScopes`).
 *
 * ## Ideia principal (uma frase)
 * Existe **um** client OAuth no frontend (`order-processing-portal`). O que muda entre **portal** e **módulo** (Pedidos, etc.)
 * são os *client scopes* pedidos no login — o JWT fica com claims diferentes (ex.: `mod:*` no portal vs `orders:read` no módulo).
 *
 * ## Onde o estado Vive
 * | O quê | Onde |
 * |-------|------|
 * | Token **ativo** (o que o interceptor HTTP usa) | `localStorage` chaves `kc_access_token`, `kc_refresh_token`, … |
 * | “Estou no portal ou em que módulo?” | `kc_session_context` → `'full'` = portal, ou chave tipo `'orders'` |
 * | Cópia dos tokens **por contexto** (para voltar ao portal sem perder o JWT do portal) | `kc_ctx_<contexto>_*` |
 * | Nome/email (sem roles) vindo do endpoint **userinfo** | `kc_userinfo_cache` (evita chamadas repetidas) |
 * | Roles já calculadas para aquele access token + contexto | `kc_ctx_<contexto>_roles_sig` + `_roles_json` |
 * | Dados só durante o redirect OAuth | `sessionStorage` (`code_verifier`, `pending_module`, `return_to`) |
 *
 * ## Fluxo resumido
 * 1. `login()` ou `loginForModule()` → redirect ao Keycloak (PKCE).
 * 2. Keycloak devolve à rota `/callback` → `handleCallback(code)` troca o código por tokens → `storeTokens` + `applyToken`.
 * 3. `init()` no arranque da app: se o access token ainda é válido, reaplica perfil sem novo login.
 * 4. Token expirado → `refreshToken()` (pedidos em paralelo são deduplicados com `refreshInFlight`).
 * 5. Operações que alteram tokens passam por `runTokenMutation()` para **não correrem em paralelo** (evita race com o guard e o interceptor).
 *
 * ## Antes de alterar
 * - Não chamar `userinfo` “por desconfiar”: já há cache; roles vêm do **JWT**, não do userinfo.
 * - Se mudar chaves de `localStorage`, trate migração ou utilizadores ficam com sessão inconsistente.
 * - Guards e interceptor dependem desta API pública — ver `auth.guard.ts`, `role.guard.ts`, `auth.interceptor.ts`.
 */
import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface UserProfile {
  sub: string;
  preferred_username: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  roles: string[];
  /** Client que emitiu o token (azp) - identifica o módulo ativo */
  clientId?: string;
}

export interface HandleCallbackResult {
  success: boolean;
  returnTo?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
}

/** Perfil OIDC persistido após userinfo — sem roles (roles vêm só dos JWT por contexto). */
interface CachedUserInfo {
  sub: string;
  preferred_username?: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
}

type SyncedSessionField =
  | 'accessToken'
  | 'refreshToken'
  | 'expiresAt'
  | 'idToken'
  | 'clientId'
  | 'sessionContext';

const SYNCED_SESSION_FIELDS: SyncedSessionField[] = [
  'accessToken',
  'refreshToken',
  'expiresAt',
  'idToken',
  'clientId',
  'sessionContext',
];

/** Decodifica o payload (parte do meio) de um JWT. Não valida assinatura — só leitura de claims no cliente. */
function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/**
 * Junta tudo o que o Keycloak costuma usar como “permissões” no token: claim `roles`, `scope`, `realm_access`, `resource_access`.
 * A app trata strings com `:` como escopos tipo `orders:read`.
 */
function extractRolesFromPayload(payload: Record<string, unknown>): string[] {
  const roles: string[] = [];

  const pushScopeLikeTokens = (raw: string): void => {
    raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes(':'))
      .forEach((s) => roles.push(s));
  };

  const ingestRolesClaim = (value: unknown): void => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') pushScopeLikeTokens(item);
      }
      return;
    }
    if (typeof value === 'string') {
      const t = value.trim();
      if (t.startsWith('[')) {
        try {
          const parsed = JSON.parse(t) as unknown;
          if (Array.isArray(parsed)) {
            ingestRolesClaim(parsed);
            return;
          }
        } catch {
          /* claim não é JSON */
        }
      }
      pushScopeLikeTokens(t);
    }
  };

  ingestRolesClaim(payload['roles']);

  if (typeof payload['scope'] === 'string') {
    pushScopeLikeTokens(payload['scope']);
  }

  const realmAccess = payload['realm_access'] as { roles?: string[] } | undefined;
  if (realmAccess?.roles?.length) {
    roles.push(...realmAccess.roles);
  }

  const resourceAccess = payload['resource_access'] as
    | Record<string, { roles?: string[] }>
    | undefined;
  if (resourceAccess) {
    for (const v of Object.values(resourceAccess)) {
      if (v?.roles?.length) roles.push(...v.roles);
    }
  }

  return [...new Set(roles)];
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sha256Base64Url(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function cachedUserInfoFromUserinfoPayload(data: Record<string, unknown>): CachedUserInfo {
  return {
    sub: data['sub'] as string,
    preferred_username: data['preferred_username'] as string | undefined,
    name: data['name'] as string | undefined,
    email: data['email'] as string | undefined,
    email_verified: data['email_verified'] as boolean | undefined,
    given_name: data['given_name'] as string | undefined,
    family_name: data['family_name'] as string | undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class KeycloakService {
  private readonly storageKeys = {
    accessToken: 'kc_access_token',
    refreshToken: 'kc_refresh_token',
    codeVerifier: 'kc_code_verifier',
    expiresAt: 'kc_expires_at',
    idToken: 'kc_id_token',
    clientId: 'kc_client_id',
    sessionContext: 'kc_session_context',
    pendingModule: 'kc_pending_module',
    returnTo: 'kc_return_to',
  };

  private readonly userInfoCacheKey = 'kc_userinfo_cache';

  private readonly legacyApiStorageKeys = [
    'kc_api_access_token',
    'kc_api_refresh_token',
    'kc_api_expires_at',
  ];

  /** Chaves antigas do backup único — removidas no init para migração. */
  private readonly legacyPortalBackupKeys = [
    'kc_portal_backup_access',
    'kc_portal_backup_refresh',
    'kc_portal_backup_expires',
    'kc_portal_backup_id',
    'kc_portal_backup_client',
    'kc_portal_backup_session_context',
  ];

  /** `true` quando há sessão considerada válida após `applyToken`. Usado pelos guards (ex.: `isAuthenticated()`). */
  readonly isAuthenticated = signal<boolean>(false);
  /** Dados do utilizador + `roles` derivadas do JWT do contexto atual. */
  readonly userProfile = signal<UserProfile | null>(null);

  /**
   * Fila interna: refresh, callback, restore do portal e `init` executam em **série**.
   * Motivo: se dois fluxos atualizarem tokens ao mesmo tempo, o `roleGuard` pode ler estado velho.
   */
  private tokenMutationChain: Promise<unknown> = Promise.resolve();
  /** Evita disparar vários refresh em paralelo quando várias chamadas HTTP expiram ao mesmo tempo. */
  private refreshInFlight: Promise<boolean> | null = null;
  /** Cache em memória das roles do access token atual (evita reler localStorage/JWT a cada `hasRole`). */
  private effectiveRolesCache: { accessToken: string; roles: string[] } | null = null;

  private get keycloakBaseUrl(): string {
    const { url, realm } = environment.keycloak;
    return `${url}/realms/${realm}/protocol/openid-connect`;
  }

  private get redirectUri(): string {
    return `${window.location.origin}/callback`;
  }

  private get spaClientId(): string {
    return environment.keycloak.clientId;
  }

  /**
   * Enfileira uma operação assíncrona que mexe em tokens/perfil. Sempre usar para `applyToken`, refresh e restore.
   * @returns A Promise do trabalho enfileirado (para o chamador poder await).
   */
  private runTokenMutation<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tokenMutationChain.then(fn);
    this.tokenMutationChain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  private invalidateRoleResolutionCache(): void {
    this.effectiveRolesCache = null;
  }

  private getSessionContext(): string {
    return localStorage.getItem(this.storageKeys.sessionContext) ?? 'full';
  }

  private contextIdForStorage(ctx: string): string {
    return ctx === 'full' ? 'full' : ctx;
  }

  /** Monta o nome da chave `localStorage` do slot (ex.: `kc_ctx_orders_accessToken`). */
  private contextSlotKey(contextId: string, field: SyncedSessionField): string {
    return `kc_ctx_${this.contextIdForStorage(contextId)}_${field}`;
  }

  private allContextIds(): string[] {
    return ['full', ...Object.keys(environment.keycloak.moduleClients ?? {})];
  }

  /** Copia as chaves ativas (`kc_access_token`, …) para o slot do contexto indicado (backup por módulo/portal). */
  private copyMainToContextSlot(contextId: string): void {
    const id = this.contextIdForStorage(contextId);
    for (const f of SYNCED_SESSION_FIELDS) {
      const v = localStorage.getItem(this.storageKeys[f]);
      const slot = this.contextSlotKey(id, f);
      if (v !== null) localStorage.setItem(slot, v);
      else localStorage.removeItem(slot);
    }
  }

  /** Restaura a sessão ativa a partir de um slot (usado ao voltar ao portal com `full`). */
  private copyContextSlotToMain(contextId: string): void {
    const id = this.contextIdForStorage(contextId);
    for (const f of SYNCED_SESSION_FIELDS) {
      const v = localStorage.getItem(this.contextSlotKey(id, f));
      if (v !== null) localStorage.setItem(this.storageKeys[f], v);
      else localStorage.removeItem(this.storageKeys[f]);
    }
  }

  private contextRolesSigKey(ctx: string): string {
    return `kc_ctx_${this.contextIdForStorage(ctx)}_roles_sig`;
  }

  private contextRolesJsonKey(ctx: string): string {
    return `kc_ctx_${this.contextIdForStorage(ctx)}_roles_json`;
  }

  /** Identifica o access token (refresh troca o JWT mantendo sub/exp por vezes — inclui sufixo do token). */
  private accessTokenFingerprint(
    token: string,
    payload: Record<string, unknown>
  ): string {
    return `${payload['sub']}|${payload['exp']}|${token.length}|${token.slice(-24)}`;
  }

  private rolesForSessionContextId(ctx: string, roles: string[]): string[] {
    const unique = [...new Set(roles)];
    if (this.contextIdForStorage(ctx) === 'full') {
      return unique.filter((r) => r.startsWith('mod:'));
    }
    return unique;
  }

  private readPersistedRolesForToken(
    context: string,
    token: string,
    payload: Record<string, unknown>
  ): string[] | null {
    if (localStorage.getItem(this.contextRolesSigKey(context)) !== this.accessTokenFingerprint(token, payload)) {
      return null;
    }
    try {
      const raw = localStorage.getItem(this.contextRolesJsonKey(context));
      if (!raw) return null;
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr) || !arr.every((x) => typeof x === 'string')) return null;
      return arr as string[];
    } catch {
      return null;
    }
  }

  private writePersistedRolesForToken(
    context: string,
    token: string,
    payload: Record<string, unknown>,
    rolesFiltered: string[]
  ): void {
    localStorage.setItem(
      this.contextRolesSigKey(context),
      this.accessTokenFingerprint(token, payload)
    );
    localStorage.setItem(this.contextRolesJsonKey(context), JSON.stringify(rolesFiltered));
  }

  /**
   * Calcula as roles da UI para um par (contexto, access token).
   * - Se já guardámos roles para **este** token (ver `accessTokenFingerprint`), lê do `localStorage`.
   * - Senão: extrai claims do JWT, filtra (`mod:*` só no contexto portal `full`), grava e devolve.
   * Isto é intencional: menos trabalho repetido e menu lateral pode reutilizar o slot `full` sem novo parse quando possível.
   */
  private resolveRolesForContext(
    context: string,
    token: string,
    payload: Record<string, unknown>
  ): string[] {
    const hit = this.readPersistedRolesForToken(context, token, payload);
    if (hit) return hit;
    const extracted = extractRolesFromPayload(payload);
    const filtered = this.rolesForSessionContextId(context, extracted);
    this.writePersistedRolesForToken(context, token, payload, filtered);
    return filtered;
  }

  private clearAllContextSlots(): void {
    for (const ctx of this.allContextIds()) {
      for (const f of SYNCED_SESSION_FIELDS) {
        localStorage.removeItem(this.contextSlotKey(ctx, f));
      }
      localStorage.removeItem(this.contextRolesSigKey(ctx));
      localStorage.removeItem(this.contextRolesJsonKey(ctx));
    }
  }

  private clearLegacyPortalBackup(): void {
    this.legacyPortalBackupKeys.forEach((k) => localStorage.removeItem(k));
  }

  private readUserInfoCache(): CachedUserInfo | null {
    try {
      const raw = localStorage.getItem(this.userInfoCacheKey);
      if (!raw) return null;
      const o = JSON.parse(raw) as CachedUserInfo;
      return o?.sub ? o : null;
    } catch {
      return null;
    }
  }

  private writeUserInfoCache(info: CachedUserInfo): void {
    localStorage.setItem(this.userInfoCacheKey, JSON.stringify(info));
  }

  private clearUserInfoCache(): void {
    localStorage.removeItem(this.userInfoCacheKey);
  }

  private clearLegacyApiStorage(): void {
    this.legacyApiStorageKeys.forEach((k) => localStorage.removeItem(k));
  }

  /** Logout interno: apaga tokens, slots, cache userinfo e invalida caches em memória. */
  private clearTokens(): void {
    this.invalidateRoleResolutionCache();
    this.clearLegacyApiStorage();
    this.clearLegacyPortalBackup();
    this.clearAllContextSlots();
    this.clearUserInfoCache();
    Object.values(this.storageKeys).forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  }

  private buildAuthorizeScope(moduleKey?: string): string {
    const parts = ['openid', 'default'];
    if (moduleKey) {
      const mod = environment.keycloak.moduleClients?.[moduleKey];
      if (mod?.oauthScopes?.length) parts.push(...mod.oauthScopes);
    } else {
      parts.push(...environment.keycloak.portalOAuthScopes);
    }
    return [...new Set(parts)].join(' ');
  }

  /**
   * Grava a resposta do endpoint `/token` nas chaves **ativas** e copia o mesmo para o slot `kc_ctx_<sessionContext>_*`.
   * Assim, ao voltar ao portal, ainda temos o JWT do portal guardado mesmo com o access ativo a ser o do módulo.
   */
  private storeTokens(data: TokenResponse): void {
    localStorage.setItem(this.storageKeys.accessToken, data.access_token);
    localStorage.setItem(this.storageKeys.refreshToken, data.refresh_token);
    if (data.id_token) {
      localStorage.setItem(this.storageKeys.idToken, data.id_token);
    }
    const expiresAt = Date.now() + data.expires_in * 1000;
    localStorage.setItem(this.storageKeys.expiresAt, expiresAt.toString());
    localStorage.setItem(this.storageKeys.clientId, this.spaClientId);
    this.copyMainToContextSlot(this.getSessionContext());
  }

  /**
   * Chamado no bootstrap da app (`APP_INITIALIZER`). Limpa chaves legadas, reidrata sessão se o access token não expirou,
   * ou tenta `refreshToken` se só o access estiver velho. Retorna se o utilizador ficou autenticado.
   */
  async init(): Promise<boolean> {
    this.clearLegacyApiStorage();
    this.clearLegacyPortalBackup();

    const token = localStorage.getItem(this.storageKeys.accessToken);
    const expiresAt = Number(localStorage.getItem(this.storageKeys.expiresAt) ?? 0);

    if (token && Date.now() < expiresAt) {
      if (!localStorage.getItem(this.storageKeys.sessionContext)) {
        localStorage.setItem(this.storageKeys.sessionContext, 'full');
      }
      await this.runTokenMutation(() => this.applyToken(token));
      if (this.isPortalSession()) {
        this.copyMainToContextSlot('full');
      }
      return true;
    }

    if (token && Date.now() >= expiresAt) {
      const refreshed = await this.refreshToken();
      if (refreshed) return true;
    }

    return false;
  }

  /**
   * Inicia redirect ao Keycloak.
   * @param moduleKey Se definido (ex. `'orders'`), pede os `oauthScopes` desse módulo e grava `pending_module` para o callback.
   *                  Se omitido, login do **portal** (`portalOAuthScopes`).
   * @param returnTo Rota após OAuth (default do módulo ou `/portal`).
   */
  login(moduleKey?: string, returnTo?: string): void {
    const client = moduleKey
      ? environment.keycloak.moduleClients?.[moduleKey]
      : null;

    if (moduleKey && this.isPortalSession()) {
      this.copyMainToContextSlot('full');
    }

    if (moduleKey) {
      sessionStorage.setItem(this.storageKeys.pendingModule, moduleKey);
      sessionStorage.setItem(
        this.storageKeys.returnTo,
        returnTo ?? client?.route ?? '/portal'
      );
    } else if (returnTo) {
      sessionStorage.setItem(this.storageKeys.returnTo, returnTo);
    }

    const codeVerifier = generateCodeVerifier();
    sessionStorage.setItem(this.storageKeys.codeVerifier, codeVerifier);

    void sha256Base64Url(codeVerifier).then((codeChallenge) => {
      const params = new URLSearchParams({
        client_id: this.spaClientId,
        redirect_uri: this.redirectUri,
        response_type: 'code',
        scope: this.buildAuthorizeScope(moduleKey),
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });
      window.location.href = `${this.keycloakBaseUrl}/auth?${params.toString()}`;
    });
  }

  /**
   * Troca o `code` da URL por tokens (POST `/token` com PKCE). Corre na página `/callback`.
   * Em sucesso: define `sessionContext`, grava tokens e atualiza `userProfile`. `returnTo` veio do `sessionStorage` no login.
   */
  async handleCallback(code: string): Promise<HandleCallbackResult> {
    const codeVerifier = sessionStorage.getItem(this.storageKeys.codeVerifier);
    const pendingModule = sessionStorage.getItem(this.storageKeys.pendingModule);
    const returnTo = sessionStorage.getItem(this.storageKeys.returnTo) ?? '/portal';
    const sessionCtx = pendingModule ?? 'full';

    if (!codeVerifier) return { success: false };

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.spaClientId,
      redirect_uri: this.redirectUri,
      code,
      code_verifier: codeVerifier,
    });

    try {
      const response = await fetch(`${this.keycloakBaseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) return { success: false };

      const data: TokenResponse = await response.json();
      sessionStorage.removeItem(this.storageKeys.codeVerifier);
      sessionStorage.removeItem(this.storageKeys.pendingModule);
      sessionStorage.removeItem(this.storageKeys.returnTo);

      await this.runTokenMutation(async () => {
        localStorage.setItem(this.storageKeys.sessionContext, sessionCtx);
        this.storeTokens(data);
        await this.applyToken(data.access_token);
      });

      return { success: true, returnTo };
    } catch {
      return { success: false };
    }
  }

  /**
   * Renova access (e refresh) com o refresh token atual. Vários chamadores partilham a mesma Promise (`refreshInFlight`).
   * Falha → `clearTokens()` e o utilizador tem de voltar ao login.
   */
  async refreshToken(): Promise<boolean> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    this.refreshInFlight = this.runTokenMutation(() => this.refreshTokenImpl()).finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  /** Implementação do refresh (POST token grant). Falha limpa tudo — utilizador tem de autenticar de novo. */
  private async refreshTokenImpl(): Promise<boolean> {
    const refresh = localStorage.getItem(this.storageKeys.refreshToken);
    if (!refresh) return false;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.spaClientId,
      refresh_token: refresh,
    });

    try {
      const response = await fetch(`${this.keycloakBaseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        this.clearTokens();
        return false;
      }

      const data: TokenResponse = await response.json();
      this.storeTokens(data);
      await this.applyToken(data.access_token);
      return true;
    } catch {
      this.clearTokens();
      return false;
    }
  }

  /**
   * Limpa storage local e redireciona ao logout do Keycloak (termina sessão SSO no IdP quando configurado).
   * Chama antes de limpar os tokens para ainda enviar `id_token_hint` se existir.
   */
  logout(): void {
    const idToken = localStorage.getItem(this.storageKeys.idToken);
    const clientId =
      localStorage.getItem(this.storageKeys.clientId) ?? this.spaClientId;
    this.clearTokens();
    this.isAuthenticated.set(false);
    this.userProfile.set(null);

    const params = new URLSearchParams({
      client_id: clientId,
      post_logout_redirect_uri: window.location.origin,
    });
    if (idToken) params.set('id_token_hint', idToken);
    window.location.href = `${this.keycloakBaseUrl}/logout?${params.toString()}`;
  }

  /** Access token em storage, mesmo que já tenha expirado (útil só em casos pontuais; preferir `getSessionAccessTokenIfValid`). */
  getAccessToken(): string | null {
    return localStorage.getItem(this.storageKeys.accessToken);
  }

  /** Access token só se ainda não passou `kc_expires_at` (relógio local). */
  getSessionAccessTokenIfValid(): string | null {
    const exp = Number(localStorage.getItem(this.storageKeys.expiresAt) ?? 0);
    if (!exp || Date.now() >= exp) return null;
    return localStorage.getItem(this.storageKeys.accessToken);
  }

  /**
   * Usado pelo **HTTP interceptor** para anexar `Authorization: Bearer` às chamadas à API.
   * Se o token expirou, tenta refresh antes de devolver `null`.
   */
  async getOrRefreshSessionTokenForApi(): Promise<string | null> {
    const valid = this.getSessionAccessTokenIfValid();
    if (valid) return valid;
    await this.refreshToken();
    return this.getSessionAccessTokenIfValid() ?? this.getAccessToken();
  }

  /** Lista de roles/escopos efetivos para o token **ativo** e contexto atual (com cache em memória). */
  private getEffectiveRoles(): string[] {
    const accessToken = this.getAccessToken() ?? '';
    if (
      this.effectiveRolesCache &&
      this.effectiveRolesCache.accessToken === accessToken
    ) {
      return this.effectiveRolesCache.roles;
    }

    const ctx = this.getSessionContext();
    const payload = accessToken ? parseJwtPayload(accessToken) : null;
    const merged = payload
      ? this.resolveRolesForContext(ctx, accessToken, payload)
      : [];

    this.effectiveRolesCache = { accessToken, roles: merged };
    return merged;
  }

  /** Verifica uma role/escopo no JWT da sessão atual (ex.: `orders:read`, `mod:orders`). */
  hasRole(role: string): boolean {
    return this.getEffectiveRoles().includes(role);
  }

  /** True se o utilizador tiver **pelo menos uma** das roles listadas. */
  hasAnyRole(roles: string[]): boolean {
    return roles.some((r) => this.hasRole(r));
  }

  /**
   * Portal: o token atual inclui o scope `mod:xyz` que mapeia aquele módulo? (Ver `modulePortalScopes` no environment.)
   */
  hasPortalAccessToModule(moduleKey: string): boolean {
    const scope = environment.keycloak.modulePortalScopes?.[moduleKey];
    return scope ? this.hasRole(scope) : false;
  }

  /**
   * Menu lateral: no portal usa o token atual; **dentro de um módulo** o access ativo não traz `mod:*`,
   * por isso lê o JWT guardado no slot `kc_ctx_full_*` para ainda mostrar entradas permitidas.
   */
  hasPortalGrantForModule(moduleKey: string): boolean {
    const scope = environment.keycloak.modulePortalScopes?.[moduleKey];
    if (!scope) return false;
    if (this.isPortalSession()) {
      return this.hasRole(scope);
    }
    const portalAccess = localStorage.getItem(this.contextSlotKey('full', 'accessToken'));
    if (!portalAccess) {
      return this.getCurrentModule() === moduleKey;
    }
    const payload = parseJwtPayload(portalAccess);
    if (!payload) {
      return this.getCurrentModule() === moduleKey;
    }
    const roles = this.resolveRolesForContext('full', portalAccess, payload);
    return roles.includes(scope) || this.getCurrentModule() === moduleKey;
  }

  /** Útil no `roleGuard` do portal: qualquer `mod:*` no token atual autoriza rotas genéricas da home. */
  hasAnyPortalModuleScope(): boolean {
    const scopes = Object.values(environment.keycloak.modulePortalScopes ?? {});
    return scopes.some((s) => this.hasRole(s));
  }

  /** Lista de strings com `:` para mostrar na UI (badges de escopos). */
  getScopeBadgesForDisplay(): string[] {
    return this.getEffectiveRoles().filter((r) => r.includes(':'));
  }

  /** Rótulo curto para o tipo de sessão (Portal / Administrador / …) — alinhado ao dashboard. */
  getSessionBadgeLabel(): string {
    if (this.isPortalSession()) {
      const roles = this.getEffectiveRoles();
      if (roles.some((r) => r.startsWith('mod:'))) return 'Portal (escopos mod)';
      return 'Portal';
    }
    const roles = this.getEffectiveRoles();
    if (roles.some((r) => r.endsWith(':write'))) return 'Administrador';
    return 'Usuário';
  }

  /** Nome legível do módulo quando `sessionContext` não é `full`; senão `null`. */
  getActiveModuleLabel(): string | null {
    const mod = this.getCurrentModule();
    if (!mod || mod === 'full') return null;
    return environment.keycloak.moduleClients?.[mod]?.label ?? mod;
  }

  /** Ex.: `mod:orders` para o módulo atual — para mostrar junto aos escopos da API. */
  getPortalModScopeForActiveModule(): string | null {
    const key = this.getCurrentModule();
    if (!key || key === 'full') return null;
    return environment.keycloak.modulePortalScopes?.[key] ?? null;
  }

  /**
   * `'full'` = portal; caso contrário a chave do módulo (`orders`, …) se existir em `moduleClients`.
   * `null` se `sessionContext` estiver corrompido/desconhecido.
   */
  getCurrentModule(): string | null {
    const ctx = this.getSessionContext();
    if (ctx === 'full') return 'full';
    return environment.keycloak.moduleClients?.[ctx] ? ctx : null;
  }

  /** Dado um path (ex. `/orders`), devolve a chave do módulo cuja `route` corresponde. */
  getModuleForRoute(route: string): string | null {
    const modules = environment.keycloak.moduleClients ?? {};
    for (const [key, m] of Object.entries(modules)) {
      if (route.startsWith(m.route) || route === m.route) return key;
    }
    return null;
  }

  /**
   * True se a rota pedida pertence a outro módulo do que o token atual (é preciso novo login OAuth com scopes desse módulo).
   */
  needsModuleSwitch(route: string): boolean {
    const targetModule = this.getModuleForRoute(route);
    if (!targetModule) return false;
    const current = this.getCurrentModule();
    if (current === null) return false;
    if (current === 'full') return true;
    return current !== targetModule;
  }

  /** Atalho: sessão do portal (não estamos num fluxo de módulo com JWT “fino”). */
  isPortalSession(): boolean {
    return this.getCurrentModule() === 'full';
  }

  /** Atalho para `login(moduleKey, …)` com `returnTo` default = rota do módulo. */
  loginForModule(moduleKey: string, returnTo?: string): void {
    const client = environment.keycloak.moduleClients?.[moduleKey];
    this.login(moduleKey, returnTo ?? client?.route ?? '/portal');
  }

  /** Há token do portal guardado no slot `full` (para `restorePortalSessionFromBackup`). */
  hasPortalSessionBackup(): boolean {
    return !!localStorage.getItem(this.contextSlotKey('full', 'accessToken'));
  }

  /**
   * Usado pelo `portalEntryGuard`: se viemos de um módulo, repõe o token do portal a partir do slot `full`
   * antes de validar rotas do portal.
   */
  async ensurePortalSessionWhenNeeded(): Promise<void> {
    if (this.isPortalSession()) return;
    if (this.hasPortalSessionBackup()) {
      await this.restorePortalSessionFromBackup();
    }
  }

  /**
   * Copia `kc_ctx_full_*` → chaves ativas e volta a aplicar o access token (atualiza perfil e roles de portal).
   * Deve ser await pelos fluxos de navegação para não competir com refresh.
   */
  async restorePortalSessionFromBackup(): Promise<boolean> {
    await this.tokenMutationChain;
    return this.runTokenMutation(() => this.restorePortalSessionFromBackupImpl());
  }

  /** Passos síncronos de cópia slot→ativo + `applyToken` (corre dentro de `runTokenMutation`). */
  private async restorePortalSessionFromBackupImpl(): Promise<boolean> {
    const access = localStorage.getItem(this.contextSlotKey('full', 'accessToken'));
    if (!access) return false;
    this.copyContextSlotToMain('full');
    await this.applyToken(access);
    return true;
  }

  /**
   * “Commit” de um access token: atualiza `userProfile`, `isAuthenticated`, roles via JWT e opcionalmente userinfo.
   *
   * **Userinfo:** só faz pedido HTTP se não existir cache ou se o `sub` do JWT for diferente do cache
   * (troca de utilizador). Caso contrário reutiliza `kc_userinfo_cache` (nome, email, … — **sem** roles).
   *
   * **Roles:** nunca vêm do userinfo; vêm de `resolveRolesForContext` (JWT + cache em `localStorage` por contexto).
   *
   * Chamar sempre dentro de `runTokenMutation` quando o token mudou por refresh/callback/restore.
   */
  private async applyToken(token: string): Promise<void> {
    this.invalidateRoleResolutionCache();
    const jwtPayload = parseJwtPayload(token);
    if (!jwtPayload) return;

    localStorage.setItem(this.storageKeys.clientId, this.spaClientId);

    const ctx = this.getSessionContext();
    const roles = this.resolveRolesForContext(ctx, token, jwtPayload);

    const baseFromJwt = {
      sub: jwtPayload['sub'] as string,
      preferred_username: (jwtPayload['preferred_username'] as string) ?? '',
      name: jwtPayload['name'] as string | undefined,
      email: jwtPayload['email'] as string | undefined,
      email_verified: jwtPayload['email_verified'] as boolean | undefined,
      given_name: jwtPayload['given_name'] as string | undefined,
      family_name: jwtPayload['family_name'] as string | undefined,
    };

    const clientId = this.spaClientId;
    const cached = this.readUserInfoCache();
    const sub = baseFromJwt.sub;

    let userFields: CachedUserInfo | null = null;
    if (!cached || cached.sub !== sub) {
      const raw = await this.fetchUserInfoRaw(token);
      if (raw) {
        userFields = cachedUserInfoFromUserinfoPayload(raw);
        this.writeUserInfoCache(userFields);
      } else if (cached?.sub === sub) {
        userFields = cached;
      }
    } else {
      userFields = cached;
    }

    const profile: UserProfile = {
      ...baseFromJwt,
      ...(userFields ?? {}),
      roles,
      clientId,
    };
    this.userProfile.set(profile);
    this.isAuthenticated.set(true);
  }

  /** GET `/userinfo` com Bearer. Erros de rede/HTTP → `null` (quem chama pode cair no cache). */
  private async fetchUserInfoRaw(
    token: string
  ): Promise<Record<string, unknown> | null> {
    try {
      const response = await fetch(`${this.keycloakBaseUrl}/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      return (await response.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
