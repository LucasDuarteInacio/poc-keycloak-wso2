package com.challenge.OrderProcessingManagement.service;

import java.util.List;

import com.challenge.OrderProcessingManagement.model.Order;
import com.challenge.OrderProcessingManagement.model.OrderInput;
import com.challenge.OrderProcessingManagement.model.UpdateOrderStatus;

public interface OrderService {
    List<Order> findAllOrders();

    Order findOrderById(Long id);

    List<Order> findOrdersByCustomerId(Long customerId);

    Order createOrder(OrderInput orderInput);

    Order updateOrderStatus(Long id, UpdateOrderStatus updateOrderStatus);
}

