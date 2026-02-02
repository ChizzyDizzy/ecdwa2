import { Request, Response } from 'express';
import { ProductService } from '../services/product.service';
import { asyncHandler, AuthenticatedRequest } from '@cloudretail/middleware';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';

const productService = new ProductService();

// Validation schemas
const createProductSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  description: Joi.string().required(),
  price: Joi.number().required().min(0),
  category: Joi.string().required(),
  sku: Joi.string().required(),
  vendorId: Joi.string().uuid().required(),
});

const updateProductSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  description: Joi.string().optional(),
  price: Joi.number().min(0).optional(),
  category: Joi.string().optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

const searchProductsSchema = Joi.object({
  category: Joi.string().optional(),
  vendorId: Joi.string().uuid().optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  isActive: Joi.boolean().optional(),
  searchTerm: Joi.string().optional(),
  limit: Joi.number().min(1).max(1000).optional(),
  offset: Joi.number().min(0).optional(),
});

/**
 * Create a new product
 */
export const createProduct = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { error, value } = createProductSchema.validate(req.body);

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

    const product = await productService.createProduct(value);

    res.status(201).json({
      success: true,
      data: product,
      metadata: {
        timestamp: new Date(),
        requestId: uuidv4(),
      },
    });
  }
);

/**
 * Get product by ID
 */
export const getProductById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const product = await productService.getProductById(id);

  res.json({
    success: true,
    data: product,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});

/**
 * Get product by SKU
 */
export const getProductBySku = asyncHandler(async (req: Request, res: Response) => {
  const { sku } = req.params;
  const product = await productService.getProductBySku(sku);

  res.json({
    success: true,
    data: product,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});

/**
 * Update product
 */
export const updateProduct = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { error, value } = updateProductSchema.validate(req.body);

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

    const product = await productService.updateProduct(id, value);

    res.json({
      success: true,
      data: product,
      metadata: {
        timestamp: new Date(),
        requestId: uuidv4(),
      },
    });
  }
);

/**
 * Delete product
 */
export const deleteProduct = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const result = await productService.deleteProduct(id);

    res.json({
      success: true,
      data: result,
      metadata: {
        timestamp: new Date(),
        requestId: uuidv4(),
      },
    });
  }
);

/**
 * Search and filter products
 */
export const searchProducts = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = searchProductsSchema.validate(req.query);

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

  const filters = {
    category: value.category,
    vendorId: value.vendorId,
    minPrice: value.minPrice ? parseFloat(value.minPrice) : undefined,
    maxPrice: value.maxPrice ? parseFloat(value.maxPrice) : undefined,
    isActive: value.isActive === 'true' ? true : value.isActive === 'false' ? false : undefined,
    searchTerm: value.searchTerm,
    limit: value.limit ? parseInt(value.limit) : undefined,
    offset: value.offset ? parseInt(value.offset) : undefined,
  };

  const result = await productService.searchProducts(filters);

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
 * Get all products
 */
export const getAllProducts = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

  const result = await productService.getAllProducts(limit, offset);

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
 * Get products by vendor
 */
export const getProductsByVendor = asyncHandler(async (req: Request, res: Response) => {
  const { vendorId } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

  const result = await productService.getProductsByVendor(vendorId, limit, offset);

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
 * Get products by category
 */
export const getProductsByCategory = asyncHandler(async (req: Request, res: Response) => {
  const { category } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

  const result = await productService.getProductsByCategory(category, limit, offset);

  res.json({
    success: true,
    data: result,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});
