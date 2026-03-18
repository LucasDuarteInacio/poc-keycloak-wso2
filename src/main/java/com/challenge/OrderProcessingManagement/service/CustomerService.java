package com.challenge.OrderProcessingManagement.service;

import com.challenge.OrderProcessingManagement.api.model.Customer;
import com.challenge.OrderProcessingManagement.api.model.CustomerInput;

import java.util.List;

public interface CustomerService {
    List<Customer> findAllCustomers();

    Customer findCustomerById(Long id);

    Customer createCustomer(CustomerInput customerInput);
}
