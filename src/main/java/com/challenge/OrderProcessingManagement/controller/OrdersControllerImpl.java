package com.challenge.OrderProcessingManagement.controller;

import com.challenge.OrderProcessingManagement.api.OrdersApi;
import com.challenge.OrderProcessingManagement.api.model.Order;
import com.challenge.OrderProcessingManagement.api.model.OrderInput;
import com.challenge.OrderProcessingManagement.api.model.UpdateOrderStatus;
import com.challenge.OrderProcessingManagement.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;

import java.util.List;

@Controller
@RequiredArgsConstructor
public class OrdersControllerImpl implements OrdersApi {

    private final OrderService orderService;

    @Override
    public ResponseEntity<List<Order>> getAllOrders() {
        List<Order> orders = orderService.findAllOrders();
        return ResponseEntity.ok(orders);
    }

    @Override
    public ResponseEntity<Order> createOrder(OrderInput orderInput) {
        Order order = orderService.createOrder(orderInput);
        return new ResponseEntity<>(order, HttpStatus.CREATED);
    }

    @Override
    public ResponseEntity<Order> getOrderById(Integer id) {
        Order order = orderService.findOrderById(id.longValue());
        return ResponseEntity.ok(order);
    }

    @Override
    public ResponseEntity<List<Order>> getOrdersByCustomer(Integer customerId) {
        List<Order> orders = orderService.findOrdersByCustomerId(customerId.longValue());
        return ResponseEntity.ok(orders);
    }

    @Override
    public ResponseEntity<Order> updateOrderStatus(Integer id, UpdateOrderStatus updateOrderStatus) {
        Order order = orderService.updateOrderStatus(id.longValue(), updateOrderStatus);
        return ResponseEntity.ok(order);
    }
}

