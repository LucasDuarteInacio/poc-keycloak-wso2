package com.challenge.OrderProcessingManagement.service;

import com.challenge.OrderProcessingManagement.api.model.Product;
import com.challenge.OrderProcessingManagement.api.model.ProductInput;

import java.util.List;

public interface ProductService {
    List<Product> findAllProducts();

    Product findProductById(Long id);

    Product createProduct(ProductInput productInput);

    Product updateProduct(Long id, ProductInput productInput);

    void deleteProduct(Long id);
}

