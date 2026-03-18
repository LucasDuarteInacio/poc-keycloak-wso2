package com.challenge.OrderProcessingManagement.model;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import org.springframework.format.annotation.DateTimeFormat;

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
@Schema(description = "Product data")
public class Product {

    @Schema(description = "Product identifier")
    @JsonProperty("id")
    private Integer id;

    @Schema(description = "Product name")
    @JsonProperty("name")
    private String name;

    @Schema(description = "Product description")
    @JsonProperty("description")
    private String description;

    @Schema(description = "Unit price")
    @JsonProperty("price")
    private BigDecimal price;

    @Schema(description = "Available stock quantity")
    @JsonProperty("stockQuantity")
    private Integer stockQuantity;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    @Schema(description = "Creation timestamp")
    @JsonProperty("createdAt")
    private OffsetDateTime createdAt;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    @Schema(description = "Last update timestamp")
    @JsonProperty("updatedAt")
    private OffsetDateTime updatedAt;
}
