import { Model, DataTypes, Sequelize } from 'sequelize';

export interface PaymentAttributes {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  paymentMethod: 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer';
  transactionId?: string;
  pciCompliant: boolean;
  metadata?: any;
  failureReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Payment extends Model<PaymentAttributes> implements PaymentAttributes {
  public id!: string;
  public orderId!: string;
  public userId!: string;
  public amount!: number;
  public currency!: string;
  public status!: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  public paymentMethod!: 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer';
  public transactionId?: string;
  public pciCompliant!: boolean;
  public metadata?: any;
  public failureReason?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function initPaymentModel(sequelize: Sequelize): typeof Payment {
  Payment.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      orderId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'USD',
        validate: {
          len: [3, 3],
        },
      },
      status: {
        type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'refunded'),
        defaultValue: 'pending',
        allowNull: false,
      },
      paymentMethod: {
        type: DataTypes.ENUM('credit_card', 'debit_card', 'paypal', 'bank_transfer'),
        allowNull: false,
      },
      transactionId: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      pciCompliant: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      failureReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'payments',
      timestamps: true,
      indexes: [
        {
          fields: ['orderId'],
        },
        {
          fields: ['userId'],
        },
        {
          fields: ['status'],
        },
        {
          fields: ['transactionId'],
          unique: true,
        },
      ],
    }
  );

  return Payment;
}
