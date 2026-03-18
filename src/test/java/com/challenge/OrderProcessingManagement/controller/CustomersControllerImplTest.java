package com.challenge.OrderProcessingManagement.controller;

import com.challenge.OrderProcessingManagement.controller.impl.CustomersControllerImpl;
import com.challenge.OrderProcessingManagement.model.CustomerInput;
import com.challenge.OrderProcessingManagement.model.entity.Customer;
import com.challenge.OrderProcessingManagement.service.CustomerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("CustomersController Tests")
class CustomersControllerImplTest {

    @Mock
    private CustomerService customerService;

    @InjectMocks
    private CustomersControllerImpl customersController;

    private Customer customer;
    private CustomerInput customerInput;

    @BeforeEach
    void setUp() {
        customer = new Customer();
        customer.setId(1);
        customer.setName("João Silva");
        customer.setEmail("joao@email.com");
        customer.setCpf("123.456.789-00");

        customerInput = new CustomerInput();
        customerInput.setName("João Silva");
        customerInput.setEmail("joao@email.com");
        customerInput.setCpf("123.456.789-00");
    }

    @Test
    @DisplayName("Should list all customers successfully")
    void shouldListAllCustomers() {
        // Given
        List<Customer> customers = Arrays.asList(customer);
        when(customerService.findAllCustomers()).thenReturn(customers);

        // When
        ResponseEntity<List<Customer>> response = customersController.getAllCustomers();

        // Then
        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(1, response.getBody().size());
        assertEquals("João Silva", response.getBody().get(0).getName());
        verify(customerService, times(1)).findAllCustomers();
    }

    @Test
    @DisplayName("Should find customer by ID successfully")
    void shouldFindCustomerById() {
        // Given
        Integer customerId = 1;
        when(customerService.findCustomerById(customerId.longValue())).thenReturn(customer);

        // When
        ResponseEntity<Customer> response = customersController.getCustomerById(customerId);

        // Then
        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(1, response.getBody().getId());
        assertEquals("João Silva", response.getBody().getName());
        verify(customerService, times(1)).findCustomerById(customerId.longValue());
    }

    @Test
    @DisplayName("Should create customer successfully")
    void shouldCreateCustomer() {
        // Given
        when(customerService.createCustomer(any(CustomerInput.class))).thenReturn(customer);

        // When
        ResponseEntity<Customer> response = customersController.createCustomer(customerInput);

        // Then
        assertNotNull(response);
        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("João Silva", response.getBody().getName());
        assertEquals("joao@email.com", response.getBody().getEmail());
        verify(customerService, times(1)).createCustomer(eq(customerInput));
    }
}

