/**
 * Unit tests for Product Service
 * Tests CRUD operations, search functionality, and business logic
 */

import { ProductService } from '../../src/services/product.service';
import { Product } from '../../src/config/database';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from '@cloudretail/middleware';
import { Op } from 'sequelize';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/events/event-publisher');

describe('ProductService', () => {
  let productService: ProductService;
  let mockEventPublisher: any;

  beforeEach(() => {
    jest.clearAllMocks();
    productService = new ProductService();
    mockEventPublisher = (productService as any).eventPublisher;
    mockEventPublisher.publishEvent = jest.fn().mockResolvedValue(undefined);
  });

  describe('createProduct', () => {
    const validProductData = {
      name: 'Test Product',
      description: 'A test product',
      price: 99.99,
      category: 'electronics',
      sku: 'TEST-SKU-001',
      vendorId: 'vendor-123',
    };

    it('should successfully create a new product', async () => {
      // Arrange
      const mockProduct = {
        id: 'product-123',
        ...validProductData,
        toJSON: () => ({ id: 'product-123', ...validProductData }),
      };

      (Product.findOne as jest.Mock).mockResolvedValue(null);
      (Product.create as jest.Mock).mockResolvedValue(mockProduct);

      // Act
      const result = await productService.createProduct(validProductData);

      // Assert
      expect(Product.findOne).toHaveBeenCalledWith({ where: { sku: validProductData.sku } });
      expect(Product.create).toHaveBeenCalledWith(validProductData);
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'product.created',
        payload: {
          productId: 'product-123',
          name: validProductData.name,
          price: validProductData.price,
          category: validProductData.category,
          sku: validProductData.sku,
          vendorId: validProductData.vendorId,
        },
      });
      expect(result).toEqual({ id: 'product-123', ...validProductData });
    });

    it('should throw ConflictError if SKU already exists', async () => {
      // Arrange
      (Product.findOne as jest.Mock).mockResolvedValue({ id: 'existing-product', sku: validProductData.sku });

      // Act & Assert
      await expect(productService.createProduct(validProductData)).rejects.toThrow(ConflictError);
      await expect(productService.createProduct(validProductData)).rejects.toThrow('Product with this SKU already exists');
      expect(Product.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if price is negative', async () => {
      // Arrange
      const invalidProductData = { ...validProductData, price: -10 };
      (Product.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(productService.createProduct(invalidProductData)).rejects.toThrow(ValidationError);
      await expect(productService.createProduct(invalidProductData)).rejects.toThrow('Price must be a positive number');
      expect(Product.create).not.toHaveBeenCalled();
    });
  });

  describe('getProductById', () => {
    it('should return product by ID', async () => {
      // Arrange
      const mockProduct = {
        id: 'product-123',
        name: 'Test Product',
        price: 99.99,
        toJSON: () => ({ id: 'product-123', name: 'Test Product', price: 99.99 }),
      };

      (Product.findByPk as jest.Mock).mockResolvedValue(mockProduct);

      // Act
      const result = await productService.getProductById('product-123');

      // Assert
      expect(Product.findByPk).toHaveBeenCalledWith('product-123');
      expect(result).toEqual({ id: 'product-123', name: 'Test Product', price: 99.99 });
    });

    it('should throw NotFoundError if product does not exist', async () => {
      // Arrange
      (Product.findByPk as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(productService.getProductById('nonexistent')).rejects.toThrow(NotFoundError);
      await expect(productService.getProductById('nonexistent')).rejects.toThrow('Product');
    });
  });

  describe('getProductBySku', () => {
    it('should return product by SKU', async () => {
      // Arrange
      const mockProduct = {
        id: 'product-123',
        sku: 'TEST-SKU-001',
        name: 'Test Product',
        toJSON: () => ({ id: 'product-123', sku: 'TEST-SKU-001', name: 'Test Product' }),
      };

      (Product.findOne as jest.Mock).mockResolvedValue(mockProduct);

      // Act
      const result = await productService.getProductBySku('TEST-SKU-001');

      // Assert
      expect(Product.findOne).toHaveBeenCalledWith({ where: { sku: 'TEST-SKU-001' } });
      expect(result).toEqual({ id: 'product-123', sku: 'TEST-SKU-001', name: 'Test Product' });
    });

    it('should throw NotFoundError if product does not exist', async () => {
      // Arrange
      (Product.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(productService.getProductBySku('NONEXISTENT')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateProduct', () => {
    it('should successfully update product', async () => {
      // Arrange
      const updates = { name: 'Updated Product', price: 149.99 };
      const mockProduct = {
        id: 'product-123',
        name: 'Test Product',
        price: 99.99,
        update: jest.fn().mockResolvedValue(undefined),
        toJSON: () => ({ id: 'product-123', name: 'Updated Product', price: 149.99 }),
      };

      (Product.findByPk as jest.Mock).mockResolvedValue(mockProduct);

      // Act
      const result = await productService.updateProduct('product-123', updates);

      // Assert
      expect(Product.findByPk).toHaveBeenCalledWith('product-123');
      expect(mockProduct.update).toHaveBeenCalledWith(updates);
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'product.updated',
        payload: {
          productId: 'product-123',
          updates,
        },
      });
      expect(result).toEqual({ id: 'product-123', name: 'Updated Product', price: 149.99 });
    });

    it('should throw NotFoundError if product does not exist', async () => {
      // Arrange
      (Product.findByPk as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(productService.updateProduct('nonexistent', { name: 'Updated' })).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if price is negative', async () => {
      // Arrange
      const mockProduct = {
        id: 'product-123',
        update: jest.fn(),
      };

      (Product.findByPk as jest.Mock).mockResolvedValue(mockProduct);

      // Act & Assert
      await expect(productService.updateProduct('product-123', { price: -50 })).rejects.toThrow(ValidationError);
      await expect(productService.updateProduct('product-123', { price: -50 })).rejects.toThrow('Price must be a positive number');
      expect(mockProduct.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteProduct', () => {
    it('should soft delete product by setting isActive to false', async () => {
      // Arrange
      const mockProduct = {
        id: 'product-123',
        sku: 'TEST-SKU-001',
        update: jest.fn().mockResolvedValue(undefined),
      };

      (Product.findByPk as jest.Mock).mockResolvedValue(mockProduct);

      // Act
      const result = await productService.deleteProduct('product-123');

      // Assert
      expect(Product.findByPk).toHaveBeenCalledWith('product-123');
      expect(mockProduct.update).toHaveBeenCalledWith({ isActive: false });
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'product.deleted',
        payload: {
          productId: 'product-123',
          sku: 'TEST-SKU-001',
        },
      });
      expect(result).toEqual({ success: true, message: 'Product deleted successfully' });
    });

    it('should throw NotFoundError if product does not exist', async () => {
      // Arrange
      (Product.findByPk as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(productService.deleteProduct('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('searchProducts', () => {
    it('should search products by category', async () => {
      // Arrange
      const mockProducts = [
        { id: '1', name: 'Product 1', category: 'electronics', toJSON: () => ({ id: '1', name: 'Product 1', category: 'electronics' }) },
        { id: '2', name: 'Product 2', category: 'electronics', toJSON: () => ({ id: '2', name: 'Product 2', category: 'electronics' }) },
      ];

      (Product.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: mockProducts,
        count: 2,
      });

      // Act
      const result = await productService.searchProducts({ category: 'electronics' });

      // Assert
      expect(Product.findAndCountAll).toHaveBeenCalledWith({
        where: { category: 'electronics' },
        limit: 100,
        offset: 0,
        order: [['createdAt', 'DESC']],
      });
      expect(result.products).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should search products by price range', async () => {
      // Arrange
      (Product.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: [],
        count: 0,
      });

      // Act
      await productService.searchProducts({ minPrice: 50, maxPrice: 100 });

      // Assert
      expect(Product.findAndCountAll).toHaveBeenCalledWith({
        where: {
          price: {
            [Op.gte]: 50,
            [Op.lte]: 100,
          },
        },
        limit: 100,
        offset: 0,
        order: [['createdAt', 'DESC']],
      });
    });

    it('should search products by search term', async () => {
      // Arrange
      const mockProducts = [
        { id: '1', name: 'Laptop', toJSON: () => ({ id: '1', name: 'Laptop' }) },
      ];

      (Product.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: mockProducts,
        count: 1,
      });

      // Act
      const result = await productService.searchProducts({ searchTerm: 'laptop' });

      // Assert
      expect(Product.findAndCountAll).toHaveBeenCalledWith({
        where: {
          [Op.or]: [
            { name: { [Op.iLike]: '%laptop%' } },
            { description: { [Op.iLike]: '%laptop%' } },
            { sku: { [Op.iLike]: '%laptop%' } },
          ],
        },
        limit: 100,
        offset: 0,
        order: [['createdAt', 'DESC']],
      });
      expect(result.products).toHaveLength(1);
    });

    it('should support pagination', async () => {
      // Arrange
      (Product.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: [],
        count: 0,
      });

      // Act
      await productService.searchProducts({ limit: 20, offset: 40 });

      // Assert
      expect(Product.findAndCountAll).toHaveBeenCalledWith({
        where: {},
        limit: 20,
        offset: 40,
        order: [['createdAt', 'DESC']],
      });
    });
  });

  describe('getAllProducts', () => {
    it('should return all active products with default pagination', async () => {
      // Arrange
      const mockProducts = [
        { id: '1', name: 'Product 1', isActive: true, toJSON: () => ({ id: '1', name: 'Product 1' }) },
        { id: '2', name: 'Product 2', isActive: true, toJSON: () => ({ id: '2', name: 'Product 2' }) },
      ];

      (Product.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: mockProducts,
        count: 2,
      });

      // Act
      const result = await productService.getAllProducts();

      // Assert
      expect(Product.findAndCountAll).toHaveBeenCalledWith({
        where: { isActive: true },
        limit: 100,
        offset: 0,
        order: [['createdAt', 'DESC']],
      });
      expect(result.products).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should support custom pagination', async () => {
      // Arrange
      (Product.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: [],
        count: 0,
      });

      // Act
      await productService.getAllProducts(50, 100);

      // Assert
      expect(Product.findAndCountAll).toHaveBeenCalledWith({
        where: { isActive: true },
        limit: 50,
        offset: 100,
        order: [['createdAt', 'DESC']],
      });
    });
  });

  describe('getProductsByVendor', () => {
    it('should return products for a specific vendor', async () => {
      // Arrange
      const mockProducts = [
        { id: '1', name: 'Product 1', vendorId: 'vendor-123', toJSON: () => ({ id: '1', name: 'Product 1' }) },
      ];

      (Product.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: mockProducts,
        count: 1,
      });

      // Act
      const result = await productService.getProductsByVendor('vendor-123');

      // Assert
      expect(Product.findAndCountAll).toHaveBeenCalledWith({
        where: { vendorId: 'vendor-123', isActive: true },
        limit: 100,
        offset: 0,
        order: [['createdAt', 'DESC']],
      });
      expect(result.products).toHaveLength(1);
    });
  });

  describe('getProductsByCategory', () => {
    it('should return products for a specific category', async () => {
      // Arrange
      const mockProducts = [
        { id: '1', name: 'Product 1', category: 'electronics', toJSON: () => ({ id: '1', name: 'Product 1' }) },
      ];

      (Product.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: mockProducts,
        count: 1,
      });

      // Act
      const result = await productService.getProductsByCategory('electronics');

      // Assert
      expect(Product.findAndCountAll).toHaveBeenCalledWith({
        where: { category: 'electronics', isActive: true },
        limit: 100,
        offset: 0,
        order: [['createdAt', 'DESC']],
      });
      expect(result.products).toHaveLength(1);
    });
  });
});
