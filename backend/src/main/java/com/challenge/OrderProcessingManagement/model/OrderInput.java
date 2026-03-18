package com.challenge.OrderProcessingManagement.model;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Payload to create an order")
public class OrderInput {

    @NotNull
    @Schema(description = "Customer identifier", requiredMode = Schema.RequiredMode.REQUIRED)
    @JsonProperty("customerId")
    private Integer customerId;

    @NotNull
    @Valid
    @Schema(description = "List of items in the order", requiredMode = Schema.RequiredMode.REQUIRED)
    @JsonProperty("items")
    private List<OrderItemInput> items;
}
