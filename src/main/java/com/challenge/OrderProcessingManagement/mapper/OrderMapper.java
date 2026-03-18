package com.challenge.OrderProcessingManagement.mapper;

import com.challenge.OrderProcessingManagement.api.model.Order;
import com.challenge.OrderProcessingManagement.api.model.OrderItem;
import com.challenge.OrderProcessingManagement.enums.OrderStatusEnum;
import com.challenge.OrderProcessingManagement.model.OrderItemModel;
import com.challenge.OrderProcessingManagement.model.OrderModel;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring", uses = {BaseMapper.class})
public interface OrderMapper {

    @Mapping(source = "customerId", target = "customerId")
    @Mapping(source = "customer.name", target = "customerName")
    @Mapping(source = "items", target = "items")
    @Mapping(source = "status", target = "status", qualifiedByName = "orderStatusToString")
    @Mapping(source = "createdAt", target = "createdAt", qualifiedByName = "localDateTimeToOffsetDateTime")
    @Mapping(source = "updatedAt", target = "updatedAt", qualifiedByName = "localDateTimeToOffsetDateTime")
    Order toOrder(OrderModel orderModel);

    List<Order> toOrder(List<OrderModel> orderModels);

    @Mapping(source = "productId", target = "productId")
    @Mapping(source = "product.name", target = "productName")
    OrderItem toOrderItem(OrderItemModel orderItemModel);

    List<OrderItem> toOrderItem(List<OrderItemModel> orderItemModels);

    @org.mapstruct.Named("orderStatusToString")
    default String orderStatusToString(OrderStatusEnum status) {
        if (status == null) {
            return null;
        }
        return status.name();
    }
}

