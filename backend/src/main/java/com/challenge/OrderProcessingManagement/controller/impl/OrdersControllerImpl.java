package com.challenge.OrderProcessingManagement.controller.impl;

import com.challenge.OrderProcessingManagement.controller.OrdersController;
import com.challenge.OrderProcessingManagement.model.Order;
import com.challenge.OrderProcessingManagement.model.OrderInput;
import com.challenge.OrderProcessingManagement.model.UpdateOrderStatus;
import com.challenge.OrderProcessingManagement.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class OrdersControllerImpl implements OrdersController {

    private final OrderService orderService;

    @Override
    public ResponseEntity<List<Order>> getAllOrders() {
        return ResponseEntity.ok(orderService.findAllOrders());
    }

    @Override
    public ResponseEntity<Order> createOrder(OrderInput orderInput) {
        return new ResponseEntity<>(orderService.createOrder(orderInput), HttpStatus.CREATED);
    }

    @Override
    public ResponseEntity<Order> getOrderById(Integer id) {
        return ResponseEntity.ok(orderService.findOrderById(id.longValue()));
    }

    @Override
    public ResponseEntity<List<Order>> getOrdersByCustomer(Integer customerId) {
        return ResponseEntity.ok(orderService.findOrdersByCustomerId(customerId.longValue()));
    }

    @Override
    public ResponseEntity<Order> updateOrderStatus(Integer id, UpdateOrderStatus updateOrderStatus) {
        return ResponseEntity.ok(orderService.updateOrderStatus(id.longValue(), updateOrderStatus));
    }
}
