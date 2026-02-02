import { Request, Response } from 'express';
import { InventoryService } from '../services/inventory.service';
import { asyncHandler, AuthenticatedRequest } from '@cloudretail/middleware';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';

const inventoryService = new InventoryService();

// Validation schemas
const createInventorySchema = Joi.object({
  productId: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(0).required(),
  warehouseLocation: Joi.string().required(),
});

const updateQuantitySchema = Joi.object({
  quantity: Joi.number().integer().min(0).required(),
});

const inventoryItemSchema = Joi.object({
  productId: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).required(),
});

const verifyInventorySchema = Joi.object({
  items: Joi.array().items(inventoryItemSchema).min(1).required(),
});

const reserveInventorySchema = Joi.object({
  orderId: Joi.string().uuid().required(),
  items: Joi.array().items(inventoryItemSchema).min(1).required(),
});

const releaseInventorySchema = Joi.object({
  orderId: Joi.string().uuid().required(),
  items: Joi.array().items(inventoryItemSchema).min(1).required(),
});

const confirmUsageSchema = Joi.object({
  orderId: Joi.string().uuid().required(),
  items: Joi.array().items(inventoryItemSchema).min(1).required(),
});

/**
 * Create inventory record
 */
export const createInventory = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { error, value } = createInventorySchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
      return;
    }

    const inventory = await inventoryService.createInventory(value);

    res.status(201).json({
      success: true,
      data: inventory,
      metadata: {
        timestamp: new Date(),
        requestId: uuidv4(),
      },
    });
  }
);

/**
 * Get inventory by product ID
 */
export const getInventoryByProductId = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId } = req.params;
    const inventory = await inventoryService.getInventoryByProductId(productId);

    res.json({
      success: true,
      data: inventory,
      metadata: {
        timestamp: new Date(),
        requestId: uuidv4(),
      },
    });
  }
);

/**
 * Get inventory by ID
 */
export const getInventoryById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const inventory = await inventoryService.getInventoryById(id);

  res.json({
    success: true,
    data: inventory,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});

/**
 * Update inventory quantity
 */
export const updateInventoryQuantity = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { productId } = req.params;
    const { error, value } = updateQuantitySchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
      return;
    }

    const inventory = await inventoryService.updateInventoryQuantity(
      productId,
      value.quantity
    );

    res.json({
      success: true,
      data: inventory,
      metadata: {
        timestamp: new Date(),
        requestId: uuidv4(),
      },
    });
  }
);

/**
 * Verify inventory availability
 */
export const verifyInventory = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = verifyInventorySchema.validate(req.body);

  if (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.details[0].message,
      },
    });
    return;
  }

  const result = await inventoryService.verifyInventory(value.items);

  res.json({
    success: true,
    data: result,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});

/**
 * Reserve inventory for order
 */
export const reserveInventory = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = reserveInventorySchema.validate(req.body);

  if (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.details[0].message,
      },
    });
    return;
  }

  const result = await inventoryService.reserveInventory(value.orderId, value.items);

  res.json({
    success: true,
    data: result,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});

/**
 * Release reserved inventory
 */
export const releaseInventory = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = releaseInventorySchema.validate(req.body);

  if (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.details[0].message,
      },
    });
    return;
  }

  const result = await inventoryService.releaseInventory(value.orderId, value.items);

  res.json({
    success: true,
    data: result,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});

/**
 * Confirm inventory usage
 */
export const confirmInventoryUsage = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = confirmUsageSchema.validate(req.body);

  if (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.details[0].message,
      },
    });
    return;
  }

  const result = await inventoryService.confirmInventoryUsage(value.orderId, value.items);

  res.json({
    success: true,
    data: result,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});

/**
 * Get all inventory records
 */
export const getAllInventory = asyncHandler(async (req: Request, res: Response) => {
  const filters = {
    warehouseLocation: req.query.warehouseLocation as string | undefined,
    lowStock: req.query.lowStock === 'true' ? true : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
  };

  const result = await inventoryService.getAllInventory(filters);

  res.json({
    success: true,
    data: result,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});
