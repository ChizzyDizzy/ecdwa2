/**
 * Unit tests for User Service
 * Tests all CRUD operations, authentication, 2FA, and GDPR compliance
 */

import { UserService } from '../../src/services/user.service';
import { User } from '../../src/config/database';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
} from '@cloudretail/middleware';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('bcrypt');
jest.mock('speakeasy');
jest.mock('qrcode');
jest.mock('../../src/events/event-publisher');

describe('UserService', () => {
  let userService: UserService;
  let mockEventPublisher: any;

  beforeEach(() => {
    jest.clearAllMocks();
    userService = new UserService();
    mockEventPublisher = (userService as any).eventPublisher;
    mockEventPublisher.publishEvent = jest.fn().mockResolvedValue(undefined);
  });

  describe('register', () => {
    const validUserData = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe',
      gdprConsent: true,
    };

    it('should successfully register a new user', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        ...validUserData,
        password: 'hashedPassword',
        role: 'customer',
        toJSON: () => ({ id: '123', email: validUserData.email, firstName: 'John', lastName: 'Doe', role: 'customer' }),
      };

      (User.findOne as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      (User.create as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await userService.register(validUserData);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ where: { email: validUserData.email } });
      expect(bcrypt.hash).toHaveBeenCalledWith(validUserData.password, 12);
      expect(User.create).toHaveBeenCalledWith({
        ...validUserData,
        password: 'hashedPassword',
        role: 'customer',
      });
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'user.created',
        payload: {
          userId: '123',
          email: validUserData.email,
          role: 'customer',
        },
      });
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('twoFactorSecret');
    });

    it('should throw ConflictError if user already exists', async () => {
      // Arrange
      (User.findOne as jest.Mock).mockResolvedValue({ id: '123', email: validUserData.email });

      // Act & Assert
      await expect(userService.register(validUserData)).rejects.toThrow(ConflictError);
      await expect(userService.register(validUserData)).rejects.toThrow('User with this email already exists');
      expect(User.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if GDPR consent is not given', async () => {
      // Arrange
      const userDataWithoutConsent = { ...validUserData, gdprConsent: false };
      (User.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(userService.register(userDataWithoutConsent)).rejects.toThrow(ValidationError);
      await expect(userService.register(userDataWithoutConsent)).rejects.toThrow('GDPR consent is required');
      expect(User.create).not.toHaveBeenCalled();
    });

    it('should register user with admin role when specified', async () => {
      // Arrange
      const adminUserData = { ...validUserData, role: 'admin' as const };
      const mockUser = {
        id: '123',
        ...adminUserData,
        password: 'hashedPassword',
        toJSON: () => ({ id: '123', email: adminUserData.email, role: 'admin' }),
      };

      (User.findOne as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      (User.create as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await userService.register(adminUserData);

      // Assert
      expect(User.create).toHaveBeenCalledWith({
        ...adminUserData,
        password: 'hashedPassword',
        role: 'admin',
      });
    });
  });

  describe('login', () => {
    const email = 'test@example.com';
    const password = 'Password123!';

    it('should successfully login with valid credentials', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email,
        password: 'hashedPassword',
        isActive: true,
        twoFactorEnabled: false,
        role: 'customer',
        firstName: 'John',
        lastName: 'Doe',
      };

      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await userService.login(email, password);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ where: { email } });
      expect(bcrypt.compare).toHaveBeenCalledWith(password, 'hashedPassword');
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user).toEqual({
        id: '123',
        email,
        firstName: 'John',
        lastName: 'Doe',
        role: 'customer',
      });
    });

    it('should throw UnauthorizedError if user not found', async () => {
      // Arrange
      (User.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(userService.login(email, password)).rejects.toThrow(UnauthorizedError);
      await expect(userService.login(email, password)).rejects.toThrow('Invalid credentials');
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedError if password is invalid', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email,
        password: 'hashedPassword',
        isActive: true,
        twoFactorEnabled: false,
      };

      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(userService.login(email, password)).rejects.toThrow(UnauthorizedError);
      await expect(userService.login(email, password)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedError if account is deactivated', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email,
        password: 'hashedPassword',
        isActive: false,
        twoFactorEnabled: false,
      };

      (User.findOne as jest.Mock).mockResolvedValue(mockUser);

      // Act & Assert
      await expect(userService.login(email, password)).rejects.toThrow(UnauthorizedError);
      await expect(userService.login(email, password)).rejects.toThrow('Account is deactivated');
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should require 2FA code when two-factor authentication is enabled', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email,
        password: 'hashedPassword',
        isActive: true,
        twoFactorEnabled: true,
        twoFactorSecret: 'secret123',
        role: 'customer',
      };

      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act & Assert
      await expect(userService.login(email, password)).rejects.toThrow(ValidationError);
      await expect(userService.login(email, password)).rejects.toThrow('Two-factor authentication code is required');
    });

    it('should successfully login with valid 2FA code', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email,
        password: 'hashedPassword',
        isActive: true,
        twoFactorEnabled: true,
        twoFactorSecret: 'secret123',
        role: 'customer',
        firstName: 'John',
        lastName: 'Doe',
      };

      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      // Act
      const result = await userService.login(email, password, '123456');

      // Assert
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'secret123',
        encoding: 'base32',
        token: '123456',
      });
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
    });

    it('should throw UnauthorizedError with invalid 2FA code', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email,
        password: 'hashedPassword',
        isActive: true,
        twoFactorEnabled: true,
        twoFactorSecret: 'secret123',
      };

      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      // Act & Assert
      await expect(userService.login(email, password, '000000')).rejects.toThrow(UnauthorizedError);
      await expect(userService.login(email, password, '000000')).rejects.toThrow('Invalid two-factor authentication code');
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'customer',
        toJSON: () => ({ id: '123', email: 'test@example.com', firstName: 'John', lastName: 'Doe', role: 'customer' }),
      };

      (User.findByPk as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await userService.getUserById('123');

      // Assert
      expect(User.findByPk).toHaveBeenCalledWith('123');
      expect(result).toEqual({ id: '123', email: 'test@example.com', firstName: 'John', lastName: 'Doe', role: 'customer' });
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('twoFactorSecret');
    });

    it('should throw NotFoundError if user does not exist', async () => {
      // Arrange
      (User.findByPk as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(userService.getUserById('999')).rejects.toThrow(NotFoundError);
      await expect(userService.getUserById('999')).rejects.toThrow('User');
    });
  });

  describe('updateUser', () => {
    it('should successfully update user profile', async () => {
      // Arrange
      const updates = { firstName: 'Jane', lastName: 'Smith' };
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        update: jest.fn().mockResolvedValue(undefined),
        toJSON: () => ({ id: '123', email: 'test@example.com', firstName: 'Jane', lastName: 'Smith' }),
      };

      (User.findByPk as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await userService.updateUser('123', updates);

      // Assert
      expect(User.findByPk).toHaveBeenCalledWith('123');
      expect(mockUser.update).toHaveBeenCalledWith(updates);
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'user.updated',
        payload: {
          userId: '123',
          updates,
        },
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundError if user does not exist', async () => {
      // Arrange
      (User.findByPk as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(userService.updateUser('999', { firstName: 'Jane' })).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError if new email already exists', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        update: jest.fn(),
      };
      const existingUser = { id: '456', email: 'new@example.com' };

      (User.findByPk as jest.Mock).mockResolvedValue(mockUser);
      (User.findOne as jest.Mock).mockResolvedValue(existingUser);

      // Act & Assert
      await expect(userService.updateUser('123', { email: 'new@example.com' })).rejects.toThrow(ConflictError);
      await expect(userService.updateUser('123', { email: 'new@example.com' })).rejects.toThrow('Email already in use');
      expect(mockUser.update).not.toHaveBeenCalled();
    });

    it('should allow updating to same email', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        update: jest.fn().mockResolvedValue(undefined),
        toJSON: () => ({ id: '123', email: 'test@example.com' }),
      };

      (User.findByPk as jest.Mock).mockResolvedValue(mockUser);

      // Act
      await userService.updateUser('123', { email: 'test@example.com' });

      // Assert
      expect(User.findOne).not.toHaveBeenCalled();
      expect(mockUser.update).toHaveBeenCalled();
    });
  });

  describe('enableTwoFactor', () => {
    it('should generate 2FA secret and QR code', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        twoFactorEnabled: false,
        update: jest.fn().mockResolvedValue(undefined),
      };
      const mockSecret = {
        base32: 'SECRET123',
        otpauth_url: 'otpauth://totp/CloudRetail:test@example.com?secret=SECRET123&issuer=CloudRetail',
      };
      const mockQRCode = 'data:image/png;base64,mockqrcode';

      (User.findByPk as jest.Mock).mockResolvedValue(mockUser);
      (speakeasy.generateSecret as jest.Mock).mockReturnValue(mockSecret);
      (QRCode.toDataURL as jest.Mock).mockResolvedValue(mockQRCode);

      // Act
      const result = await userService.enableTwoFactor('123');

      // Assert
      expect(User.findByPk).toHaveBeenCalledWith('123');
      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: 'CloudRetail (test@example.com)',
        issuer: 'CloudRetail',
      });
      expect(QRCode.toDataURL).toHaveBeenCalledWith(mockSecret.otpauth_url);
      expect(mockUser.update).toHaveBeenCalledWith({
        twoFactorSecret: 'SECRET123',
      });
      expect(result).toEqual({
        secret: 'SECRET123',
        qrCode: mockQRCode,
      });
    });

    it('should throw NotFoundError if user does not exist', async () => {
      // Arrange
      (User.findByPk as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(userService.enableTwoFactor('999')).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError if 2FA already enabled', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        twoFactorEnabled: true,
      };

      (User.findByPk as jest.Mock).mockResolvedValue(mockUser);

      // Act & Assert
      await expect(userService.enableTwoFactor('123')).rejects.toThrow(ConflictError);
      await expect(userService.enableTwoFactor('123')).rejects.toThrow('Two-factor authentication is already enabled');
    });
  });

  describe('verifyTwoFactor', () => {
    it('should verify and activate 2FA with valid code', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        twoFactorSecret: 'SECRET123',
        twoFactorEnabled: false,
        update: jest.fn().mockResolvedValue(undefined),
      };

      (User.findByPk as jest.Mock).mockResolvedValue(mockUser);
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      // Act
      const result = await userService.verifyTwoFactor('123', '123456');

      // Assert
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'SECRET123',
        encoding: 'base32',
        token: '123456',
      });
      expect(mockUser.update).toHaveBeenCalledWith({ twoFactorEnabled: true });
      expect(result).toEqual({
        success: true,
        message: 'Two-factor authentication enabled successfully',
      });
    });

    it('should throw ValidationError with invalid code', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        twoFactorSecret: 'SECRET123',
      };

      (User.findByPk as jest.Mock).mockResolvedValue(mockUser);
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      // Act & Assert
      await expect(userService.verifyTwoFactor('123', '000000')).rejects.toThrow(ValidationError);
      await expect(userService.verifyTwoFactor('123', '000000')).rejects.toThrow('Invalid two-factor authentication code');
    });

    it('should throw NotFoundError if user or secret not found', async () => {
      // Arrange
      (User.findByPk as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(userService.verifyTwoFactor('999', '123456')).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteUser', () => {
    it('should delete user and publish event (GDPR compliance)', async () => {
      // Arrange
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        destroy: jest.fn().mockResolvedValue(undefined),
      };

      (User.findByPk as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await userService.deleteUser('123');

      // Assert
      expect(User.findByPk).toHaveBeenCalledWith('123');
      expect(mockUser.destroy).toHaveBeenCalled();
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'user.deleted',
        payload: {
          userId: '123',
          email: 'test@example.com',
        },
      });
      expect(result).toEqual({
        success: true,
        message: 'User account deleted successfully',
      });
    });

    it('should throw NotFoundError if user does not exist', async () => {
      // Arrange
      (User.findByPk as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(userService.deleteUser('999')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getAllUsers', () => {
    it('should return all users with pagination', async () => {
      // Arrange
      const mockUsers = [
        { id: '1', email: 'user1@example.com', role: 'customer' },
        { id: '2', email: 'user2@example.com', role: 'customer' },
      ];

      (User.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: mockUsers,
        count: 2,
      });

      // Act
      const result = await userService.getAllUsers({ limit: 10, offset: 0 });

      // Assert
      expect(User.findAndCountAll).toHaveBeenCalledWith({
        where: {},
        limit: 10,
        offset: 0,
        attributes: { exclude: ['password', 'twoFactorSecret'] },
        order: [['createdAt', 'DESC']],
      });
      expect(result).toEqual({
        users: mockUsers,
        total: 2,
        limit: 10,
        offset: 0,
      });
    });

    it('should filter users by role', async () => {
      // Arrange
      const mockUsers = [{ id: '1', email: 'admin@example.com', role: 'admin' }];

      (User.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: mockUsers,
        count: 1,
      });

      // Act
      const result = await userService.getAllUsers({ role: 'admin' });

      // Assert
      expect(User.findAndCountAll).toHaveBeenCalledWith({
        where: { role: 'admin' },
        limit: 100,
        offset: 0,
        attributes: { exclude: ['password', 'twoFactorSecret'] },
        order: [['createdAt', 'DESC']],
      });
      expect(result.users).toEqual(mockUsers);
    });

    it('should filter users by isActive status', async () => {
      // Arrange
      (User.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: [],
        count: 0,
      });

      // Act
      await userService.getAllUsers({ isActive: false });

      // Assert
      expect(User.findAndCountAll).toHaveBeenCalledWith({
        where: { isActive: false },
        limit: 100,
        offset: 0,
        attributes: { exclude: ['password', 'twoFactorSecret'] },
        order: [['createdAt', 'DESC']],
      });
    });
  });
});
