package com.challenge.OrderProcessingManagement.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Order Processing Management API")
                        .description("REST API for order management. Protected by OAuth2 (Keycloak via WSO2 gateway).")
                        .version("1.0.0")
                );
    }
}
