package com.challenge.OrderProcessingManagement.model;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonValue;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Order data")
public class Order {

    @Schema(description = "Order identifier")
    @JsonProperty("id")
    private Integer id;

    @Schema(description = "Customer identifier")
    @JsonProperty("customerId")
    private Integer customerId;

    @Schema(description = "Customer name")
    @JsonProperty("customerName")
    private String customerName;

    @Schema(description = "Order status")
    @JsonProperty("status")
    private StatusEnum status;

    @Schema(description = "Total order amount")
    @JsonProperty("totalAmount")
    private BigDecimal totalAmount;

    @Schema(description = "Order items")
    @JsonProperty("items")
    private List<OrderItem> items;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    @Schema(description = "Creation timestamp")
    @JsonProperty("createdAt")
    private OffsetDateTime createdAt;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    @Schema(description = "Last update timestamp")
    @JsonProperty("updatedAt")
    private OffsetDateTime updatedAt;

    public enum StatusEnum {
        PENDING("PENDING"),
        CONFIRMED("CONFIRMED"),
        PREPARING("PREPARING"),
        SHIPPED("SHIPPED"),
        DELIVERED("DELIVERED"),
        CANCELLED("CANCELLED");

        private final String value;

        StatusEnum(String value) {
            this.value = value;
        }

        @JsonValue
        public String getValue() {
            return value;
        }

        @Override
        public String toString() {
            return value;
        }

        @JsonCreator
        public static StatusEnum fromValue(String value) {
            for (StatusEnum b : StatusEnum.values()) {
                if (b.value.equals(value)) {
                    return b;
                }
            }
            throw new IllegalArgumentException("Invalid order status: '" + value + "'");
        }
    }
}
