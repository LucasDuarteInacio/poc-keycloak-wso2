package com.challenge.OrderProcessingManagement.service.impl;

import com.challenge.OrderProcessingManagement.exception.ResourceNotFoundException;
import com.challenge.OrderProcessingManagement.mapper.CustomerMapper;
import com.challenge.OrderProcessingManagement.model.CustomerInput;
import com.challenge.OrderProcessingManagement.model.CustomerModel;
import com.challenge.OrderProcessingManagement.model.entity.Customer;
import com.challenge.OrderProcessingManagement.repository.CustomerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("CustomerService Tests")
class CustomerServiceImplTest {

    @Mock
    private CustomerRepository customerRepository;

    @Mock
    private CustomerMapper customerMapper;

    @InjectMocks
    private CustomerServiceImpl customerService;

    private CustomerModel customerModel;
    private Customer customer;
    private CustomerInput customerInput;

    @BeforeEach
    void setUp() {
        customerModel = new CustomerModel();
        customerModel.setId(1L);
        customerModel.setName("João Silva");
        customerModel.setEmail("joao@email.com");
        customerModel.setCpf("123.456.789-00");
        customerModel.setCreatedAt(LocalDateTime.now());

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
        List<CustomerModel> customerModels = Arrays.asList(customerModel);
        List<Customer> customers = Arrays.asList(customer);

        when(customerRepository.findAll()).thenReturn(customerModels);
        when(customerMapper.toCustomer(customerModels)).thenReturn(customers);

        // When
        List<Customer> result = customerService.findAllCustomers();

        // Then
        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("João Silva", result.get(0).getName());
        verify(customerRepository, times(1)).findAll();
        verify(customerMapper, times(1)).toCustomer(customerModels);
    }

    @Test
    @DisplayName("Should find customer by ID successfully")
    void shouldFindCustomerById() {
        // Given
        Long customerId = 1L;
        when(customerRepository.findById(customerId)).thenReturn(Optional.of(customerModel));
        when(customerMapper.toCustomer(customerModel)).thenReturn(customer);

        // When
        Customer result = customerService.findCustomerById(customerId);

        // Then
        assertNotNull(result);
        assertEquals(1, result.getId());
        assertEquals("João Silva", result.getName());
        assertEquals("joao@email.com", result.getEmail());
        verify(customerRepository, times(1)).findById(customerId);
        verify(customerMapper, times(1)).toCustomer(customerModel);
    }

    @Test
    @DisplayName("Should throw exception when customer not found by ID")
    void shouldThrowExceptionWhenCustomerNotFound() {
        // Given
        Long customerId = 999L;
        when(customerRepository.findById(customerId)).thenReturn(Optional.empty());

        // When & Then
        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> customerService.findCustomerById(customerId)
        );

        assertEquals("Customer not found with id: 999", exception.getMessage());
        verify(customerRepository, times(1)).findById(customerId);

    }

    @Test
    @DisplayName("Should create customer successfully")
    void shouldCreateCustomer() {
        // Given
        when(customerMapper.toCustomerModel(customerInput)).thenReturn(customerModel);
        when(customerRepository.save(customerModel)).thenReturn(customerModel);
        when(customerMapper.toCustomer(customerModel)).thenReturn(customer);

        // When
        Customer result = customerService.createCustomer(customerInput);

        // Then
        assertNotNull(result);
        assertEquals("João Silva", result.getName());
        assertEquals("joao@email.com", result.getEmail());
        verify(customerMapper, times(1)).toCustomerModel(customerInput);
        verify(customerRepository, times(1)).save(customerModel);
        verify(customerMapper, times(1)).toCustomer(customerModel);
    }
}

