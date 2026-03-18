package com.challenge.OrderProcessingManagement.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Item to add to an order")
public class OrderItemInput {

    @NotNull
    @Schema(description = "Product identifier", requiredMode = Schema.RequiredMode.REQUIRED)
    @JsonProperty("productId")
    private Integer productId;

    @NotNull
    @Min(1)
    @Schema(description = "Quantity to order", requiredMode = Schema.RequiredMode.REQUIRED)
    @JsonProperty("quantity")
    private Integer quantity;
}
