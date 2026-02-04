import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { User } from '../config/database';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
  logger,
  generateToken,
} from '@cloudretail/middleware';
import { EventPublisher } from '../events/event-publisher';

const SALT_ROUNDS = 12;

export class UserService {
  private eventPublisher: EventPublisher;

  constructor() {
    this.eventPublisher = new EventPublisher();
  }

  /**
   * Register a new user with GDPR compliance
   */
  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: 'customer' | 'admin' | 'vendor';
    gdprConsent: boolean;
  }) {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ where: { email: userData.email } });
      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      // Validate GDPR consent
      if (!userData.gdprConsent) {
        throw new ValidationError('GDPR consent is required');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, SALT_ROUNDS);

      // Create user
      const user = await User.create({
        ...userData,
        password: hashedPassword,
        role: userData.role || 'customer',
      });

      // Publish user created event
      await this.eventPublisher.publishEvent({
        type: 'user.created',
        payload: {
          userId: user.id,
          email: user.email,
          role: user.role,
        },
      });

      logger.info('User registered successfully', { userId: user.id });

      // Generate JWT token so user is authenticated immediately after registration
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Return token and user without password
      const { password: _pw, twoFactorSecret: _ts, ...userWithoutPassword } = user.toJSON();
      return {
        token,
        user: userWithoutPassword,
      };
    } catch (error) {
      logger.error('Error registering user', { error });
      throw error;
    }
  }

  /**
   * Login user with email and password
   */
  async login(email: string, password: string, twoFactorCode?: string) {
    try {
      const user = await User.findOne({ where: { email } });

      if (!user) {
        throw new UnauthorizedError('Invalid credentials');
      }

      if (!user.isActive) {
        throw new UnauthorizedError('Account is deactivated');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedError('Invalid credentials');
      }

      // Check two-factor authentication
      if (user.twoFactorEnabled) {
        if (!twoFactorCode) {
          throw new ValidationError('Two-factor authentication code is required');
        }

        const isTwoFactorValid = speakeasy.totp.verify({
          secret: user.twoFactorSecret!,
          encoding: 'base32',
          token: twoFactorCode,
        });

        if (!isTwoFactorValid) {
          throw new UnauthorizedError('Invalid two-factor authentication code');
        }
      }

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      logger.info('User logged in successfully', { userId: user.id });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      };
    } catch (error) {
      logger.error('Error during login', { error });
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new NotFoundError('User');
    }

    const { password, twoFactorSecret, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
  }

  /**
   * Update user profile
   */
  async updateUser(userId: string, updates: Partial<{
    firstName: string;
    lastName: string;
    email: string;
  }>) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new NotFoundError('User');
    }

    // If email is being updated, check for conflicts
    if (updates.email && updates.email !== user.email) {
      const existingUser = await User.findOne({ where: { email: updates.email } });
      if (existingUser) {
        throw new ConflictError('Email already in use');
      }
    }

    await user.update(updates);

    // Publish user updated event
    await this.eventPublisher.publishEvent({
      type: 'user.updated',
      payload: {
        userId: user.id,
        updates,
      },
    });

    logger.info('User updated successfully', { userId });

    const { password, twoFactorSecret, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
  }

  /**
   * Enable two-factor authentication
   */
  async enableTwoFactor(userId: string) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new NotFoundError('User');
    }

    if (user.twoFactorEnabled) {
      throw new ConflictError('Two-factor authentication is already enabled');
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `CloudRetail (${user.email})`,
      issuer: 'CloudRetail',
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    // Save secret
    await user.update({
      twoFactorSecret: secret.base32,
    });

    logger.info('Two-factor authentication secret generated', { userId });

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
    };
  }

  /**
   * Verify and activate two-factor authentication
   */
  async verifyTwoFactor(userId: string, token: string) {
    const user = await User.findByPk(userId);

    if (!user || !user.twoFactorSecret) {
      throw new NotFoundError('User or two-factor secret not found');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
    });

    if (!isValid) {
      throw new ValidationError('Invalid two-factor authentication code');
    }

    await user.update({ twoFactorEnabled: true });

    logger.info('Two-factor authentication enabled', { userId });

    return { success: true, message: 'Two-factor authentication enabled successfully' };
  }

  /**
   * Delete user (GDPR compliance - right to be forgotten)
   */
  async deleteUser(userId: string) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new NotFoundError('User');
    }

    await user.destroy();

    // Publish user deleted event
    await this.eventPublisher.publishEvent({
      type: 'user.deleted',
      payload: {
        userId,
        email: user.email,
      },
    });

    logger.info('User deleted (GDPR compliance)', { userId });

    return { success: true, message: 'User account deleted successfully' };
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(filters?: {
    role?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters?.role) {
      where.role = filters.role;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const users = await User.findAndCountAll({
      where,
      limit: filters?.limit || 100,
      offset: filters?.offset || 0,
      attributes: { exclude: ['password', 'twoFactorSecret'] },
      order: [['createdAt', 'DESC']],
    });

    return {
      users: users.rows,
      total: users.count,
      limit: filters?.limit || 100,
      offset: filters?.offset || 0,
    };
  }
}
