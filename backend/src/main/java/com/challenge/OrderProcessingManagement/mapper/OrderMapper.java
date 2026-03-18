package com.challenge.OrderProcessingManagement.mapper;

import java.util.List;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import com.challenge.OrderProcessingManagement.enums.OrderStatusEnum;
import com.challenge.OrderProcessingManagement.model.Order;
import com.challenge.OrderProcessingManagement.model.OrderItem;
import com.challenge.OrderProcessingManagement.model.entity.OrderItemModel;
import com.challenge.OrderProcessingManagement.model.entity.OrderModel;

@Mapper(componentModel = "spring", uses = {BaseMapper.class})
public interface OrderMapper {

    @Mapping(source = "customerId", target = "customerId")
    @Mapping(source = "customer.name", target = "customerName")
    @Mapping(source = "items", target = "items")
    @Mapping(source = "status", target = "status", qualifiedByName = "orderStatusToStatusEnum")
    @Mapping(source = "createdAt", target = "createdAt", qualifiedByName = "localDateTimeToOffsetDateTime")
    @Mapping(source = "updatedAt", target = "updatedAt", qualifiedByName = "localDateTimeToOffsetDateTime")
    Order toOrder(OrderModel orderModel);

    List<Order> toOrder(List<OrderModel> orderModels);

    @Mapping(source = "productId", target = "productId")
    @Mapping(source = "product.name", target = "productName")
    OrderItem toOrderItem(OrderItemModel orderItemModel);

    List<OrderItem> toOrderItem(List<OrderItemModel> orderItemModels);

    @org.mapstruct.Named("orderStatusToStatusEnum")
    default Order.StatusEnum orderStatusToStatusEnum(OrderStatusEnum status) {
        if (status == null) {
            return null;
        }
        return Order.StatusEnum.fromValue(status.name());
    }
}

