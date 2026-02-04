import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

export interface OrderItem {
  productId: string;
  productName?: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface OrderAttributes {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  paymentId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrderCreationAttributes extends Optional<OrderAttributes, 'id' | 'status' | 'paymentId' | 'createdAt' | 'updatedAt'> {}

export class Order extends Model<OrderAttributes, OrderCreationAttributes> implements OrderAttributes {
  public id!: string;
  public userId!: string;
  public items!: OrderItem[];
  public totalAmount!: number;
  public status!: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  public shippingAddress!: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  public paymentId?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function initOrderModel(sequelize: Sequelize): typeof Order {
  Order.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      items: {
        type: DataTypes.JSONB,
        allowNull: false,
        validate: {
          isValidItems(value: any) {
            if (!Array.isArray(value) || value.length === 0) {
              throw new Error('Order must contain at least one item');
            }
            for (const item of value) {
              if (!item.productId || !item.quantity || !item.price) {
                throw new Error('Invalid order item structure');
              }
            }
          },
        },
      },
      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      status: {
        type: DataTypes.ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'),
        defaultValue: 'pending',
        allowNull: false,
      },
      shippingAddress: {
        type: DataTypes.JSONB,
        allowNull: false,
        validate: {
          isValidAddress(value: any) {
            if (!value.street || !value.city || !value.state || !value.zipCode || !value.country) {
              throw new Error('Invalid shipping address');
            }
          },
        },
      },
      paymentId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'orders',
      timestamps: true,
      indexes: [
        {
          fields: ['userId'],
        },
        {
          fields: ['status'],
        },
        {
          fields: ['paymentId'],
        },
      ],
    }
  );

  return Order;
}
