package com.challenge.OrderProcessingManagement.repository;

import com.challenge.OrderProcessingManagement.model.OrderModel;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<OrderModel, Long> {

    @EntityGraph(attributePaths = {"items", "items.product", "customer"})
    List<OrderModel> findAll();

    @EntityGraph(attributePaths = {"items", "items.product", "customer"})
    Optional<OrderModel> findById(Long id);

    @EntityGraph(attributePaths = {"items", "items.product", "customer"})
    List<OrderModel> findByCustomerId(Long customerId);
}

