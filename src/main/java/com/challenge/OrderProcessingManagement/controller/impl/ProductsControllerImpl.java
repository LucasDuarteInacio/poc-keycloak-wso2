package com.challenge.OrderProcessingManagement.controller.impl;

import com.challenge.OrderProcessingManagement.controller.ProductsController;
import com.challenge.OrderProcessingManagement.model.Product;
import com.challenge.OrderProcessingManagement.model.ProductInput;
import com.challenge.OrderProcessingManagement.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class ProductsControllerImpl implements ProductsController {

    private final ProductService productService;

    @Override
    public ResponseEntity<List<Product>> getAllProducts() {
        return ResponseEntity.ok(productService.findAllProducts());
    }

    @Override
    public ResponseEntity<Product> createProduct(ProductInput productInput) {
        return new ResponseEntity<>(productService.createProduct(productInput), HttpStatus.CREATED);
    }

    @Override
    public ResponseEntity<Product> getProductById(Integer id) {
        return ResponseEntity.ok(productService.findProductById(id.longValue()));
    }

    @Override
    public ResponseEntity<Product> updateProduct(Integer id, ProductInput productInput) {
        return ResponseEntity.ok(productService.updateProduct(id.longValue(), productInput));
    }

    @Override
    public ResponseEntity<Void> deleteProduct(Integer id) {
        productService.deleteProduct(id.longValue());
        return ResponseEntity.noContent().build();
    }
}
