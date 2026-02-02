import { Model, DataTypes, Sequelize } from 'sequelize';

export interface InventoryAttributes {
  id: string;
  productId: string;
  quantity: number;
  warehouseLocation: string;
  reservedQuantity: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Inventory extends Model<InventoryAttributes> implements InventoryAttributes {
  public id!: string;
  public productId!: string;
  public quantity!: number;
  public warehouseLocation!: string;
  public reservedQuantity!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Get available quantity (total - reserved)
   */
  public getAvailableQuantity(): number {
    return this.quantity - this.reservedQuantity;
  }
}

export function initInventoryModel(sequelize: Sequelize): typeof Inventory {
  Inventory.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },
      warehouseLocation: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      reservedQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },
    },
    {
      sequelize,
      tableName: 'inventory',
      timestamps: true,
      indexes: [
        {
          fields: ['productId'],
          unique: true,
        },
        {
          fields: ['warehouseLocation'],
        },
      ],
      validate: {
        reservedNotGreaterThanTotal() {
          if (this.reservedQuantity > this.quantity) {
            throw new Error('Reserved quantity cannot be greater than total quantity');
          }
        },
      },
    }
  );

  return Inventory;
}
