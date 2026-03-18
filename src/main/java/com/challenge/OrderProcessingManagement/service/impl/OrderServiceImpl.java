package com.challenge.OrderProcessingManagement.service.impl;

import com.challenge.OrderProcessingManagement.api.model.Order;
import com.challenge.OrderProcessingManagement.api.model.OrderInput;
import com.challenge.OrderProcessingManagement.api.model.OrderItemInput;
import com.challenge.OrderProcessingManagement.api.model.UpdateOrderStatus;
import com.challenge.OrderProcessingManagement.enums.OrderStatusEnum;
import com.challenge.OrderProcessingManagement.exception.ResourceNotFoundException;
import com.challenge.OrderProcessingManagement.mapper.OrderMapper;
import com.challenge.OrderProcessingManagement.model.OrderItemModel;
import com.challenge.OrderProcessingManagement.model.OrderModel;
import com.challenge.OrderProcessingManagement.model.ProductModel;
import com.challenge.OrderProcessingManagement.repository.CustomerRepository;
import com.challenge.OrderProcessingManagement.repository.OrderRepository;
import com.challenge.OrderProcessingManagement.repository.ProductRepository;
import com.challenge.OrderProcessingManagement.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;
    private final OrderMapper orderMapper;

    @Override
    @Transactional(readOnly = true)
    public List<Order> findAllOrders() {
        List<OrderModel> orderModels = orderRepository.findAll();
        return orderMapper.toOrder(orderModels);
    }

    @Override
    @Transactional(readOnly = true)
    public Order findOrderById(Long id) {
        OrderModel orderModel = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + id));
        return orderMapper.toOrder(orderModel);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Order> findOrdersByCustomerId(Long customerId) {
        if (!customerRepository.existsById(customerId)) {
            throw new ResourceNotFoundException("Customer not found with id: " + customerId);
        }
        List<OrderModel> orderModels = orderRepository.findByCustomerId(customerId);
        return orderMapper.toOrder(orderModels);
    }

    @Override
    @Transactional
    public Order createOrder(OrderInput orderInput) {
        // Validar se o cliente existe
        if (!customerRepository.existsById(orderInput.getCustomerId().longValue())) {
            throw new ResourceNotFoundException("Customer not found with id: " + orderInput.getCustomerId());
        }

        // Validar itens do pedido
        if (orderInput.getItems() == null || orderInput.getItems().isEmpty()) {
            throw new IllegalArgumentException("Order must have at least one item");
        }

        OrderModel orderModel = new OrderModel();
        orderModel.setCustomerId(orderInput.getCustomerId().longValue());
        orderModel.setStatus(OrderStatusEnum.PENDING);
        orderModel.setItems(new ArrayList<>());

        BigDecimal totalAmount = BigDecimal.ZERO;

        // Processar cada item do pedido
        for (OrderItemInput itemInput : orderInput.getItems()) {
            ProductModel product = productRepository.findById(itemInput.getProductId().longValue())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Product not found with id: " + itemInput.getProductId()));

            // Validar estoque
            if (product.getStockQuantity() < itemInput.getQuantity()) {
                throw new IllegalArgumentException(
                        "Insufficient stock for product: " + product.getName() +
                                ". Available: " + product.getStockQuantity() +
                                ", Requested: " + itemInput.getQuantity());
            }

            // Calcular subtotal
            BigDecimal unitPrice = product.getPrice();
            BigDecimal subtotal = unitPrice.multiply(BigDecimal.valueOf(itemInput.getQuantity()));
            totalAmount = totalAmount.add(subtotal);

            // Criar item do pedido
            OrderItemModel orderItem = new OrderItemModel();
            orderItem.setOrderId(null); // Será definido após salvar o pedido
            orderItem.setProductId(product.getId());
            orderItem.setQuantity(itemInput.getQuantity());
            orderItem.setUnitPrice(unitPrice);
            orderItem.setSubtotal(subtotal);
            orderItem.setOrder(orderModel);

            orderModel.getItems().add(orderItem);

            // Atualizar estoque do produto
            product.setStockQuantity(product.getStockQuantity() - itemInput.getQuantity());
            productRepository.save(product);
        }

        orderModel.setTotalAmount(totalAmount);
        OrderModel savedOrder = orderRepository.save(orderModel);
        // Buscar novamente para garantir que os relacionamentos sejam carregados
        OrderModel orderWithRelations = orderRepository.findById(savedOrder.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found after creation"));
        return orderMapper.toOrder(orderWithRelations);
    }

    @Override
    @Transactional
    public Order updateOrderStatus(Long id, UpdateOrderStatus updateOrderStatus) {
        OrderModel orderModel = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + id));

        try {
            OrderStatusEnum newStatus = OrderStatusEnum.valueOf(updateOrderStatus.getStatus().toString());
            orderModel.setStatus(newStatus);
            OrderModel updatedOrder = orderRepository.save(orderModel);
            return orderMapper.toOrder(updatedOrder);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid order status: " + updateOrderStatus.getStatus());
        }
    }
}

