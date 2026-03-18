package com.challenge.OrderProcessingManagement.service.impl;

import com.challenge.OrderProcessingManagement.api.model.Product;
import com.challenge.OrderProcessingManagement.api.model.ProductInput;
import com.challenge.OrderProcessingManagement.exception.ResourceNotFoundException;
import com.challenge.OrderProcessingManagement.mapper.ProductMapper;
import com.challenge.OrderProcessingManagement.model.ProductModel;
import com.challenge.OrderProcessingManagement.repository.ProductRepository;
import com.challenge.OrderProcessingManagement.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProductServiceImpl implements ProductService {

    private final ProductRepository productRepository;
    private final ProductMapper productMapper;

    @Override
    @Transactional(readOnly = true)
    public List<Product> findAllProducts() {
        List<ProductModel> productModels = productRepository.findAll();
        return productMapper.toProduct(productModels);
    }

    @Override
    @Transactional(readOnly = true)
    public Product findProductById(Long id) {
        ProductModel productModel = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + id));
        return productMapper.toProduct(productModel);
    }

    @Override
    @Transactional
    public Product createProduct(ProductInput productInput) {
        ProductModel productModel = productMapper.toProductModel(productInput);
        ProductModel savedProduct = productRepository.save(productModel);
        return productMapper.toProduct(savedProduct);
    }

    @Override
    @Transactional
    public Product updateProduct(Long id, ProductInput productInput) {
        ProductModel productModel = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + id));

        productMapper.updateProductModelFromInput(productInput, productModel);
        ProductModel updatedProduct = productRepository.save(productModel);
        return productMapper.toProduct(updatedProduct);
    }

    @Override
    @Transactional
    public void deleteProduct(Long id) {
        if (!productRepository.existsById(id)) {
            throw new ResourceNotFoundException("Product not found with id: " + id);
        }
        productRepository.deleteById(id);
    }
}

