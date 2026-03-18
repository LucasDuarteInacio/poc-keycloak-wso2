package com.challenge.OrderProcessingManagement.repository;

import com.challenge.OrderProcessingManagement.model.CustomerModel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CustomerRepository extends JpaRepository<CustomerModel, Long> {

}

