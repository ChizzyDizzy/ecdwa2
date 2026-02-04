import { z } from 'zod';

// User Models
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(['customer', 'admin', 'vendor']),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  gdprConsent: z.boolean(),
  twoFactorEnabled: z.boolean(),
});

export type User = z.infer<typeof UserSchema>;

// Product Models
export const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  price: z.number().positive(),
  category: z.string(),
  sku: z.string(),
  vendorId: z.string().uuid(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Product = z.infer<typeof ProductSchema>;

// Inventory Models
export const InventorySchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().nonnegative(),
  warehouseLocation: z.string(),
  reservedQuantity: z.number().int().nonnegative(),
  lastUpdated: z.date(),
});

export type Inventory = z.infer<typeof InventorySchema>;

// Order Models
export const OrderStatusEnum = z.enum([
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

export const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
  subtotal: z.number().positive(),
});

export const OrderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  items: z.array(OrderItemSchema),
  totalAmount: z.number().positive(),
  status: OrderStatusEnum,
  shippingAddress: z.string(),
  paymentId: z.string().uuid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Order = z.infer<typeof OrderSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type OrderStatus = z.infer<typeof OrderStatusEnum>;

// Payment Models
export const PaymentStatusEnum = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
]);

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  status: PaymentStatusEnum,
  paymentMethod: z.string(),
  transactionId: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  pciCompliant: z.boolean(),
});

export type Payment = z.infer<typeof PaymentSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

// Event Models for Event-Driven Architecture
export const EventTypeEnum = z.enum([
  'user.created',
  'user.updated',
  'user.deleted',
  'product.created',
  'product.updated',
  'product.deleted',
  'inventory.created',
  'inventory.updated',
  'inventory.low_stock',
  'inventory.reserved',
  'inventory.released',
  'inventory.out_of_stock',
  'order.created',
  'order.updated',
  'order.cancelled',
  'order.confirmed',
  'order.status_updated',
  'payment.initiated',
  'payment.completed',
  'payment.failed',
  'payment.refunded',
]);

export const EventSchema = z.object({
  id: z.string().uuid(),
  type: EventTypeEnum,
  payload: z.any(),
  timestamp: z.date(),
  metadata: z.object({
    correlationId: z.string().uuid(),
    userId: z.string().uuid().optional(),
    service: z.string(),
  }),
});

export type Event = z.infer<typeof EventSchema>;
export type EventType = z.infer<typeof EventTypeEnum>;

// API Response Models
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
  metadata: z.object({
    timestamp: z.date(),
    requestId: z.string().uuid(),
  }),
});

export type ApiResponse = z.infer<typeof ApiResponseSchema>;

// JWT Token Payload
export const JwtPayloadSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['customer', 'admin', 'vendor']),
  iat: z.number(),
  exp: z.number(),
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;
