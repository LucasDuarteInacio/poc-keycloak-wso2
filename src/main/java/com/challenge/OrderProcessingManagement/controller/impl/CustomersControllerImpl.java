package com.challenge.OrderProcessingManagement.controller.impl;

import com.challenge.OrderProcessingManagement.controller.CustomersController;
import com.challenge.OrderProcessingManagement.model.CustomerInput;
import com.challenge.OrderProcessingManagement.model.entity.Customer;
import com.challenge.OrderProcessingManagement.service.CustomerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class CustomersControllerImpl implements CustomersController {

    private final CustomerService customerService;

    @Override
    public ResponseEntity<List<Customer>> getAllCustomers() {
        return ResponseEntity.ok(customerService.findAllCustomers());
    }

    @Override
    public ResponseEntity<Customer> createCustomer(CustomerInput customerInput) {
        return new ResponseEntity<>(customerService.createCustomer(customerInput), HttpStatus.CREATED);
    }

    @Override
    public ResponseEntity<Customer> getCustomerById(Integer id) {
        return ResponseEntity.ok(customerService.findCustomerById(id.longValue()));
    }
}
