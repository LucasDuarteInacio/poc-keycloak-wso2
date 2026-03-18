package com.challenge.OrderProcessingManagement.model;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonProperty;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Payload to create or update a product")
public class ProductInput {

    @NotNull
    @Schema(description = "Product name", requiredMode = Schema.RequiredMode.REQUIRED)
    @JsonProperty("name")
    private String name;

    @Schema(description = "Product description")
    @JsonProperty("description")
    private String description;

    @NotNull
    @Schema(description = "Unit price", requiredMode = Schema.RequiredMode.REQUIRED)
    @JsonProperty("price")
    private BigDecimal price;

    @NotNull
    @Schema(description = "Available stock quantity", requiredMode = Schema.RequiredMode.REQUIRED)
    @JsonProperty("stockQuantity")
    private Integer stockQuantity;
}
