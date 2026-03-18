package com.challenge.OrderProcessingManagement.mapper;

import com.challenge.OrderProcessingManagement.api.model.Customer;
import com.challenge.OrderProcessingManagement.api.model.CustomerInput;
import com.challenge.OrderProcessingManagement.model.CustomerModel;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring", uses = {BaseMapper.class})
public interface CustomerMapper {

    @Mapping(source = "createdAt", target = "createdAt", qualifiedByName = "localDateTimeToOffsetDateTime")
    Customer toCustomer(CustomerModel customerModel);

    List<Customer> toCustomer(List<CustomerModel> customerModels);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    CustomerModel toCustomerModel(CustomerInput customerInput);
}
