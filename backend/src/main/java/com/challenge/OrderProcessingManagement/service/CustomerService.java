package com.challenge.OrderProcessingManagement.service;

import java.util.List;

import com.challenge.OrderProcessingManagement.model.CustomerInput;
import com.challenge.OrderProcessingManagement.model.entity.Customer;

public interface CustomerService {
    List<Customer> findAllCustomers();

    Customer findCustomerById(Long id);

    Customer createCustomer(CustomerInput customerInput);
}
