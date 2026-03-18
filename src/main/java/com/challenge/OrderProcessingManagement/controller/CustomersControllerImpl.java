package com.challenge.OrderProcessingManagement.controller;

import com.challenge.OrderProcessingManagement.api.CustomersApi;
import com.challenge.OrderProcessingManagement.api.model.Customer;
import com.challenge.OrderProcessingManagement.api.model.CustomerInput;
import com.challenge.OrderProcessingManagement.service.CustomerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;

import java.util.List;

@Controller
@RequiredArgsConstructor
public class CustomersControllerImpl implements CustomersApi {

    private final CustomerService customerService;

    @Override
    public ResponseEntity<List<Customer>> getAllCustomers() {
        List<Customer> customers = customerService.findAllCustomers();
        return ResponseEntity.ok(customers);
    }

    @Override
    public ResponseEntity<Customer> createCustomer(CustomerInput customerInput) {
        Customer customer = customerService.createCustomer(customerInput);
        return new ResponseEntity<>(customer, HttpStatus.CREATED);
    }

    @Override
    public ResponseEntity<Customer> getCustomerById(Integer id) {
        Customer customer = customerService.findCustomerById(id.longValue());
        return ResponseEntity.ok(customer);
    }
}
