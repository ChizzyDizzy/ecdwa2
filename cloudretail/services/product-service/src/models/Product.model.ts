import { Model, DataTypes, Sequelize } from 'sequelize';

export interface ProductAttributes {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  sku: string;
  vendorId: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Product extends Model<ProductAttributes> implements ProductAttributes {
  public id!: string;
  public name!: string;
  public description!: string;
  public price!: number;
  public category!: string;
  public sku!: string;
  public vendorId!: string;
  public isActive!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function initProductModel(sequelize: Sequelize): typeof Product {
  Product.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 255],
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      category: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      sku: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
        },
      },
      vendorId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      sequelize,
      tableName: 'products',
      timestamps: true,
      indexes: [
        {
          fields: ['category'],
        },
        {
          fields: ['vendorId'],
        },
        {
          fields: ['sku'],
          unique: true,
        },
      ],
    }
  );

  return Product;
}
