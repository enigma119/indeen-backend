import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as PDFDocument from 'pdfkit';
import { Readable } from 'stream';

interface InvoiceData {
  invoiceNumber: string;
  date: Date;
  dueDate?: Date;
  mentee: {
    name: string;
    email: string;
  };
  mentor: {
    name: string;
    email: string;
  };
  session: {
    date: Date;
    duration: number;
    description?: string;
  };
  payment: {
    amount: number;
    currency: string;
    platformFee: number;
    processorFee: number;
    total: number;
  };
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate PDF invoice for a payment
   */
  async generateInvoice(
    paymentId: string,
    userId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        session: {
          include: {
            mentorProfile: {
              include: { user: true },
            },
            menteeProfile: {
              include: { user: true },
            },
          },
        },
        payer: true,
        payeeMentor: {
          include: { user: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Verify user can access this invoice
    const isParticipant =
      payment.session.mentorProfile.userId === userId ||
      payment.session.menteeProfile.userId === userId;

    if (!isParticipant) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user?.role !== 'ADMIN') {
        throw new ForbiddenException('You cannot access this invoice');
      }
    }

    if (payment.status !== 'COMPLETED' && payment.status !== 'REFUNDED' && payment.status !== 'PARTIALLY_REFUNDED') {
      throw new NotFoundException('Invoice only available for completed payments');
    }

    const invoiceData: InvoiceData = {
      invoiceNumber: payment.invoiceNumber || `INV-${payment.id.substring(0, 8)}`,
      date: payment.paidAt || payment.createdAt,
      mentee: {
        name: `${payment.session.menteeProfile.user.firstName || ''} ${payment.session.menteeProfile.user.lastName || ''}`.trim() || 'Mentee',
        email: payment.session.menteeProfile.user.email,
      },
      mentor: {
        name: `${payment.session.mentorProfile.user.firstName || ''} ${payment.session.mentorProfile.user.lastName || ''}`.trim() || 'Mentor',
        email: payment.session.mentorProfile.user.email,
      },
      session: {
        date: payment.session.scheduledAt,
        duration: payment.session.durationMinutes,
        description: payment.session.lessonPlan || 'Islamic mentoring session',
      },
      payment: {
        amount: Number(payment.amountPaid),
        currency: payment.currencyPaid,
        platformFee: Number(payment.platformFee),
        processorFee: Number(payment.paymentProcessorFee),
        total: Number(payment.amountPaid),
      },
    };

    const buffer = await this.createPDF(invoiceData);
    const filename = `invoice_${invoiceData.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    this.logger.log(`Generated invoice ${invoiceData.invoiceNumber} for payment ${paymentId}`);

    return { buffer, filename };
  }

  /**
   * Get invoice data (without generating PDF)
   */
  async getInvoiceData(paymentId: string, userId: string): Promise<InvoiceData> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        session: {
          include: {
            mentorProfile: {
              include: { user: true },
            },
            menteeProfile: {
              include: { user: true },
            },
          },
        },
        payer: true,
        payeeMentor: {
          include: { user: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Verify user can access this invoice
    const isParticipant =
      payment.session.mentorProfile.userId === userId ||
      payment.session.menteeProfile.userId === userId;

    if (!isParticipant) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user?.role !== 'ADMIN') {
        throw new ForbiddenException('You cannot access this invoice');
      }
    }

    return {
      invoiceNumber: payment.invoiceNumber || `INV-${payment.id.substring(0, 8)}`,
      date: payment.paidAt || payment.createdAt,
      mentee: {
        name: `${payment.session.menteeProfile.user.firstName || ''} ${payment.session.menteeProfile.user.lastName || ''}`.trim() || 'Mentee',
        email: payment.session.menteeProfile.user.email,
      },
      mentor: {
        name: `${payment.session.mentorProfile.user.firstName || ''} ${payment.session.mentorProfile.user.lastName || ''}`.trim() || 'Mentor',
        email: payment.session.mentorProfile.user.email,
      },
      session: {
        date: payment.session.scheduledAt,
        duration: payment.session.durationMinutes,
        description: payment.session.lessonPlan || 'Islamic mentoring session',
      },
      payment: {
        amount: Number(payment.amountPaid),
        currency: payment.currencyPaid,
        platformFee: Number(payment.platformFee),
        processorFee: Number(payment.paymentProcessorFee),
        total: Number(payment.amountPaid),
      },
    };
  }

  // ==================== Private Methods ====================

  private async createPDF(data: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
      doc.moveDown();

      // Invoice details
      doc.fontSize(10).font('Helvetica');
      doc.text(`Invoice Number: ${data.invoiceNumber}`);
      doc.text(`Date: ${this.formatDate(data.date)}`);
      doc.moveDown();

      // Separator
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      // From (Platform)
      doc.font('Helvetica-Bold').text('From:');
      doc.font('Helvetica').text('Indeen - Islamic Mentorship Platform');
      doc.text('contact@indeen.com');
      doc.moveDown();

      // To (Mentee)
      doc.font('Helvetica-Bold').text('Bill To:');
      doc.font('Helvetica').text(data.mentee.name);
      doc.text(data.mentee.email);
      doc.moveDown();

      // Mentor info
      doc.font('Helvetica-Bold').text('Mentor:');
      doc.font('Helvetica').text(data.mentor.name);
      doc.moveDown();

      // Separator
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      // Session details
      doc.font('Helvetica-Bold').text('Session Details:');
      doc.font('Helvetica');
      doc.text(`Date: ${this.formatDate(data.session.date)}`);
      doc.text(`Duration: ${data.session.duration} minutes`);
      if (data.session.description) {
        doc.text(`Description: ${data.session.description}`);
      }
      doc.moveDown();

      // Separator
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      // Payment breakdown
      doc.font('Helvetica-Bold').text('Payment Details:');
      doc.font('Helvetica');

      const currencySymbol = this.getCurrencySymbol(data.payment.currency);

      // Table-like format
      const leftCol = 50;
      const rightCol = 450;
      let currentY = doc.y + 10;

      doc.text('Session Fee:', leftCol, currentY);
      doc.text(`${currencySymbol}${data.payment.amount.toFixed(2)}`, rightCol, currentY, {
        align: 'right',
        width: 100,
      });

      currentY += 20;

      // Separator line
      doc.moveTo(leftCol, currentY + 10).lineTo(550, currentY + 10).stroke();

      currentY += 25;
      doc.font('Helvetica-Bold');
      doc.text('Total Paid:', leftCol, currentY);
      doc.text(`${currencySymbol}${data.payment.total.toFixed(2)}`, rightCol, currentY, {
        align: 'right',
        width: 100,
      });

      // Footer
      doc.font('Helvetica').fontSize(8);
      const footerY = doc.page.height - 100;
      doc.text(
        'Thank you for using Indeen. This invoice is automatically generated.',
        50,
        footerY,
        { align: 'center', width: 500 },
      );
      doc.text(
        'For questions, please contact support@indeen.com',
        50,
        footerY + 15,
        { align: 'center', width: 500 },
      );

      doc.end();
    });
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  private getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
      EUR: '€',
      USD: '$',
      GBP: '£',
      MAD: 'MAD ',
      SAR: 'SAR ',
      AED: 'AED ',
    };
    return symbols[currency.toUpperCase()] || `${currency} `;
  }
}
