import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';

describe('StripeService', () => {
  let service: StripeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(null), // Stripe not configured for tests
          },
        },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
  });

  describe('isStripeConfigured', () => {
    it('should return false when Stripe is not configured', () => {
      expect(service.isStripeConfigured()).toBe(false);
    });
  });

  describe('calculateStripeFee', () => {
    it('should calculate Stripe fee (2.9% + 0.30)', () => {
      // For 50 EUR: (50 * 0.029) + 0.30 = 1.45 + 0.30 = 1.75
      expect(service.calculateStripeFee(50)).toBe(1.75);
    });

    it('should calculate Stripe fee for 100 EUR', () => {
      // For 100 EUR: (100 * 0.029) + 0.30 = 2.90 + 0.30 = 3.20
      expect(service.calculateStripeFee(100)).toBe(3.2);
    });

    it('should calculate Stripe fee for small amounts', () => {
      // For 10 EUR: (10 * 0.029) + 0.30 = 0.29 + 0.30 = 0.59
      expect(service.calculateStripeFee(10)).toBe(0.59);
    });
  });

  describe('calculatePlatformFee', () => {
    it('should calculate 15% platform fee by default', () => {
      expect(service.calculatePlatformFee(50)).toBe(7.5);
    });

    it('should calculate platform fee with custom percentage', () => {
      expect(service.calculatePlatformFee(100, 20)).toBe(20);
    });

    it('should calculate platform fee for small amounts', () => {
      expect(service.calculatePlatformFee(10)).toBe(1.5);
    });
  });

  describe('calculateMentorAmount', () => {
    it('should calculate mentor amount after fees for 50 EUR', () => {
      const result = service.calculateMentorAmount(50);

      // Platform fee: 7.50 (15% of 50)
      // Stripe fee: 1.75 (2.9% + 0.30)
      // Mentor amount: 50 - 7.50 - 1.75 = 40.75
      expect(result.platformFee).toBe(7.5);
      expect(result.stripeFee).toBe(1.75);
      expect(result.mentorAmount).toBe(40.75);
    });

    it('should calculate mentor amount for 100 EUR', () => {
      const result = service.calculateMentorAmount(100);

      // Platform fee: 15.00 (15% of 100)
      // Stripe fee: 3.20 (2.9% + 0.30)
      // Mentor amount: 100 - 15.00 - 3.20 = 81.80
      expect(result.platformFee).toBe(15);
      expect(result.stripeFee).toBe(3.2);
      expect(result.mentorAmount).toBe(81.8);
    });

    it('should calculate mentor amount with custom platform fee', () => {
      const result = service.calculateMentorAmount(50, 10);

      // Platform fee: 5.00 (10% of 50)
      // Stripe fee: 1.75
      // Mentor amount: 50 - 5.00 - 1.75 = 43.25
      expect(result.platformFee).toBe(5);
      expect(result.stripeFee).toBe(1.75);
      expect(result.mentorAmount).toBe(43.25);
    });

    it('should handle small amounts', () => {
      const result = service.calculateMentorAmount(10);

      // Platform fee: 1.50 (15% of 10)
      // Stripe fee: 0.59 (2.9% + 0.30)
      // Mentor amount: 10 - 1.50 - 0.59 = 7.91
      expect(result.platformFee).toBe(1.5);
      expect(result.stripeFee).toBe(0.59);
      expect(result.mentorAmount).toBe(7.91);
    });
  });
});
