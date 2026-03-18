package com.challenge.OrderProcessingManagement.service.impl;

import com.challenge.OrderProcessingManagement.api.model.Order;
import com.challenge.OrderProcessingManagement.api.model.OrderInput;
import com.challenge.OrderProcessingManagement.api.model.OrderItemInput;
import com.challenge.OrderProcessingManagement.api.model.UpdateOrderStatus;
import com.challenge.OrderProcessingManagement.enums.OrderStatusEnum;
import com.challenge.OrderProcessingManagement.exception.ResourceNotFoundException;
import com.challenge.OrderProcessingManagement.mapper.OrderMapper;
import com.challenge.OrderProcessingManagement.model.CustomerModel;
import com.challenge.OrderProcessingManagement.model.OrderModel;
import com.challenge.OrderProcessingManagement.model.ProductModel;
import com.challenge.OrderProcessingManagement.repository.CustomerRepository;
import com.challenge.OrderProcessingManagement.repository.OrderRepository;
import com.challenge.OrderProcessingManagement.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("OrderService Tests")
class OrderServiceImplTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private CustomerRepository customerRepository;

    @Mock
    private OrderMapper orderMapper;

    @InjectMocks
    private OrderServiceImpl orderService;

    private OrderModel orderModel;
    private Order order;
    private OrderInput orderInput;
    private ProductModel productModel;
    private CustomerModel customerModel;

    @BeforeEach
    void setUp() {
        customerModel = new CustomerModel();
        customerModel.setId(1L);
        customerModel.setName("João Silva");
        customerModel.setEmail("joao@email.com");
        customerModel.setCpf("123.456.789-00");

        productModel = new ProductModel();
        productModel.setId(1L);
        productModel.setName("Notebook");
        productModel.setPrice(new BigDecimal("2999.99"));
        productModel.setStockQuantity(10);

        orderModel = new OrderModel();
        orderModel.setId(1L);
        orderModel.setCustomerId(1L);
        orderModel.setCustomer(customerModel);
        orderModel.setStatus(OrderStatusEnum.PENDING);
        orderModel.setTotalAmount(new BigDecimal("2999.99"));
        orderModel.setCreatedAt(LocalDateTime.now());
        orderModel.setUpdatedAt(LocalDateTime.now());

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
    }

    @Test
    @DisplayName("Should list all orders successfully")
    void shouldListAllOrders() {
        // Given
        List<OrderModel> orderModels = Arrays.asList(orderModel);
        List<Order> orders = Arrays.asList(order);

        when(orderRepository.findAll()).thenReturn(orderModels);
        when(orderMapper.toOrder(orderModels)).thenReturn(orders);

        // When
        List<Order> result = orderService.findAllOrders();

        // Then
        assertNotNull(result);
        assertEquals(1, result.size());
        verify(orderRepository, times(1)).findAll();
        verify(orderMapper, times(1)).toOrder(orderModels);
    }

    @Test
    @DisplayName("Should find order by ID successfully")
    void shouldFindOrderById() {
        // Given
        Long orderId = 1L;
        when(orderRepository.findById(orderId)).thenReturn(Optional.of(orderModel));
        when(orderMapper.toOrder(orderModel)).thenReturn(order);

        // When
        Order result = orderService.findOrderById(orderId);

        // Then
        assertNotNull(result);
        assertEquals(1, result.getId());
        verify(orderRepository, times(1)).findById(orderId);
        verify(orderMapper, times(1)).toOrder(orderModel);
    }

    @Test
    @DisplayName("Should throw exception when order not found by ID")
    void shouldThrowExceptionWhenOrderNotFound() {
        // Given
        Long orderId = 999L;
        when(orderRepository.findById(orderId)).thenReturn(Optional.empty());

        // When & Then
        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> orderService.findOrderById(orderId)
        );

        assertEquals("Order not found with id: 999", exception.getMessage());
        verify(orderRepository, times(1)).findById(orderId);
    }

    @Test
    @DisplayName("Should find orders by customer successfully")
    void shouldFindOrdersByCustomer() {
        // Given
        Long customerId = 1L;
        List<OrderModel> orderModels = Arrays.asList(orderModel);
        List<Order> orders = Arrays.asList(order);

        when(customerRepository.existsById(customerId)).thenReturn(true);
        when(orderRepository.findByCustomerId(customerId)).thenReturn(orderModels);
        when(orderMapper.toOrder(orderModels)).thenReturn(orders);

        // When
        List<Order> result = orderService.findOrdersByCustomerId(customerId);

        // Then
        assertNotNull(result);
        assertEquals(1, result.size());
        verify(customerRepository, times(1)).existsById(customerId);
        verify(orderRepository, times(1)).findByCustomerId(customerId);
    }

    @Test
    @DisplayName("Should throw exception when finding orders for non-existent customer")
    void shouldThrowExceptionWhenFindingOrdersForNonExistentCustomer() {
        // Given
        Long customerId = 999L;
        when(customerRepository.existsById(customerId)).thenReturn(false);

        // When & Then
        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> orderService.findOrdersByCustomerId(customerId)
        );

        assertEquals("Customer not found with id: 999", exception.getMessage());
        verify(customerRepository, times(1)).existsById(customerId);
        verify(orderRepository, never()).findByCustomerId(any());
    }

    @Test
    @DisplayName("Should create order successfully")
    void shouldCreateOrder() {
        // Given
        when(customerRepository.existsById(1L)).thenReturn(true);
        when(productRepository.findById(1L)).thenReturn(Optional.of(productModel));
        when(orderRepository.save(any(OrderModel.class))).thenReturn(orderModel);
        when(orderRepository.findById(1L)).thenReturn(Optional.of(orderModel));
        when(orderMapper.toOrder(orderModel)).thenReturn(order);

        // When
        Order result = orderService.createOrder(orderInput);

        // Then
        assertNotNull(result);
        verify(customerRepository, times(1)).existsById(1L);
        verify(productRepository, times(1)).findById(1L);
        verify(productRepository, times(1)).save(any(ProductModel.class));
        verify(orderRepository, times(1)).save(any(OrderModel.class));
        verify(orderRepository, times(1)).findById(1L);
    }

    @Test
    @DisplayName("Should throw exception when creating order with non-existent customer")
    void shouldThrowExceptionWhenCreatingOrderWithNonExistentCustomer() {
        // Given
        when(customerRepository.existsById(1L)).thenReturn(false);

        // When & Then
        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> orderService.createOrder(orderInput)
        );

        assertEquals("Customer not found with id: 1", exception.getMessage());
        verify(customerRepository, times(1)).existsById(1L);
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should throw exception when creating order without items")
    void shouldThrowExceptionWhenCreatingOrderWithoutItems() {
        // Given
        OrderInput emptyOrderInput = new OrderInput();
        emptyOrderInput.setCustomerId(1);
        emptyOrderInput.setItems(null);

        when(customerRepository.existsById(1L)).thenReturn(true);

        // When & Then
        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> orderService.createOrder(emptyOrderInput)
        );

        assertEquals("Order must have at least one item", exception.getMessage());
        verify(customerRepository, times(1)).existsById(1L);
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should throw exception when creating order with non-existent product")
    void shouldThrowExceptionWhenCreatingOrderWithNonExistentProduct() {
        // Given
        when(customerRepository.existsById(1L)).thenReturn(true);
        when(productRepository.findById(1L)).thenReturn(Optional.empty());

        // When & Then
        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> orderService.createOrder(orderInput)
        );

        assertEquals("Product not found with id: 1", exception.getMessage());
        verify(customerRepository, times(1)).existsById(1L);
        verify(productRepository, times(1)).findById(1L);
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should throw exception when creating order with insufficient stock")
    void shouldThrowExceptionWhenCreatingOrderWithInsufficientStock() {
        // Given
        productModel.setStockQuantity(5);
        OrderItemInput itemInput = new OrderItemInput();
        itemInput.setProductId(1);
        itemInput.setQuantity(10); // Quantity greater than stock
        orderInput.setItems(Arrays.asList(itemInput));

        when(customerRepository.existsById(1L)).thenReturn(true);
        when(productRepository.findById(1L)).thenReturn(Optional.of(productModel));

        // When & Then
        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> orderService.createOrder(orderInput)
        );

        assertTrue(exception.getMessage().contains("Insufficient stock"));
        verify(customerRepository, times(1)).existsById(1L);
        verify(productRepository, times(1)).findById(1L);
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should update order status successfully")
    void shouldUpdateOrderStatus() {
        // Given
        Long orderId = 1L;
        UpdateOrderStatus updateOrderStatus = new UpdateOrderStatus();
        updateOrderStatus.setStatus(UpdateOrderStatus.StatusEnum.CONFIRMED);

        OrderModel updatedOrderModel = new OrderModel();
        updatedOrderModel.setId(1L);
        updatedOrderModel.setStatus(OrderStatusEnum.CONFIRMED);

        Order updatedOrder = new Order();
        updatedOrder.setId(1);
        updatedOrder.setStatus(Order.StatusEnum.CONFIRMED);

        when(orderRepository.findById(orderId)).thenReturn(Optional.of(orderModel));
        when(orderRepository.save(any(OrderModel.class))).thenReturn(updatedOrderModel);
        when(orderMapper.toOrder(any(OrderModel.class))).thenReturn(updatedOrder);

        // When
        Order result = orderService.updateOrderStatus(orderId, updateOrderStatus);

        // Then
        assertNotNull(result);
        assertEquals(Order.StatusEnum.CONFIRMED, result.getStatus());
        verify(orderRepository, times(1)).findById(orderId);
        verify(orderRepository, times(1)).save(any(OrderModel.class));
        verify(orderMapper, times(1)).toOrder(any(OrderModel.class));
    }

    @Test
    @DisplayName("Should throw exception when updating status of non-existent order")
    void shouldThrowExceptionWhenUpdatingStatusOfNonExistentOrder() {
        // Given
        Long orderId = 999L;
        UpdateOrderStatus updateOrderStatus = new UpdateOrderStatus();
        updateOrderStatus.setStatus(UpdateOrderStatus.StatusEnum.CONFIRMED);

        when(orderRepository.findById(orderId)).thenReturn(Optional.empty());

        // When & Then
        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> orderService.updateOrderStatus(orderId, updateOrderStatus)
        );

        assertEquals("Order not found with id: 999", exception.getMessage());
        verify(orderRepository, times(1)).findById(orderId);
        verify(orderRepository, never()).save(any());
    }
}

