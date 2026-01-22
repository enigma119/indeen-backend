import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prismaService: PrismaService;
  let stripeService: StripeService;

  const mockPrismaService = {
    session: {
      findUnique: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    mentorProfile: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockStripeService = {
    createPaymentIntent: jest.fn(),
    getPaymentIntent: jest.fn(),
    refundPaymentIntent: jest.fn(),
    calculateMentorAmount: jest.fn(),
    calculatePlatformFee: jest.fn(),
  };

  const mockMentorProfile = {
    id: 'mentor-profile-id',
    userId: 'mentor-user-id',
    hourlyRate: 50,
    currency: 'EUR',
    freeSessionsOnly: false,
    user: {
      id: 'mentor-user-id',
      email: 'mentor@test.com',
      firstName: 'John',
      lastName: 'Mentor',
    },
  };

  const mockMenteeProfile = {
    id: 'mentee-profile-id',
    userId: 'mentee-user-id',
    user: {
      id: 'mentee-user-id',
      email: 'mentee@test.com',
      firstName: 'Jane',
      lastName: 'Mentee',
    },
  };

  const mockSession = {
    id: 'session-id',
    mentorProfileId: 'mentor-profile-id',
    menteeProfileId: 'mentee-profile-id',
    scheduledAt: new Date('2025-01-20T10:00:00Z'),
    durationMinutes: 60,
    status: 'SCHEDULED',
    mentorProfile: mockMentorProfile,
    menteeProfile: mockMenteeProfile,
    payment: null,
  };

  const mockPayment = {
    id: 'payment-id',
    sessionId: 'session-id',
    payerUserId: 'mentee-user-id',
    payeeMentorId: 'mentor-profile-id',
    amountPaid: 50,
    currencyPaid: 'EUR',
    amountToMentor: 40.75,
    currencyToMentor: 'EUR',
    platformFee: 7.5,
    platformFeePercentage: 15,
    paymentProcessorFee: 1.75,
    status: 'PENDING',
    stripePaymentIntentId: 'pi_test123',
    refundedAmount: 0,
    session: mockSession,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StripeService, useValue: mockStripeService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prismaService = module.get<PrismaService>(PrismaService);
    stripeService = module.get<StripeService>(StripeService);

    jest.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent for a session', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockStripeService.calculateMentorAmount.mockReturnValue({
        platformFee: 7.5,
        stripeFee: 1.75,
        mentorAmount: 40.75,
      });
      mockStripeService.createPaymentIntent.mockResolvedValue({
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
      });
      mockPrismaService.payment.create.mockResolvedValue(mockPayment);

      const result = await service.createPaymentIntent('mentee-user-id', {
        sessionId: 'session-id',
      });

      expect(result.paymentIntentId).toBe('pi_test123');
      expect(result.clientSecret).toBe('pi_test123_secret');
      expect(result.amount).toBe(50);
      expect(result.currency).toBe('EUR');
    });

    it('should throw NotFoundException if session not found', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      await expect(
        service.createPaymentIntent('mentee-user-id', { sessionId: 'invalid-id' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the mentee', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);

      await expect(
        service.createPaymentIntent('other-user-id', { sessionId: 'session-id' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if session is already paid', async () => {
      const paidSession = {
        ...mockSession,
        payment: { ...mockPayment, status: 'COMPLETED' },
      };
      mockPrismaService.session.findUnique.mockResolvedValue(paidSession);

      await expect(
        service.createPaymentIntent('mentee-user-id', { sessionId: 'session-id' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle free sessions', async () => {
      const freeMentorSession = {
        ...mockSession,
        mentorProfile: { ...mockMentorProfile, freeSessionsOnly: true },
      };
      mockPrismaService.session.findUnique.mockResolvedValue(freeMentorSession);
      mockPrismaService.payment.create.mockResolvedValue({
        ...mockPayment,
        amountPaid: 0,
        status: 'COMPLETED',
      });

      const result = await service.createPaymentIntent('mentee-user-id', {
        sessionId: 'session-id',
      });

      expect(result.amount).toBe(0);
      expect(result.paymentIntentId).toBe('free_session');
    });
  });

  describe('confirmPayment', () => {
    it('should confirm a payment', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockStripeService.getPaymentIntent.mockResolvedValue({
        status: 'succeeded',
        payment_method_types: ['card'],
        latest_charge: 'ch_test123',
      });
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: 'COMPLETED',
        paidAt: new Date(),
      });

      const result = await service.confirmPayment('pi_test123');

      expect(result.status).toBe('COMPLETED');
      expect(mockPrismaService.payment.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if payment not found', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      await expect(service.confirmPayment('invalid-pi')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return existing payment if already completed', async () => {
      const completedPayment = { ...mockPayment, status: 'COMPLETED' };
      mockPrismaService.payment.findUnique.mockResolvedValue(completedPayment);

      const result = await service.confirmPayment('pi_test123');

      expect(result.status).toBe('COMPLETED');
      expect(mockStripeService.getPaymentIntent).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if payment not succeeded in Stripe', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockStripeService.getPaymentIntent.mockResolvedValue({
        status: 'requires_payment_method',
      });

      await expect(service.confirmPayment('pi_test123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getPaymentStatus', () => {
    it('should return payment status for mentee', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

      const result = await service.getPaymentStatus('session-id', 'mentee-user-id');

      expect(result.id).toBe('payment-id');
      expect(result.status).toBe('PENDING');
    });

    it('should return payment status for mentor', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

      const result = await service.getPaymentStatus('session-id', 'mentor-user-id');

      expect(result.id).toBe('payment-id');
    });

    it('should throw NotFoundException if payment not found', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      await expect(
        service.getPaymentStatus('invalid-session', 'mentee-user-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-participant non-admin', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrismaService.user.findUnique.mockResolvedValue({ role: 'MENTEE' });

      await expect(
        service.getPaymentStatus('session-id', 'other-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to view any payment', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrismaService.user.findUnique.mockResolvedValue({ role: 'ADMIN' });

      const result = await service.getPaymentStatus('session-id', 'admin-user-id');

      expect(result.id).toBe('payment-id');
    });
  });

  describe('processRefund', () => {
    it('should process full refund for admin', async () => {
      const completedPayment = { ...mockPayment, status: 'COMPLETED' };
      mockPrismaService.payment.findUnique.mockResolvedValue(completedPayment);
      mockPrismaService.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
      mockStripeService.refundPaymentIntent.mockResolvedValue({ id: 're_test123' });
      mockPrismaService.payment.update.mockResolvedValue({
        ...completedPayment,
        status: 'REFUNDED',
        refundedAmount: 50,
      });

      const result = await service.processRefund('session-id', {}, 'admin-user-id');

      expect(result.success).toBe(true);
      expect(result.refundId).toBe('re_test123');
      expect(result.amountRefunded).toBe(50);
    });

    it('should process partial refund', async () => {
      const completedPayment = { ...mockPayment, status: 'COMPLETED' };
      mockPrismaService.payment.findUnique.mockResolvedValue(completedPayment);
      mockPrismaService.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
      mockStripeService.refundPaymentIntent.mockResolvedValue({ id: 're_test123' });
      mockPrismaService.payment.update.mockResolvedValue({
        ...completedPayment,
        status: 'PARTIALLY_REFUNDED',
        refundedAmount: 25,
      });

      const result = await service.processRefund(
        'session-id',
        { amount: 25 },
        'admin-user-id',
      );

      expect(result.amountRefunded).toBe(25);
      expect(result.status).toBe('PARTIALLY_REFUNDED');
    });

    it('should throw ForbiddenException for non-admin', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrismaService.user.findUnique.mockResolvedValue({ role: 'MENTEE' });

      await expect(
        service.processRefund('session-id', {}, 'mentee-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for non-completed payment', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrismaService.user.findUnique.mockResolvedValue({ role: 'ADMIN' });

      await expect(
        service.processRefund('session-id', {}, 'admin-user-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('processAutomaticRefund', () => {
    it('should process automatic refund based on percentage', async () => {
      const completedPayment = { ...mockPayment, status: 'COMPLETED' };
      mockPrismaService.payment.findUnique.mockResolvedValue(completedPayment);
      mockStripeService.refundPaymentIntent.mockResolvedValue({ id: 're_auto123' });
      mockPrismaService.payment.update.mockResolvedValue({
        ...completedPayment,
        status: 'REFUNDED',
        refundedAmount: 50,
      });

      const result = await service.processAutomaticRefund('session-id', 100);

      expect(result).not.toBeNull();
      expect(result!.amountRefunded).toBe(50);
    });

    it('should return null for 0% refund', async () => {
      const result = await service.processAutomaticRefund('session-id', 0);

      expect(result).toBeNull();
    });

    it('should return null if payment not found', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      const result = await service.processAutomaticRefund('session-id', 100);

      expect(result).toBeNull();
    });

    it('should return null if payment not completed', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

      const result = await service.processAutomaticRefund('session-id', 100);

      expect(result).toBeNull();
    });
  });

  describe('getPaymentHistory', () => {
    it('should return payment history for mentee', async () => {
      mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);
      mockPrismaService.payment.count.mockResolvedValue(1);

      const result = await service.getPaymentHistory('mentee-user-id', 'MENTEE', 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { payerUserId: 'mentee-user-id' },
        }),
      );
    });

    it('should return payment history for mentor', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);
      mockPrismaService.payment.count.mockResolvedValue(1);

      const result = await service.getPaymentHistory('mentor-user-id', 'MENTOR', 1, 10);

      expect(result.data).toHaveLength(1);
      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { payeeMentorId: 'mentor-profile-id' },
        }),
      );
    });

    it('should return all payments for admin', async () => {
      mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);
      mockPrismaService.payment.count.mockResolvedValue(1);

      const result = await service.getPaymentHistory('admin-user-id', 'ADMIN', 1, 10);

      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });
  });

  describe('handleFailedPayment', () => {
    it('should mark payment as failed', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: 'FAILED',
      });

      await service.handleFailedPayment('pi_test123');

      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        data: { status: 'FAILED' },
      });
    });

    it('should not throw if payment not found', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      await expect(service.handleFailedPayment('invalid-pi')).resolves.not.toThrow();
    });
  });

  describe('calculatePlatformFee', () => {
    it('should calculate 15% platform fee', () => {
      mockStripeService.calculatePlatformFee.mockReturnValue(7.5);

      const result = service.calculatePlatformFee(50);

      expect(mockStripeService.calculatePlatformFee).toHaveBeenCalledWith(50, 15);
      expect(result).toBe(7.5);
    });
  });
});
