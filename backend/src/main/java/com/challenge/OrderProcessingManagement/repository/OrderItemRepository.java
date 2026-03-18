package com.challenge.OrderProcessingManagement.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.challenge.OrderProcessingManagement.model.entity.OrderItemModel;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItemModel, Long> {
    List<OrderItemModel> findByOrderId(Long orderId);
}

