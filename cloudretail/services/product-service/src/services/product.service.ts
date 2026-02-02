import { Product } from '../config/database';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  logger,
} from '@cloudretail/middleware';
import { EventPublisher } from '../events/event-publisher';
import { Op } from 'sequelize';

export class ProductService {
  private eventPublisher: EventPublisher;

  constructor() {
    this.eventPublisher = new EventPublisher();
  }

  /**
   * Create a new product
   */
  async createProduct(productData: {
    name: string;
    description: string;
    price: number;
    category: string;
    sku: string;
    vendorId: string;
  }) {
    try {
      // Check if SKU already exists
      const existingProduct = await Product.findOne({ where: { sku: productData.sku } });
      if (existingProduct) {
        throw new ConflictError('Product with this SKU already exists');
      }

      // Validate price
      if (productData.price < 0) {
        throw new ValidationError('Price must be a positive number');
      }

      // Create product
      const product = await Product.create(productData);

      // Publish product created event
      await this.eventPublisher.publishEvent({
        type: 'product.created',
        payload: {
          productId: product.id,
          name: product.name,
          price: product.price,
          category: product.category,
          sku: product.sku,
          vendorId: product.vendorId,
        },
      });

      logger.info('Product created successfully', { productId: product.id });

      return product.toJSON();
    } catch (error) {
      logger.error('Error creating product', { error });
      throw error;
    }
  }

  /**
   * Get product by ID
   */
  async getProductById(productId: string) {
    const product = await Product.findByPk(productId);

    if (!product) {
      throw new NotFoundError('Product');
    }

    return product.toJSON();
  }

  /**
   * Get product by SKU
   */
  async getProductBySku(sku: string) {
    const product = await Product.findOne({ where: { sku } });

    if (!product) {
      throw new NotFoundError('Product');
    }

    return product.toJSON();
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    updates: Partial<{
      name: string;
      description: string;
      price: number;
      category: string;
      isActive: boolean;
    }>
  ) {
    const product = await Product.findByPk(productId);

    if (!product) {
      throw new NotFoundError('Product');
    }

    // Validate price if being updated
    if (updates.price !== undefined && updates.price < 0) {
      throw new ValidationError('Price must be a positive number');
    }

    await product.update(updates);

    // Publish product updated event
    await this.eventPublisher.publishEvent({
      type: 'product.updated',
      payload: {
        productId: product.id,
        updates,
      },
    });

    logger.info('Product updated successfully', { productId });

    return product.toJSON();
  }

  /**
   * Delete product (soft delete by setting isActive to false)
   */
  async deleteProduct(productId: string) {
    const product = await Product.findByPk(productId);

    if (!product) {
      throw new NotFoundError('Product');
    }

    await product.update({ isActive: false });

    // Publish product deleted event
    await this.eventPublisher.publishEvent({
      type: 'product.deleted',
      payload: {
        productId,
        sku: product.sku,
      },
    });

    logger.info('Product deleted successfully', { productId });

    return { success: true, message: 'Product deleted successfully' };
  }

  /**
   * Search and filter products
   */
  async searchProducts(filters?: {
    category?: string;
    vendorId?: string;
    minPrice?: number;
    maxPrice?: number;
    isActive?: boolean;
    searchTerm?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.vendorId) {
      where.vendorId = filters.vendorId;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) {
        where.price[Op.gte] = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        where.price[Op.lte] = filters.maxPrice;
      }
    }

    if (filters?.searchTerm) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${filters.searchTerm}%` } },
        { description: { [Op.iLike]: `%${filters.searchTerm}%` } },
        { sku: { [Op.iLike]: `%${filters.searchTerm}%` } },
      ];
    }

    const products = await Product.findAndCountAll({
      where,
      limit: filters?.limit || 100,
      offset: filters?.offset || 0,
      order: [['createdAt', 'DESC']],
    });

    return {
      products: products.rows.map((p) => p.toJSON()),
      total: products.count,
      limit: filters?.limit || 100,
      offset: filters?.offset || 0,
    };
  }

  /**
   * Get all products (with pagination)
   */
  async getAllProducts(limit: number = 100, offset: number = 0) {
    const products = await Product.findAndCountAll({
      where: { isActive: true },
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      products: products.rows.map((p) => p.toJSON()),
      total: products.count,
      limit,
      offset,
    };
  }

  /**
   * Get products by vendor
   */
  async getProductsByVendor(vendorId: string, limit: number = 100, offset: number = 0) {
    const products = await Product.findAndCountAll({
      where: { vendorId, isActive: true },
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      products: products.rows.map((p) => p.toJSON()),
      total: products.count,
      limit,
      offset,
    };
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(category: string, limit: number = 100, offset: number = 0) {
    const products = await Product.findAndCountAll({
      where: { category, isActive: true },
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      products: products.rows.map((p) => p.toJSON()),
      total: products.count,
      limit,
      offset,
    };
  }
}
