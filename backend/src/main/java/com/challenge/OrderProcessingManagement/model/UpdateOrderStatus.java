package com.challenge.OrderProcessingManagement.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonValue;

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
@Schema(description = "Payload to update an order status")
public class UpdateOrderStatus {

    @NotNull
    @Schema(description = "New order status", requiredMode = Schema.RequiredMode.REQUIRED)
    @JsonProperty("status")
    private StatusEnum status;

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
