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

@Injectable({ providedIn: 'root' })
export class KeycloakService {
  private readonly storageKeys = {
    accessToken: 'kc_access_token',
    refreshToken: 'kc_refresh_token',
    codeVerifier: 'kc_code_verifier',
    expiresAt: 'kc_expires_at',
    idToken: 'kc_id_token',
    clientId: 'kc_client_id',
    pendingModule: 'kc_pending_module',
    returnTo: 'kc_return_to',
  };

  /** Snapshot do token do portal — preservado ao entrar num módulo para o botão Voltar */
  private readonly portalBackupKeys = {
    accessToken: 'kc_portal_backup_access',
    refreshToken: 'kc_portal_backup_refresh',
    expiresAt: 'kc_portal_backup_expires',
    idToken: 'kc_portal_backup_id',
    clientId: 'kc_portal_backup_client',
  };

  /** Removidos do fluxo antigo (order-processing-api separado) */
  private readonly legacyApiStorageKeys = [
    'kc_api_access_token',
    'kc_api_refresh_token',
    'kc_api_expires_at',
  ];

  readonly isAuthenticated = signal<boolean>(false);
  readonly userProfile = signal<UserProfile | null>(null);

  /**
   * Serializa refresh, callback, restore do portal e init — evita o interceptor
   * terminar um refresh do *módulo* depois do restore e sobrescrever o perfil antes do roleGuard.
   */
  private tokenMutationChain: Promise<unknown> = Promise.resolve();

  private runTokenMutation<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tokenMutationChain.then(fn);
    this.tokenMutationChain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  /** Vários HTTP com token expirado enfileiravam N refreshes; o restore do portal ficava atrás e o roleGuard lia estado velho. */
  private refreshInFlight: Promise<boolean> | null = null;

  /** Cache de roles efetivas (JWT + perfil) por access token atual. */
  private effectiveRolesCache: { accessToken: string; roles: string[] } | null = null;

  private invalidateRoleResolutionCache(): void {
    this.effectiveRolesCache = null;
  }

  /** Payload e azp alinhados ao access token em storage (fonte de verdade para guards). */
  private readActiveToken(): {
    payload: Record<string, unknown> | null;
    azp: string | undefined;
  } {
    const accessToken = this.getAccessToken() ?? '';
    const payload = accessToken ? this.parseJwt(accessToken) : null;
    const azp =
      (payload?.['azp'] as string | undefined) ??
      this.userProfile()?.clientId ??
      localStorage.getItem(this.storageKeys.clientId) ??
      undefined;
    return { payload, azp };
  }

  private get keycloakBaseUrl(): string {
    const { url, realm } = environment.keycloak;
    return `${url}/realms/${realm}/protocol/openid-connect`;
  }

  private get redirectUri(): string {
    return `${window.location.origin}/callback`;
  }

  private get portalClientId(): string {
    return environment.keycloak.portalClientId;
  }

  private getClientCredentials(clientId: string): { clientId: string; clientSecret: string } {
    if (clientId === this.portalClientId) {
      return {
        clientId: this.portalClientId,
        clientSecret: environment.keycloak.portalClientSecret,
      };
    }
    const modules = environment.keycloak.moduleClients ?? {};
    for (const m of Object.values(modules)) {
      if (m.clientId === clientId) {
        return { clientId: m.clientId, clientSecret: m.clientSecret };
      }
    }
    return {
      clientId: this.portalClientId,
      clientSecret: environment.keycloak.portalClientSecret,
    };
  }

