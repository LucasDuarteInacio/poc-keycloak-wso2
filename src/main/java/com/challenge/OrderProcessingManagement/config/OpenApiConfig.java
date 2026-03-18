package com.challenge.OrderProcessingManagement.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.parser.OpenAPIV3Parser;
import io.swagger.v3.parser.core.models.SwaggerParseResult;
import lombok.SneakyThrows;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

@Configuration
public class OpenApiConfig {

    @Bean
    @SneakyThrows
    public OpenAPI customOpenAPI() {
        ClassPathResource resource = new ClassPathResource("openapi.yaml");
        String openApiContent = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);

        OpenAPIV3Parser parser = new OpenAPIV3Parser();
        SwaggerParseResult parseResult = parser.readContents(openApiContent, null, null);
        return parseResult.getOpenAPI();
    }
}

