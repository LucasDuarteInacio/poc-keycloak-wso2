package com.challenge.OrderProcessingManagement.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.OAuthFlow;
import io.swagger.v3.oas.models.security.OAuthFlows;
import io.swagger.v3.oas.models.security.Scopes;
import io.swagger.v3.oas.models.security.SecurityScheme;

@Configuration
public class OpenApiConfig {

    private static final String KEYCLOAK_REALM_BASE =
            "http://localhost:8081/realms/order-processing/protocol/openid-connect";

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Order Processing Management API")
                        .description("REST API for order management. Protected by OAuth2 (Keycloak via WSO2 gateway).")
                        .version("1.0.0")
                )
                .components(new Components()
                        .addSecuritySchemes("keycloakOAuth2", keycloakOAuth2Scheme()));
    }

    private static SecurityScheme keycloakOAuth2Scheme() {
        OAuthFlows flows = new OAuthFlows()
                .authorizationCode(new OAuthFlow()
                        .authorizationUrl(KEYCLOAK_REALM_BASE + "/auth")
                        .tokenUrl(KEYCLOAK_REALM_BASE + "/token")
                        .scopes(realmScopes()))
                .clientCredentials(new OAuthFlow()
                        .tokenUrl(KEYCLOAK_REALM_BASE + "/token")
                        .scopes(realmScopes()));
        return new SecurityScheme()
                .type(SecurityScheme.Type.OAUTH2)
                .description("Keycloak realm order-processing (dev: localhost:8081). Adjust URLs if your host differs.")
                .flows(flows);
    }

    private static Scopes realmScopes() {
        return new Scopes()
                .addString("customers:read", "Read customers")
                .addString("customers:write", "Create and update customers")
                .addString("products:read", "Read products")
                .addString("products:write", "Create, update, and delete products")
                .addString("orders:read", "Read orders")
                .addString("orders:write", "Create and update orders");
    }
}
