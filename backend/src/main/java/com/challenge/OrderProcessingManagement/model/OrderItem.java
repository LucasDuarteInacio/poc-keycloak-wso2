package com.challenge.OrderProcessingManagement.model;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonProperty;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Item within an order")
public class OrderItem {

    @Schema(description = "Item identifier")
    @JsonProperty("id")
    private Integer id;

    @Schema(description = "Product identifier")
    @JsonProperty("productId")
    private Integer productId;

    @Schema(description = "Product name at the time of the order")
    @JsonProperty("productName")
    private String productName;

    @Schema(description = "Quantity ordered")
    @JsonProperty("quantity")
    private Integer quantity;

    @Schema(description = "Unit price at the time of the order")
    @JsonProperty("unitPrice")
    private BigDecimal unitPrice;

    @Schema(description = "Subtotal for this item (quantity × unitPrice)")
    @JsonProperty("subtotal")
    private BigDecimal subtotal;
}
