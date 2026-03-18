package com.challenge.OrderProcessingManagement.model.entity;

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
@Schema(description = "Customer data")
public class Customer {

    @Schema(description = "Customer identifier")
    @JsonProperty("id")
    private Integer id;

    @Schema(description = "Full name")
    @JsonProperty("name")
    private String name;

    @Schema(description = "Email address")
    @JsonProperty("email")
    private String email;

    @Schema(description = "CPF document number")
    @JsonProperty("cpf")
    private String cpf;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    @Schema(description = "Creation timestamp")
    @JsonProperty("createdAt")
    private OffsetDateTime createdAt;
}
