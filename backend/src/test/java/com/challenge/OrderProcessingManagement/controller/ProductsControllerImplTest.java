package com.challenge.OrderProcessingManagement.controller;

import com.challenge.OrderProcessingManagement.controller.impl.ProductsControllerImpl;
import com.challenge.OrderProcessingManagement.model.Product;
import com.challenge.OrderProcessingManagement.model.ProductInput;
import com.challenge.OrderProcessingManagement.service.ProductService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ProductsController Tests")
class ProductsControllerImplTest {

    @Mock
    private ProductService productService;

    @InjectMocks
    private ProductsControllerImpl productsController;

    private Product product;
    private ProductInput productInput;

    @BeforeEach
    void setUp() {
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
        List<Product> products = Arrays.asList(product);
        when(productService.findAllProducts()).thenReturn(products);

        // When
        ResponseEntity<List<Product>> response = productsController.getAllProducts();

        // Then
        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(1, response.getBody().size());
        assertEquals("Notebook", response.getBody().get(0).getName());
        verify(productService, times(1)).findAllProducts();
    }

    @Test
    @DisplayName("Should find product by ID successfully")
    void shouldFindProductById() {
        // Given
        Integer productId = 1;
        when(productService.findProductById(productId.longValue())).thenReturn(product);

        // When
        ResponseEntity<Product> response = productsController.getProductById(productId);

        // Then
        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(1, response.getBody().getId());
        assertEquals("Notebook", response.getBody().getName());
        verify(productService, times(1)).findProductById(productId.longValue());
    }

    @Test
    @DisplayName("Should create product successfully")
    void shouldCreateProduct() {
        // Given
        when(productService.createProduct(any(ProductInput.class))).thenReturn(product);

        // When
        ResponseEntity<Product> response = productsController.createProduct(productInput);

        // Then
        assertNotNull(response);
        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Notebook", response.getBody().getName());
        verify(productService, times(1)).createProduct(eq(productInput));
    }

    @Test
    @DisplayName("Should update product successfully")
    void shouldUpdateProduct() {
        // Given
        Integer productId = 1;
        when(productService.updateProduct(eq(productId.longValue()), any(ProductInput.class)))
                .thenReturn(product);

        // When
        ResponseEntity<Product> response = productsController.updateProduct(productId, productInput);

        // Then
        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Notebook", response.getBody().getName());
        verify(productService, times(1)).updateProduct(eq(productId.longValue()), eq(productInput));
    }

    @Test
    @DisplayName("Should delete product successfully")
    void shouldDeleteProduct() {
        // Given
        Integer productId = 1;
        doNothing().when(productService).deleteProduct(productId.longValue());

        // When
        ResponseEntity<Void> response = productsController.deleteProduct(productId);

        // Then
        assertNotNull(response);
        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        assertNull(response.getBody());
        verify(productService, times(1)).deleteProduct(productId.longValue());
    }
}

