package com.challenge.OrderProcessingManagement.service.impl;

import com.challenge.OrderProcessingManagement.exception.ResourceNotFoundException;
import com.challenge.OrderProcessingManagement.mapper.ProductMapper;
import com.challenge.OrderProcessingManagement.model.Product;
import com.challenge.OrderProcessingManagement.model.ProductInput;
import com.challenge.OrderProcessingManagement.model.entity.ProductModel;
import com.challenge.OrderProcessingManagement.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ProductService Tests")
class ProductServiceImplTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ProductMapper productMapper;

    @InjectMocks
    private ProductServiceImpl productService;

    private ProductModel productModel;
    private Product product;
    private ProductInput productInput;

    @BeforeEach
    void setUp() {
        productModel = new ProductModel();
        productModel.setId(1L);
        productModel.setName("Notebook");
        productModel.setDescription("Notebook Gamer");
        productModel.setPrice(new BigDecimal("2999.99"));
        productModel.setStockQuantity(10);
        productModel.setCreatedAt(LocalDateTime.now());
        productModel.setUpdatedAt(LocalDateTime.now());

        product = new Product();
        product.setId(1);
        product.setName("Notebook");
        product.setDescription("Notebook Gamer");
        product.setPrice(new BigDecimal("2999.99"));
        product.setStockQuantity(10);

        productInput = new ProductInput();
        productInput.setName("Notebook");
        productInput.setDescription("Notebook Gamer");
        productInput.setPrice(new BigDecimal("2999.99"));
        productInput.setStockQuantity(10);
    }

    @Test
    @DisplayName("Should list all products successfully")
    void shouldListAllProducts() {
        // Given
        List<ProductModel> productModels = Arrays.asList(productModel);
        List<Product> products = Arrays.asList(product);

        when(productRepository.findAll()).thenReturn(productModels);
        when(productMapper.toProduct(productModels)).thenReturn(products);

        // When
        List<Product> result = productService.findAllProducts();

        // Then
        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("Notebook", result.get(0).getName());
        verify(productRepository, times(1)).findAll();
        verify(productMapper, times(1)).toProduct(productModels);
    }

    @Test
    @DisplayName("Should find product by ID successfully")
    void shouldFindProductById() {
        // Given
        Long productId = 1L;
        when(productRepository.findById(productId)).thenReturn(Optional.of(productModel));
        when(productMapper.toProduct(productModel)).thenReturn(product);

        // When
        Product result = productService.findProductById(productId);

        // Then
        assertNotNull(result);
        assertEquals(1, result.getId());
        assertEquals("Notebook", result.getName());
        verify(productRepository, times(1)).findById(productId);
        verify(productMapper, times(1)).toProduct(productModel);
    }

    @Test
    @DisplayName("Should throw exception when product not found by ID")
    void shouldThrowExceptionWhenProductNotFound() {
        // Given
        Long productId = 999L;
        when(productRepository.findById(productId)).thenReturn(Optional.empty());

        // When & Then
        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> productService.findProductById(productId)
        );

        assertEquals("Product not found with id: 999", exception.getMessage());
        verify(productRepository, times(1)).findById(productId);

    }

    @Test
    @DisplayName("Should create product successfully")
    void shouldCreateProduct() {
        // Given
        when(productMapper.toProductModel(productInput)).thenReturn(productModel);
        when(productRepository.save(productModel)).thenReturn(productModel);
        when(productMapper.toProduct(productModel)).thenReturn(product);

        // When
        Product result = productService.createProduct(productInput);

        // Then
        assertNotNull(result);
        assertEquals("Notebook", result.getName());
        verify(productMapper, times(1)).toProductModel(productInput);
        verify(productRepository, times(1)).save(productModel);
        verify(productMapper, times(1)).toProduct(productModel);
    }

    @Test
    @DisplayName("Should update product successfully")
    void shouldUpdateProduct() {
        // Given
        Long productId = 1L;
        ProductInput updatedInput = new ProductInput();
        updatedInput.setName("Updated Notebook");
        updatedInput.setDescription("Updated Description");
        updatedInput.setPrice(new BigDecimal("3499.99"));
        updatedInput.setStockQuantity(15);

        Product updatedProduct = new Product();
        updatedProduct.setId(1);
        updatedProduct.setName("Updated Notebook");

        when(productRepository.findById(productId)).thenReturn(Optional.of(productModel));
        when(productRepository.save(productModel)).thenReturn(productModel);
        when(productMapper.toProduct(productModel)).thenReturn(updatedProduct);

        // When
        Product result = productService.updateProduct(productId, updatedInput);

        // Then
        assertNotNull(result);
        assertEquals("Updated Notebook", result.getName());
        verify(productRepository, times(1)).findById(productId);
        verify(productMapper, times(1)).updateProductModelFromInput(eq(updatedInput), eq(productModel));
        verify(productRepository, times(1)).save(productModel);
        verify(productMapper, times(1)).toProduct(productModel);
    }

    @Test
    @DisplayName("Should throw exception when updating non-existent product")
    void shouldThrowExceptionWhenUpdatingNonExistentProduct() {
        // Given
        Long productId = 999L;
        when(productRepository.findById(productId)).thenReturn(Optional.empty());

        // When & Then
        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> productService.updateProduct(productId, productInput)
        );

        assertEquals("Product not found with id: 999", exception.getMessage());
        verify(productRepository, times(1)).findById(productId);
        verify(productRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should delete product successfully")
    void shouldDeleteProduct() {
        // Given
        Long productId = 1L;
        when(productRepository.existsById(productId)).thenReturn(true);
        doNothing().when(productRepository).deleteById(productId);

        // When
        productService.deleteProduct(productId);

        // Then
        verify(productRepository, times(1)).existsById(productId);
        verify(productRepository, times(1)).deleteById(productId);
    }

    @Test
    @DisplayName("Should throw exception when deleting non-existent product")
    void shouldThrowExceptionWhenDeletingNonExistentProduct() {
        // Given
        Long productId = 999L;
        when(productRepository.existsById(productId)).thenReturn(false);

        // When & Then
        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> productService.deleteProduct(productId)
        );

        assertEquals("Product not found with id: 999", exception.getMessage());
        verify(productRepository, times(1)).existsById(productId);
        verify(productRepository, never()).deleteById(any());
    }
}

