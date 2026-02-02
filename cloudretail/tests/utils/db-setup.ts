/**
 * Test database setup and teardown utilities
 */

import { Sequelize } from 'sequelize';

let sequelize: Sequelize | null = null;

/**
 * Initialize test database connection
 */
export const initTestDb = async (dbName: string = 'test_db') => {
  sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: dbName,
    username: process.env.DB_USER || 'test',
    password: process.env.DB_PASSWORD || 'test',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });

  try {
    await sequelize.authenticate();
    console.log('Test database connection established');
    return sequelize;
  } catch (error) {
    console.error('Unable to connect to test database:', error);
    throw error;
  }
};

/**
 * Close test database connection
 */
export const closeTestDb = async () => {
  if (sequelize) {
    await sequelize.close();
    sequelize = null;
    console.log('Test database connection closed');
  }
};

/**
 * Clear all tables in test database
 */
export const clearTestDb = async () => {
  if (sequelize) {
    await sequelize.truncate({ cascade: true, restartIdentity: true });
    console.log('Test database cleared');
  }
};

/**
 * Sync models with test database
 */
export const syncTestDb = async (force: boolean = false) => {
  if (sequelize) {
    await sequelize.sync({ force });
    console.log('Test database synced');
  }
};

/**
 * Get test database instance
 */
export const getTestDb = () => sequelize;

/**
 * Run migrations for test database
 */
export const runTestMigrations = async () => {
  // Implement migration logic here
  console.log('Running test migrations...');
};

/**
 * Rollback migrations for test database
 */
export const rollbackTestMigrations = async () => {
  // Implement rollback logic here
  console.log('Rolling back test migrations...');
};

/**
 * Seed test database with sample data
 */
export const seedTestDb = async (seedData: any) => {
  if (sequelize) {
    // Implement seeding logic here
    console.log('Seeding test database...');
  }
};

/**
 * Create test database transaction
 */
export const createTestTransaction = async () => {
  if (sequelize) {
    return await sequelize.transaction();
  }
  throw new Error('Database not initialized');
};

/**
 * Execute in transaction
 */
export const executeInTransaction = async (callback: (transaction: any) => Promise<void>) => {
  const transaction = await createTestTransaction();
  try {
    await callback(transaction);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
