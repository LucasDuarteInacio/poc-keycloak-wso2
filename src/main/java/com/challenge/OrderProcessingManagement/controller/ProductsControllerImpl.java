package com.challenge.OrderProcessingManagement.controller;

import com.challenge.OrderProcessingManagement.api.ProductsApi;
import com.challenge.OrderProcessingManagement.api.model.Product;
import com.challenge.OrderProcessingManagement.api.model.ProductInput;
import com.challenge.OrderProcessingManagement.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;

import java.util.List;

@Controller
@RequiredArgsConstructor
public class ProductsControllerImpl implements ProductsApi {

    private final ProductService productService;

    @Override
    public ResponseEntity<List<Product>> getAllProducts() {
        List<Product> products = productService.findAllProducts();
        return ResponseEntity.ok(products);
    }

    @Override
    public ResponseEntity<Product> createProduct(ProductInput productInput) {
        Product product = productService.createProduct(productInput);
        return new ResponseEntity<>(product, HttpStatus.CREATED);
    }

    @Override
    public ResponseEntity<Product> getProductById(Integer id) {
        Product product = productService.findProductById(id.longValue());
        return ResponseEntity.ok(product);
    }

    @Override
    public ResponseEntity<Product> updateProduct(Integer id, ProductInput productInput) {
        Product product = productService.updateProduct(id.longValue(), productInput);
        return ResponseEntity.ok(product);
    }

    @Override
    public ResponseEntity<Void> deleteProduct(Integer id) {
        productService.deleteProduct(id.longValue());
        return ResponseEntity.noContent().build();
    }
}

