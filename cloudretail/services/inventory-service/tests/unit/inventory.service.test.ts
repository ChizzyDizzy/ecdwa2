/**
 * Unit tests for Inventory Service
 * Tests inventory management, reservations, and stock tracking
 */

import { InventoryService } from '../../src/services/inventory.service';
import { Inventory } from '../../src/config/database';
import sequelize from '../../src/config/database';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from '@cloudretail/middleware';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/events/event-publisher');

describe('InventoryService', () => {
  let inventoryService: InventoryService;
  let mockEventPublisher: any;
  let mockTransaction: any;

  beforeEach(() => {
    jest.clearAllMocks();
    inventoryService = new InventoryService();
    mockEventPublisher = (inventoryService as any).eventPublisher;
    mockEventPublisher.publishEvent = jest.fn().mockResolvedValue(undefined);

    // Mock transaction
    mockTransaction = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    (sequelize.transaction as jest.Mock) = jest.fn().mockResolvedValue(mockTransaction);
  });

  describe('createInventory', () => {
    const validInventoryData = {
      productId: 'product-123',
      quantity: 100,
      warehouseLocation: 'Warehouse A',
    };

    it('should successfully create inventory record', async () => {
      // Arrange
      const mockInventory = {
        id: 'inventory-123',
        ...validInventoryData,
        reservedQuantity: 0,
        toJSON: () => ({ id: 'inventory-123', ...validInventoryData, reservedQuantity: 0 }),
      };

      (Inventory.findOne as jest.Mock).mockResolvedValue(null);
      (Inventory.create as jest.Mock).mockResolvedValue(mockInventory);

      // Act
      const result = await inventoryService.createInventory(validInventoryData);

      // Assert
      expect(Inventory.findOne).toHaveBeenCalledWith({ where: { productId: 'product-123' } });
      expect(Inventory.create).toHaveBeenCalledWith({
        ...validInventoryData,
        reservedQuantity: 0,
      });
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'inventory.created',
        payload: expect.objectContaining({
          inventoryId: 'inventory-123',
          productId: 'product-123',
          quantity: 100,
        }),
      });
    });

    it('should throw ConflictError if inventory already exists for product', async () => {
      // Arrange
      (Inventory.findOne as jest.Mock).mockResolvedValue({ id: 'existing-inventory' });

      // Act & Assert
      await expect(inventoryService.createInventory(validInventoryData)).rejects.toThrow(ConflictError);
      await expect(inventoryService.createInventory(validInventoryData)).rejects.toThrow('Inventory already exists for this product');
      expect(Inventory.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if quantity is negative', async () => {
      // Arrange
      const invalidData = { ...validInventoryData, quantity: -10 };
      (Inventory.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(inventoryService.createInventory(invalidData)).rejects.toThrow(ValidationError);
      await expect(inventoryService.createInventory(invalidData)).rejects.toThrow('Quantity must be a non-negative number');
      expect(Inventory.create).not.toHaveBeenCalled();
    });
  });

  describe('getInventoryByProductId', () => {
    it('should return inventory for a product with available quantity', async () => {
      // Arrange
      const mockInventory = {
        id: 'inventory-123',
        productId: 'product-123',
        quantity: 100,
        reservedQuantity: 20,
        getAvailableQuantity: jest.fn().mockReturnValue(80),
        toJSON: () => ({ id: 'inventory-123', productId: 'product-123', quantity: 100, reservedQuantity: 20 }),
      };

      (Inventory.findOne as jest.Mock).mockResolvedValue(mockInventory);

      // Act
      const result = await inventoryService.getInventoryByProductId('product-123');

      // Assert
      expect(Inventory.findOne).toHaveBeenCalledWith({ where: { productId: 'product-123' } });
      expect(result.availableQuantity).toBe(80);
    });

    it('should throw NotFoundError if inventory does not exist', async () => {
      // Arrange
      (Inventory.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(inventoryService.getInventoryByProductId('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateInventoryQuantity', () => {
    it('should successfully update inventory quantity', async () => {
      // Arrange
      const mockInventory = {
        id: 'inventory-123',
        productId: 'product-123',
        quantity: 100,
        reservedQuantity: 10,
        getAvailableQuantity: jest.fn().mockReturnValue(140),
        update: jest.fn().mockResolvedValue(undefined),
        toJSON: () => ({ id: 'inventory-123', quantity: 150, reservedQuantity: 10 }),
      };

      (Inventory.findOne as jest.Mock).mockResolvedValue(mockInventory);

      // Act
      const result = await inventoryService.updateInventoryQuantity('product-123', 150);

      // Assert
      expect(mockInventory.update).toHaveBeenCalledWith({ quantity: 150 });
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'inventory.updated',
        payload: expect.objectContaining({
          productId: 'product-123',
          oldQuantity: 100,
          newQuantity: 150,
        }),
      });
    });

    it('should throw ValidationError if new quantity is less than reserved quantity', async () => {
      // Arrange
      const mockInventory = {
        quantity: 100,
        reservedQuantity: 50,
      };

      (Inventory.findOne as jest.Mock).mockResolvedValue(mockInventory);

      // Act & Assert
      await expect(inventoryService.updateInventoryQuantity('product-123', 40)).rejects.toThrow(ValidationError);
      await expect(inventoryService.updateInventoryQuantity('product-123', 40)).rejects.toThrow('Quantity cannot be less than reserved quantity');
    });

    it('should publish low stock event when quantity is low', async () => {
      // Arrange
      const mockInventory = {
        id: 'inventory-123',
        productId: 'product-123',
        quantity: 100,
        reservedQuantity: 0,
        getAvailableQuantity: jest.fn().mockReturnValue(8),
        update: jest.fn().mockResolvedValue(undefined),
        toJSON: () => ({ id: 'inventory-123', quantity: 8 }),
      };

      (Inventory.findOne as jest.Mock).mockResolvedValue(mockInventory);

      // Act
      await inventoryService.updateInventoryQuantity('product-123', 8);

      // Assert
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'inventory.low_stock',
        payload: expect.objectContaining({
          productId: 'product-123',
          availableQuantity: 8,
          threshold: 10,
        }),
      });
    });
  });

  describe('verifyInventory', () => {
    it('should return available true when all items are in stock', async () => {
      // Arrange
      const items = [
        { productId: 'product-1', quantity: 5 },
        { productId: 'product-2', quantity: 3 },
      ];

      (Inventory.findOne as jest.Mock)
        .mockResolvedValueOnce({
          productId: 'product-1',
          getAvailableQuantity: jest.fn().mockReturnValue(10),
        })
        .mockResolvedValueOnce({
          productId: 'product-2',
          getAvailableQuantity: jest.fn().mockReturnValue(5),
        });

      // Act
      const result = await inventoryService.verifyInventory(items);

      // Assert
      expect(result.available).toBe(true);
    });

    it('should return available false when item not found', async () => {
      // Arrange
      const items = [{ productId: 'nonexistent', quantity: 5 }];
      (Inventory.findOne as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await inventoryService.verifyInventory(items);

      // Assert
      expect(result.available).toBe(false);
      expect(result.reason).toContain('not found in inventory');
    });

    it('should return available false when insufficient stock', async () => {
      // Arrange
      const items = [{ productId: 'product-1', quantity: 15 }];

      (Inventory.findOne as jest.Mock).mockResolvedValue({
        productId: 'product-1',
        getAvailableQuantity: jest.fn().mockReturnValue(10),
      });

      // Act
      const result = await inventoryService.verifyInventory(items);

      // Assert
      expect(result.available).toBe(false);
      expect(result.reason).toContain('Insufficient stock');
    });
  });

  describe('reserveInventory', () => {
    it('should successfully reserve inventory', async () => {
      // Arrange
      const items = [{ productId: 'product-1', quantity: 5 }];

      const mockInventory = {
        id: 'inventory-123',
        productId: 'product-1',
        reservedQuantity: 10,
        getAvailableQuantity: jest.fn().mockReturnValue(85),
        update: jest.fn().mockResolvedValue(undefined),
      };

      (Inventory.findOne as jest.Mock).mockResolvedValue({
        getAvailableQuantity: jest.fn().mockReturnValue(100),
      });

      (Inventory.findOne as jest.Mock).mockResolvedValue(mockInventory);

      // Act
      const result = await inventoryService.reserveInventory('order-123', items);

      // Assert
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'inventory.reserved',
        payload: {
          orderId: 'order-123',
          items,
        },
      });
      expect(result.success).toBe(true);
    });

    it('should rollback transaction on error', async () => {
      // Arrange
      const items = [{ productId: 'product-1', quantity: 5 }];

      (Inventory.findOne as jest.Mock).mockResolvedValue({
        getAvailableQuantity: jest.fn().mockReturnValue(2),
      });

      // Act & Assert
      await expect(inventoryService.reserveInventory('order-123', items)).rejects.toThrow();
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe('releaseInventory', () => {
    it('should successfully release reserved inventory', async () => {
      // Arrange
      const items = [{ productId: 'product-1', quantity: 5 }];

      const mockInventory = {
        productId: 'product-1',
        reservedQuantity: 10,
        update: jest.fn().mockResolvedValue(undefined),
      };

      (Inventory.findOne as jest.Mock).mockResolvedValue(mockInventory);

      // Act
      const result = await inventoryService.releaseInventory('order-123', items);

      // Assert
      expect(mockInventory.update).toHaveBeenCalledWith(
        { reservedQuantity: 5 },
        { transaction: mockTransaction }
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'inventory.released',
        payload: {
          orderId: 'order-123',
          items,
        },
      });
    });

    it('should not allow negative reserved quantity', async () => {
      // Arrange
      const items = [{ productId: 'product-1', quantity: 15 }];

      const mockInventory = {
        reservedQuantity: 10,
        update: jest.fn().mockResolvedValue(undefined),
      };

      (Inventory.findOne as jest.Mock).mockResolvedValue(mockInventory);

      // Act
      await inventoryService.releaseInventory('order-123', items);

      // Assert
      expect(mockInventory.update).toHaveBeenCalledWith(
        { reservedQuantity: 0 },
        { transaction: mockTransaction }
      );
    });
  });

  describe('confirmInventoryUsage', () => {
    it('should decrease both quantity and reserved quantity', async () => {
      // Arrange
      const items = [{ productId: 'product-1', quantity: 5 }];

      const mockInventory = {
        id: 'inventory-123',
        productId: 'product-1',
        quantity: 100,
        reservedQuantity: 10,
        update: jest.fn().mockResolvedValue(undefined),
      };

      (Inventory.findOne as jest.Mock).mockResolvedValue(mockInventory);

      // Act
      const result = await inventoryService.confirmInventoryUsage('order-123', items);

      // Assert
      expect(mockInventory.update).toHaveBeenCalledWith(
        {
          quantity: 95,
          reservedQuantity: 5,
        },
        { transaction: mockTransaction }
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should publish out of stock event when quantity reaches zero', async () => {
      // Arrange
      const items = [{ productId: 'product-1', quantity: 5 }];

      const mockInventory = {
        id: 'inventory-123',
        productId: 'product-1',
        quantity: 5,
        reservedQuantity: 5,
        update: jest.fn().mockImplementation(function(updates) {
          this.quantity = updates.quantity;
          return Promise.resolve(undefined);
        }),
      };

      (Inventory.findOne as jest.Mock).mockResolvedValue(mockInventory);

      // Act
      await inventoryService.confirmInventoryUsage('order-123', items);

      // Assert
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'inventory.out_of_stock',
        payload: {
          inventoryId: 'inventory-123',
          productId: 'product-1',
        },
      });
    });
  });

  describe('getAllInventory', () => {
    it('should return all inventory records with available quantity', async () => {
      // Arrange
      const mockInventoryRecords = [
        {
          id: '1',
          quantity: 100,
          reservedQuantity: 20,
          getAvailableQuantity: jest.fn().mockReturnValue(80),
          toJSON: () => ({ id: '1', quantity: 100, reservedQuantity: 20 }),
        },
        {
          id: '2',
          quantity: 50,
          reservedQuantity: 10,
          getAvailableQuantity: jest.fn().mockReturnValue(40),
          toJSON: () => ({ id: '2', quantity: 50, reservedQuantity: 10 }),
        },
      ];

      (Inventory.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: mockInventoryRecords,
        count: 2,
      });

      // Act
      const result = await inventoryService.getAllInventory();

      // Assert
      expect(result.inventory).toHaveLength(2);
      expect(result.inventory[0].availableQuantity).toBe(80);
      expect(result.inventory[1].availableQuantity).toBe(40);
    });

    it('should filter by warehouse location', async () => {
      // Arrange
      (Inventory.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: [],
        count: 0,
      });

      // Act
      await inventoryService.getAllInventory({ warehouseLocation: 'Warehouse A' });

      // Assert
      expect(Inventory.findAndCountAll).toHaveBeenCalledWith({
        where: { warehouseLocation: 'Warehouse A' },
        limit: 100,
        offset: 0,
        order: [['createdAt', 'DESC']],
      });
    });

    it('should filter by low stock', async () => {
      // Arrange
      const mockInventoryRecords = [
        {
          id: '1',
          quantity: 8,
          reservedQuantity: 0,
          getAvailableQuantity: jest.fn().mockReturnValue(8),
          toJSON: () => ({ id: '1', quantity: 8, reservedQuantity: 0 }),
        },
        {
          id: '2',
          quantity: 100,
          reservedQuantity: 0,
          getAvailableQuantity: jest.fn().mockReturnValue(100),
          toJSON: () => ({ id: '2', quantity: 100, reservedQuantity: 0 }),
        },
      ];

      (Inventory.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: mockInventoryRecords,
        count: 2,
      });

      // Act
      const result = await inventoryService.getAllInventory({ lowStock: true });

      // Assert
      expect(result.inventory).toHaveLength(1);
      expect(result.inventory[0].availableQuantity).toBe(8);
    });
  });
});
