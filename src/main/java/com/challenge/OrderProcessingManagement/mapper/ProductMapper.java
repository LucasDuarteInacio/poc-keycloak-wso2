package com.challenge.OrderProcessingManagement.mapper;

import com.challenge.OrderProcessingManagement.api.model.Product;
import com.challenge.OrderProcessingManagement.api.model.ProductInput;
import com.challenge.OrderProcessingManagement.model.ProductModel;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring", uses = {BaseMapper.class})
public interface ProductMapper {

    @Mapping(source = "createdAt", target = "createdAt", qualifiedByName = "localDateTimeToOffsetDateTime")
    @Mapping(source = "updatedAt", target = "updatedAt", qualifiedByName = "localDateTimeToOffsetDateTime")
    Product toProduct(ProductModel productModel);

    List<Product> toProduct(List<ProductModel> productModels);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    ProductModel toProductModel(ProductInput productInput);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    void updateProductModelFromInput(ProductInput productInput, @org.mapstruct.MappingTarget ProductModel productModel);
}

