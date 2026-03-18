package com.challenge.OrderProcessingManagement.controller;

import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

import com.challenge.OrderProcessingManagement.model.Product;
import com.challenge.OrderProcessingManagement.model.ProductInput;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Products", description = "Product catalog management. Requires scope products:read or products:write.")
@RequestMapping("/products")
public interface ProductsController {

    @Operation(
            summary = "List all products",
            security = @SecurityRequirement(name = "keycloakOAuth2", scopes = "products:read")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Product list returned successfully",
                    content = @Content(array = @ArraySchema(schema = @Schema(implementation = Product.class)))),
            @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content),
            @ApiResponse(responseCode = "403", description = "Forbidden", content = @Content)
    })
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<List<Product>> getAllProducts();

    @Operation(
            summary = "Create new product",
            security = @SecurityRequirement(name = "keycloakOAuth2", scopes = "products:write")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Product created successfully",
                    content = @Content(schema = @Schema(implementation = Product.class))),
            @ApiResponse(responseCode = "400", description = "Validation error", content = @Content),
            @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content),
            @ApiResponse(responseCode = "403", description = "Forbidden", content = @Content)
    })
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<Product> createProduct(@Valid @RequestBody ProductInput productInput);

    @Operation(
            summary = "Get product by ID",
            security = @SecurityRequirement(name = "keycloakOAuth2", scopes = "products:read")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Product found",
                    content = @Content(schema = @Schema(implementation = Product.class))),
            @ApiResponse(responseCode = "404", description = "Product not found", content = @Content),
            @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content),
            @ApiResponse(responseCode = "403", description = "Forbidden", content = @Content)
    })
    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<Product> getProductById(
            @Parameter(description = "Product identifier", required = true)
            @PathVariable Integer id
    );

    @Operation(
            summary = "Update product",
            security = @SecurityRequirement(name = "keycloakOAuth2", scopes = "products:write")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Product updated successfully",
                    content = @Content(schema = @Schema(implementation = Product.class))),
            @ApiResponse(responseCode = "400", description = "Validation error", content = @Content),
            @ApiResponse(responseCode = "404", description = "Product not found", content = @Content),
            @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content),
            @ApiResponse(responseCode = "403", description = "Forbidden", content = @Content)
    })
    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<Product> updateProduct(
            @Parameter(description = "Product identifier", required = true)
            @PathVariable Integer id,
            @Valid @RequestBody ProductInput productInput
    );

    @Operation(
            summary = "Delete product",
            security = @SecurityRequirement(name = "keycloakOAuth2", scopes = "products:write")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Product deleted successfully", content = @Content),
            @ApiResponse(responseCode = "404", description = "Product not found", content = @Content),
            @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content),
            @ApiResponse(responseCode = "403", description = "Forbidden", content = @Content)
    })
    @DeleteMapping(value = "/{id}")
    ResponseEntity<Void> deleteProduct(
            @Parameter(description = "Product identifier", required = true)
            @PathVariable Integer id
    );
}
