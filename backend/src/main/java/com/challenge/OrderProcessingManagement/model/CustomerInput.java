package com.challenge.OrderProcessingManagement.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Payload to create a customer")
public class CustomerInput {

    @NotNull
    @Schema(description = "Full name", requiredMode = Schema.RequiredMode.REQUIRED)
    @JsonProperty("name")
    private String name;

    @NotNull
    @Email
    @Schema(description = "Email address", requiredMode = Schema.RequiredMode.REQUIRED)
    @JsonProperty("email")
    private String email;

    @NotNull
    @Schema(description = "CPF document number", requiredMode = Schema.RequiredMode.REQUIRED)
    @JsonProperty("cpf")
    private String cpf;
}
