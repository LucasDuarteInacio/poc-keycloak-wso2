package com.challenge.OrderProcessingManagement.controller;

import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

import com.challenge.OrderProcessingManagement.model.CustomerInput;
import com.challenge.OrderProcessingManagement.model.entity.Customer;

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

@Tag(name = "Customers", description = "Customer management. Requires scope customers:read or customers:write.")
@RequestMapping("/customers")
public interface CustomersController {

    @Operation(
            summary = "List all customers",
            security = @SecurityRequirement(name = "keycloakOAuth2", scopes = "customers:read")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Customer list returned successfully",
                    content = @Content(array = @ArraySchema(schema = @Schema(implementation = Customer.class)))),
            @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content),
            @ApiResponse(responseCode = "403", description = "Forbidden — insufficient scope or not via gateway", content = @Content)
    })
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<List<Customer>> getAllCustomers();

    @Operation(
            summary = "Create new customer",
            security = @SecurityRequirement(name = "keycloakOAuth2", scopes = "customers:write")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Customer created successfully",
                    content = @Content(schema = @Schema(implementation = Customer.class))),
            @ApiResponse(responseCode = "400", description = "Validation error", content = @Content),
            @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content),
            @ApiResponse(responseCode = "403", description = "Forbidden", content = @Content)
    })
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<Customer> createCustomer(@Valid @RequestBody CustomerInput customerInput);

    @Operation(
            summary = "Get customer by ID",
            security = @SecurityRequirement(name = "keycloakOAuth2", scopes = "customers:read")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Customer found",
                    content = @Content(schema = @Schema(implementation = Customer.class))),
            @ApiResponse(responseCode = "404", description = "Customer not found", content = @Content),
            @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content),
            @ApiResponse(responseCode = "403", description = "Forbidden", content = @Content)
    })
    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<Customer> getCustomerById(
            @Parameter(description = "Customer identifier", required = true)
            @PathVariable Integer id
    );
}
