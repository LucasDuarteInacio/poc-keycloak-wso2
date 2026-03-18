package com.challenge.OrderProcessingManagement.security;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class Wso2GatewayFilter extends OncePerRequestFilter {

    private static final String CONTENT_TYPE_JSON = "application/json";

    private static final List<String> BYPASS_PATHS = Arrays.asList(
            "/v3/api-docs",
            "/swagger-ui",
            "/swagger-ui.html"
    );

    @Value("${wso2.gateway.validation.enabled:true}")
    private boolean validationEnabled;

    @Value("${wso2.gateway.validation.header-name:X-Gateway-Secret}")
    private String headerName;

    @Value("${wso2.gateway.validation.secret}")
    private String expectedSecret;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        if (!validationEnabled || isPublicPath(request.getServletPath())) {
            filterChain.doFilter(request, response);
            return;
        }

        String headerValue = request.getHeader(headerName);

        if (headerValue == null || !headerValue.equals(expectedSecret)) {
            log.warn("Acesso direto ao backend bloqueado — IP: {}, URI: {}, header '{}' ausente ou inválido",
                    request.getRemoteAddr(), request.getServletPath(), headerName);
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType(CONTENT_TYPE_JSON);
            response.getWriter().write("""
                    {
                      "error": "Acesso negado",
                      "message": "Acesso direto ao backend não é permitido. Utilize o API Gateway (WSO2)."
                    }
                    """);
            return;
        }

        log.debug("[WSO2] Gateway validado — IP: {}, URI: {}", request.getRemoteAddr(), request.getServletPath());
        filterChain.doFilter(request, response);
    }

    private boolean isPublicPath(String uri) {
        return BYPASS_PATHS.stream().anyMatch(uri::startsWith);
    }
}