  async init(): Promise<boolean> {
    this.clearLegacyApiStorage();

    const token = localStorage.getItem(this.storageKeys.accessToken);
    const expiresAt = Number(localStorage.getItem(this.storageKeys.expiresAt) ?? 0);

    if (token && Date.now() < expiresAt) {
      await this.runTokenMutation(() => this.applyToken(token));
      if (this.isPortalSession()) {
        this.copyMainSessionToPortalBackup();
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
   * @param moduleKey Client do módulo. Sem parâmetro: client do portal (`mod:*`).
   */
  login(moduleKey?: string, returnTo?: string): void {
    const client = moduleKey
      ? environment.keycloak.moduleClients?.[moduleKey]
      : null;
    const clientId = client?.clientId ?? this.portalClientId;

    if (moduleKey && this.isPortalSession()) {
      this.copyMainSessionToPortalBackup();
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

    const codeVerifier = this.generateCodeVerifier();
    sessionStorage.setItem(this.storageKeys.codeVerifier, codeVerifier);

    this.generateCodeChallenge(codeVerifier).then((codeChallenge) => {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: this.redirectUri,
        response_type: 'code',
        scope: 'openid',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      window.location.href = `${this.keycloakBaseUrl}/auth?${params.toString()}`;
    });
  }

  async handleCallback(code: string): Promise<HandleCallbackResult> {
    const codeVerifier = sessionStorage.getItem(this.storageKeys.codeVerifier);
    const pendingModule = sessionStorage.getItem(this.storageKeys.pendingModule);
    const returnTo = sessionStorage.getItem(this.storageKeys.returnTo) ?? '/portal';

    const modClient = pendingModule
      ? environment.keycloak.moduleClients?.[pendingModule]
      : null;
    const clientId = modClient?.clientId ?? this.portalClientId;
    const clientSecret = modClient?.clientSecret ?? environment.keycloak.portalClientSecret;

    if (!codeVerifier) return { success: false };

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
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
        this.storeTokens(data, clientId);
        await this.applyToken(data.access_token);
      });

      return { success: true, returnTo };
    } catch {
      return { success: false };
    }
  }

  async refreshToken(): Promise<boolean> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    this.refreshInFlight = this.runTokenMutation(() => this.refreshTokenImpl()).finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  private async refreshTokenImpl(): Promise<boolean> {
    const refresh = localStorage.getItem(this.storageKeys.refreshToken);
    const storedClientId = localStorage.getItem(this.storageKeys.clientId);
    if (!refresh) return false;

    const { clientId, clientSecret } = this.getClientCredentials(
      storedClientId ?? this.portalClientId
    );

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
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
      this.storeTokens(data, storedClientId ?? undefined);
      await this.applyToken(data.access_token);
      return true;
    } catch {
      this.clearTokens();
      return false;
    }
  }

