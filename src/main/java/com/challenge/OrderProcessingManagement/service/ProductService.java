package com.challenge.OrderProcessingManagement.service;

import java.util.List;

import com.challenge.OrderProcessingManagement.model.Product;
import com.challenge.OrderProcessingManagement.model.ProductInput;

public interface ProductService {
    List<Product> findAllProducts();

    Product findProductById(Long id);

    Product createProduct(ProductInput productInput);

    Product updateProduct(Long id, ProductInput productInput);

    void deleteProduct(Long id);
}

