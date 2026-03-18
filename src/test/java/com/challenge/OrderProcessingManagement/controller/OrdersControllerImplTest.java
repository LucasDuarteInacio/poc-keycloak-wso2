package com.challenge.OrderProcessingManagement.controller;

import com.challenge.OrderProcessingManagement.api.model.Order;
import com.challenge.OrderProcessingManagement.api.model.OrderInput;
import com.challenge.OrderProcessingManagement.api.model.OrderItemInput;
import com.challenge.OrderProcessingManagement.api.model.UpdateOrderStatus;
import com.challenge.OrderProcessingManagement.service.OrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("OrdersController Tests")
class OrdersControllerImplTest {

    @Mock
    private OrderService orderService;

    @InjectMocks
    private OrdersControllerImpl ordersController;

    private Order order;
    private OrderInput orderInput;
    private UpdateOrderStatus updateOrderStatus;

    @BeforeEach
    void setUp() {
        order = new Order();
        order.setId(1);
        order.setCustomerId(1);
        order.setCustomerName("João Silva");
        order.setStatus(Order.StatusEnum.PENDING);
        order.setTotalAmount(new BigDecimal("2999.99"));

        orderInput = new OrderInput();
        orderInput.setCustomerId(1);
        OrderItemInput itemInput = new OrderItemInput();
        itemInput.setProductId(1);
        itemInput.setQuantity(1);
        orderInput.setItems(Arrays.asList(itemInput));

        updateOrderStatus = new UpdateOrderStatus();
        updateOrderStatus.setStatus(UpdateOrderStatus.StatusEnum.CONFIRMED);
    }

    @Test
    @DisplayName("Should list all orders successfully")
    void shouldListAllOrders() {
        // Given
        List<Order> orders = Arrays.asList(order);
        when(orderService.findAllOrders()).thenReturn(orders);

        // When
        ResponseEntity<List<Order>> response = ordersController.getAllOrders();

        // Then
        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(1, response.getBody().size());
        assertEquals(1, response.getBody().get(0).getId());
        verify(orderService, times(1)).findAllOrders();
    }

    @Test
    @DisplayName("Should find order by ID successfully")
    void shouldFindOrderById() {
        // Given
        Integer orderId = 1;
        when(orderService.findOrderById(orderId.longValue())).thenReturn(order);

        // When
        ResponseEntity<Order> response = ordersController.getOrderById(orderId);

        // Then
        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(1, response.getBody().getId());
        verify(orderService, times(1)).findOrderById(orderId.longValue());
    }

    @Test
    @DisplayName("Should find orders by customer successfully")
    void shouldFindOrdersByCustomer() {
        // Given
        Integer customerId = 1;
        List<Order> orders = Arrays.asList(order);
        when(orderService.findOrdersByCustomerId(customerId.longValue())).thenReturn(orders);

        // When
        ResponseEntity<List<Order>> response = ordersController.getOrdersByCustomer(customerId);

        // Then
        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(1, response.getBody().size());
        verify(orderService, times(1)).findOrdersByCustomerId(customerId.longValue());
    }

    @Test
    @DisplayName("Should create order successfully")
    void shouldCreateOrder() {
        // Given
        when(orderService.createOrder(any(OrderInput.class))).thenReturn(order);

        // When
        ResponseEntity<Order> response = ordersController.createOrder(orderInput);

        // Then
        assertNotNull(response);
        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(1, response.getBody().getId());
        verify(orderService, times(1)).createOrder(eq(orderInput));
    }

    @Test
    @DisplayName("Should update order status successfully")
    void shouldUpdateOrderStatus() {
        // Given
        Integer orderId = 1;
        Order updatedOrder = new Order();
        updatedOrder.setId(1);
        updatedOrder.setStatus(Order.StatusEnum.CONFIRMED);

        when(orderService.updateOrderStatus(eq(orderId.longValue()), any(UpdateOrderStatus.class)))
                .thenReturn(updatedOrder);

        // When
        ResponseEntity<Order> response = ordersController.updateOrderStatus(orderId, updateOrderStatus);

        // Then
        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(Order.StatusEnum.CONFIRMED, response.getBody().getStatus());
        verify(orderService, times(1)).updateOrderStatus(eq(orderId.longValue()), eq(updateOrderStatus));
    }
}

