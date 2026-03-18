package com.challenge.OrderProcessingManagement.controller;

import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

import com.challenge.OrderProcessingManagement.model.Order;
import com.challenge.OrderProcessingManagement.model.OrderInput;
import com.challenge.OrderProcessingManagement.model.UpdateOrderStatus;

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

@Tag(name = "Orders", description = "Order management. Requires scope orders:read or orders:write.")
@RequestMapping("/orders")
public interface OrdersController {

    @Operation(
            summary = "List all orders",
            security = @SecurityRequirement(name = "keycloakOAuth2", scopes = "orders:read")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Order list returned successfully",
                    content = @Content(array = @ArraySchema(schema = @Schema(implementation = Order.class)))),
            @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content),
            @ApiResponse(responseCode = "403", description = "Forbidden", content = @Content)
    })
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<List<Order>> getAllOrders();

    @Operation(
            summary = "Create new order",
            security = @SecurityRequirement(name = "keycloakOAuth2", scopes = "orders:write")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Order created successfully",
                    content = @Content(schema = @Schema(implementation = Order.class))),
            @ApiResponse(responseCode = "400", description = "Validation error or insufficient stock", content = @Content),
            @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content),
            @ApiResponse(responseCode = "403", description = "Forbidden", content = @Content)
    })
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<Order> createOrder(@Valid @RequestBody OrderInput orderInput);

    @Operation(
            summary = "Get order by ID",
            security = @SecurityRequirement(name = "keycloakOAuth2", scopes = "orders:read")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Order found",
                    content = @Content(schema = @Schema(implementation = Order.class))),
            @ApiResponse(responseCode = "404", description = "Order not found", content = @Content),
            @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content),
            @ApiResponse(responseCode = "403", description = "Forbidden", content = @Content)
    })
    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<Order> getOrderById(
            @Parameter(description = "Order identifier", required = true)
            @PathVariable Integer id
    );

    @Operation(
            summary = "List orders by customer",
            security = @SecurityRequirement(name = "keycloakOAuth2", scopes = "orders:read")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Orders list returned successfully",
                    content = @Content(array = @ArraySchema(schema = @Schema(implementation = Order.class)))),
            @ApiResponse(responseCode = "404", description = "Customer not found", content = @Content),
            @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content),
            @ApiResponse(responseCode = "403", description = "Forbidden", content = @Content)
    })
    @GetMapping(value = "/customer/{customerId}", produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<List<Order>> getOrdersByCustomer(
            @Parameter(description = "Customer identifier", required = true)
            @PathVariable Integer customerId
    );

    @Operation(
            summary = "Update order status",
            security = @SecurityRequirement(name = "keycloakOAuth2", scopes = "orders:write")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Status updated successfully",
                    content = @Content(schema = @Schema(implementation = Order.class))),
            @ApiResponse(responseCode = "400", description = "Invalid status value", content = @Content),
            @ApiResponse(responseCode = "404", description = "Order not found", content = @Content),
            @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content),
            @ApiResponse(responseCode = "403", description = "Forbidden", content = @Content)
    })
    @PatchMapping(value = "/{id}/status", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<Order> updateOrderStatus(
            @Parameter(description = "Order identifier", required = true)
            @PathVariable Integer id,
            @Valid @RequestBody UpdateOrderStatus updateOrderStatus
    );
}
