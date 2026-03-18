package com.challenge.OrderProcessingManagement.service;

import com.challenge.OrderProcessingManagement.api.model.Order;
import com.challenge.OrderProcessingManagement.api.model.OrderInput;
import com.challenge.OrderProcessingManagement.api.model.UpdateOrderStatus;

import java.util.List;

public interface OrderService {
    List<Order> findAllOrders();

    Order findOrderById(Long id);

    List<Order> findOrdersByCustomerId(Long customerId);

    Order createOrder(OrderInput orderInput);

    Order updateOrderStatus(Long id, UpdateOrderStatus updateOrderStatus);
}