  logout(): void {
    const idToken = localStorage.getItem(this.storageKeys.idToken);
    const clientId =
      localStorage.getItem(this.storageKeys.clientId) ?? this.portalClientId;
    this.clearTokens();
    this.isAuthenticated.set(false);
    this.userProfile.set(null);

    const params = new URLSearchParams({
      client_id: clientId,
      post_logout_redirect_uri: window.location.origin,
    });

    if (idToken) {
      params.set('id_token_hint', idToken);
    }

    window.location.href = `${this.keycloakBaseUrl}/logout?${params.toString()}`;
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.storageKeys.accessToken);
  }

  getSessionAccessTokenIfValid(): string | null {
    const exp = Number(localStorage.getItem(this.storageKeys.expiresAt) ?? 0);
    if (!exp || Date.now() >= exp) return null;
    return localStorage.getItem(this.storageKeys.accessToken);
  }

  /**
   * Token para o gateway: sempre o da sessão (portal ou módulo), com refresh se expirado.
   */
  async getOrRefreshSessionTokenForApi(): Promise<string | null> {
    const valid = this.getSessionAccessTokenIfValid();
    if (valid) return valid;
    await this.refreshToken();
    return this.getSessionAccessTokenIfValid() ?? this.getAccessToken();
  }

  /**
   * Roles para autorização na UI: merge JWT atual + perfil, para não negar /portal
   * quando o signal ainda não acompanhou o token após restore ou refresh.
   */
  private getEffectiveRoles(): string[] {
    const accessToken = this.getAccessToken() ?? '';
    if (
      this.effectiveRolesCache &&
      this.effectiveRolesCache.accessToken === accessToken
    ) {
      return this.effectiveRolesCache.roles;
    }

    const { payload, azp } = this.readActiveToken();
    const fromJwt = payload ? this.extractRoles(payload) : [];
    const fromProfile = this.userProfile()?.roles ?? [];
    let merged = [...new Set([...fromProfile, ...fromJwt])];
    if (azp === this.portalClientId) {
      merged = merged.filter((r) => r.startsWith('mod:'));
    }

    this.effectiveRolesCache = { accessToken, roles: merged };
    return merged;
  }

  hasRole(role: string): boolean {
    return this.getEffectiveRoles().includes(role);
  }

  hasAnyRole(roles: string[]): boolean {
    return roles.some((r) => this.hasRole(r));
  }

  hasPortalAccessToModule(moduleKey: string): boolean {
    const scope = environment.keycloak.modulePortalScopes?.[moduleKey];
    return scope ? this.hasRole(scope) : false;
  }

  /**
   * Menu lateral: módulos que o usuário pode abrir conforme `mod:*` no token do portal.
   * Com sessão de módulo ativa, usa o JWT do portal guardado em backup (o access atual não traz `mod:*`).
   */
  hasPortalGrantForModule(moduleKey: string): boolean {
    const scope = environment.keycloak.modulePortalScopes?.[moduleKey];
    if (!scope) return false;
    if (this.isPortalSession()) {
      return this.hasRole(scope);
    }
    const backupAccess = localStorage.getItem(this.portalBackupKeys.accessToken);
    if (!backupAccess) {
      return this.getCurrentModule() === moduleKey;
    }
    const payload = this.parseJwt(backupAccess);
    if (!payload) {
      return this.getCurrentModule() === moduleKey;
    }
    const azp = payload['azp'] as string | undefined;
    if (azp !== this.portalClientId) {
      return this.getCurrentModule() === moduleKey;
    }
    const roles = this.extractRoles(payload);
    return roles.includes(scope);
  }

  hasAnyPortalModuleScope(): boolean {
    const scopes = Object.values(environment.keycloak.modulePortalScopes ?? {});
    return scopes.some((s) => this.hasRole(s));
  }

  /** Escopos com `:` do token atual para badges (portal: `mod:*`; módulo: `products:read`, etc.). */
  getScopeBadgesForDisplay(): string[] {
    return this.getEffectiveRoles().filter((r) => r.includes(':'));
  }

  /** Rótulo do badge cinza (mesmo critério do dashboard do portal). */
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

  /** Label do módulo ativo; `null` se sessão for portal. */
  getActiveModuleLabel(): string | null {
    const mod = this.getCurrentModule();
    if (!mod || mod === 'full') return null;
    return environment.keycloak.moduleClients?.[mod]?.label ?? mod;
  }

  /** `mod:*` do portal para o módulo atual (exibir junto aos escopos da API). */
  getPortalModScopeForActiveModule(): string | null {
    const key = this.getCurrentModule();
    if (!key || key === 'full') return null;
    return environment.keycloak.modulePortalScopes?.[key] ?? null;
  }

  getCurrentModule(): string | null {
    const { azp: clientId } = this.readActiveToken();
    if (!clientId) return null;
    if (clientId === this.portalClientId) return 'full';
    const modules = environment.keycloak.moduleClients ?? {};
    for (const [key, m] of Object.entries(modules)) {
      if (m.clientId === clientId) return key;
    }
    return null;
  }

  getModuleForRoute(route: string): string | null {
    const modules = environment.keycloak.moduleClients ?? {};
    for (const [key, m] of Object.entries(modules)) {
      if (route.startsWith(m.route) || route === m.route) return key;
    }
    return null;
  }

  needsModuleSwitch(route: string): boolean {
    const targetModule = this.getModuleForRoute(route);
    if (!targetModule) return false;
    const current = this.getCurrentModule();
    if (current === null) return false;
    if (current === 'full') return true;
    return current !== targetModule;
  }

  isPortalSession(): boolean {
    return this.getCurrentModule() === 'full';
  }

  loginForModule(moduleKey: string, returnTo?: string): void {
    const client = environment.keycloak.moduleClients?.[moduleKey];
    this.login(moduleKey, returnTo ?? client?.route ?? '/portal');
  }

  hasPortalSessionBackup(): boolean {
    return !!localStorage.getItem(this.portalBackupKeys.accessToken);
  }

  /**
   * Se o access token ativo não for do portal, restaura a partir do backup (volta do módulo).
   */
  async ensurePortalSessionWhenNeeded(): Promise<void> {
    if (this.isPortalSession()) {
      return;
    }
    if (this.hasPortalSessionBackup()) {
      await this.restorePortalSessionFromBackup();
    }
  }

  /**
   * Recoloca o token do portal na sessão ativa (ex.: ao abrir /portal vindo de um módulo).
   */
  async restorePortalSessionFromBackup(): Promise<boolean> {
    await this.tokenMutationChain;
    return this.runTokenMutation(() => this.restorePortalSessionFromBackupImpl());
  }

  private async restorePortalSessionFromBackupImpl(): Promise<boolean> {
    const access = localStorage.getItem(this.portalBackupKeys.accessToken);
    if (!access) return false;

    const pairs: [string, string][] = [
      [this.portalBackupKeys.accessToken, this.storageKeys.accessToken],
      [this.portalBackupKeys.refreshToken, this.storageKeys.refreshToken],
      [this.portalBackupKeys.expiresAt, this.storageKeys.expiresAt],
      [this.portalBackupKeys.idToken, this.storageKeys.idToken],
      [this.portalBackupKeys.clientId, this.storageKeys.clientId],
    ];
    for (const [from, to] of pairs) {
      const v = localStorage.getItem(from);
      if (v !== null) localStorage.setItem(to, v);
      else localStorage.removeItem(to);
    }

    await this.applyToken(access);
    return true;
  }

  private copyMainSessionToPortalBackup(): void {
    const pairs: [string, string][] = [
      [this.storageKeys.accessToken, this.portalBackupKeys.accessToken],
      [this.storageKeys.refreshToken, this.portalBackupKeys.refreshToken],
      [this.storageKeys.expiresAt, this.portalBackupKeys.expiresAt],
      [this.storageKeys.idToken, this.portalBackupKeys.idToken],
      [this.storageKeys.clientId, this.portalBackupKeys.clientId],
    ];
    for (const [from, to] of pairs) {
      const v = localStorage.getItem(from);
      if (v !== null) localStorage.setItem(to, v);
      else localStorage.removeItem(to);
    }
  }

  private clearPortalBackup(): void {
    Object.values(this.portalBackupKeys).forEach((k) => localStorage.removeItem(k));
  }

  private async applyToken(token: string): Promise<void> {
    this.invalidateRoleResolutionCache();
    const jwtPayload = this.parseJwt(token);
    if (!jwtPayload) return;

    const clientId = (jwtPayload['azp'] as string) ?? undefined;
    if (clientId) {
      localStorage.setItem(this.storageKeys.clientId, clientId);
    }

    const rolesFromJwt = this.extractRoles(jwtPayload);
    let jwtOnlyRoles = [...new Set(rolesFromJwt)];
    if (clientId === this.portalClientId) {
      jwtOnlyRoles = jwtOnlyRoles.filter((r) => r.startsWith('mod:'));
    }

    const baseFields = {
      sub: jwtPayload['sub'] as string,
      preferred_username: (jwtPayload['preferred_username'] as string) ?? '',
      name: jwtPayload['name'] as string | undefined,
      email: jwtPayload['email'] as string | undefined,
      email_verified: jwtPayload['email_verified'] as boolean | undefined,
      given_name: jwtPayload['given_name'] as string | undefined,
      family_name: jwtPayload['family_name'] as string | undefined,
    };

    // Antes do userinfo (rede): guards e getCurrentModule() já refletem o client do JWT.
    this.userProfile.set({ ...baseFields, roles: jwtOnlyRoles, clientId });
    this.isAuthenticated.set(true);

    const userInfo = await this.fetchUserInfo(token);
    const rolesFromUserInfo = userInfo
      ? this.extractRoles(userInfo as unknown as Record<string, unknown>)
      : [];
    let roles = [...new Set([...rolesFromJwt, ...rolesFromUserInfo])];

    if (clientId === this.portalClientId) {
      roles = roles.filter((r) => r.startsWith('mod:'));
    }

    const profileMerged: UserProfile = {
      ...baseFields,
      roles,
      clientId,
    };

    this.userProfile.set(profileMerged);

    if (userInfo) {
      this.userProfile.set({ ...profileMerged, ...userInfo, roles, clientId });
    }
  }

  private async fetchUserInfo(token: string): Promise<Partial<UserProfile> | null> {
    try {
      const response = await fetch(`${this.keycloakBaseUrl}/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as Record<string, unknown>;

      return {
        sub: data['sub'] as string,
        preferred_username: data['preferred_username'] as string | undefined,
        name: data['name'] as string | undefined,
        email: data['email'] as string | undefined,
        email_verified: data['email_verified'] as boolean | undefined,
        given_name: data['given_name'] as string | undefined,
        family_name: data['family_name'] as string | undefined,
      };
    } catch {
      return null;
    }
  }

  private extractRoles(payload: Record<string, unknown>): string[] {
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

  private storeTokens(data: TokenResponse, clientId?: string): void {
    localStorage.setItem(this.storageKeys.accessToken, data.access_token);
    localStorage.setItem(this.storageKeys.refreshToken, data.refresh_token);
    if (data.id_token) {
      localStorage.setItem(this.storageKeys.idToken, data.id_token);
    }
    const expiresAt = Date.now() + data.expires_in * 1000;
    localStorage.setItem(this.storageKeys.expiresAt, expiresAt.toString());
    if (clientId) {
      localStorage.setItem(this.storageKeys.clientId, clientId);
    }
    if (clientId === this.portalClientId) {
      this.copyMainSessionToPortalBackup();
    }
  }

  private clearLegacyApiStorage(): void {
    this.legacyApiStorageKeys.forEach((k) => localStorage.removeItem(k));
  }

  private clearTokens(): void {
    this.invalidateRoleResolutionCache();
    this.clearLegacyApiStorage();
    this.clearPortalBackup();
    Object.values(this.storageKeys).forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  }

  private parseJwt(token: string): Record<string, unknown> | null {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
