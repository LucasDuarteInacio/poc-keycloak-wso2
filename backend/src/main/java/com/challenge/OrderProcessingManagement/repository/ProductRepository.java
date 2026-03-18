package com.challenge.OrderProcessingManagement.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.challenge.OrderProcessingManagement.model.entity.ProductModel;

@Repository
public interface ProductRepository extends JpaRepository<ProductModel, Long> {
}

