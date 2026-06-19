import { describe, it, expect, beforeAll } from 'vitest';
import { appRouter } from '../routers/_app.js';
import { createTestContext } from '../test/setup.js';
import { createTestOrg, createTestUser } from '../test/factory.js';

describe('Invoice Router', () => {
  let testOrg: any;
  let testUser: any;
  let caller: any;
  let testContact: any;

  beforeAll(async () => {
    testOrg = await createTestOrg();
    testUser = await createTestUser(testOrg.id, 'owner');
    caller = appRouter.createCaller(createTestContext(testUser, testOrg.id));

    testContact = await caller.contact.create({
      fullName: 'Invoice Test Client',
      email: `invoice-client-${Date.now()}@example.com`,
      type: 'client',
    });
  });

  describe('createInvoice', () => {
    it('should create an invoice with lines', async () => {
      const subtotal = 1000;
      const taxAmount = 80;
      const discountAmount = 50;
      const totalAmount = subtotal + taxAmount - discountAmount;

      const result = await caller.invoice.createInvoice({
        invoiceNumber: `INV-${Date.now()}`,
        contactId: testContact.id,
        issueDate: '2024-01-15',
        dueDate: '2024-02-15',
        subtotal: subtotal.toString(),
        taxAmount: taxAmount.toString(),
        discountAmount: discountAmount.toString(),
        totalAmount: totalAmount.toString(),
        lines: [
          {
            lineNumber: 1,
            description: 'Consulting services',
            quantity: '10',
            unitPrice: '100',
            amount: '1000',
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result.invoiceNumber).toBeDefined();
      expect(result.contactId).toBe(testContact.id);
      expect(result.status).toBe('draft');
      expect(parseFloat(result.subtotal)).toBe(subtotal);
      expect(parseFloat(result.taxAmount)).toBe(taxAmount);
      expect(parseFloat(result.discountAmount)).toBe(discountAmount);
      expect(parseFloat(result.totalAmount)).toBe(totalAmount);
    });
  });

  describe('updateInvoice', () => {
    it('should update invoice status to sent', async () => {
      const invoice = await caller.invoice.createInvoice({
        invoiceNumber: `INV-UPDATE-${Date.now()}`,
        contactId: testContact.id,
        issueDate: '2024-01-15',
        dueDate: '2024-02-15',
        subtotal: '500',
        totalAmount: '500',
        lines: [
          {
            lineNumber: 1,
            description: 'Service',
            quantity: '1',
            unitPrice: '500',
            amount: '500',
          },
        ],
      });

      const updated = await caller.invoice.updateInvoice({
        id: invoice.id,
        status: 'sent',
      });

      expect(updated.status).toBe('sent');
      expect(updated.sentAt).toBeDefined();
    });
  });

  describe('recordPayment', () => {
    it('should record a payment and update invoice status', async () => {
      const invoice = await caller.invoice.createInvoice({
        invoiceNumber: `INV-PAY-${Date.now()}`,
        contactId: testContact.id,
        issueDate: '2024-01-15',
        dueDate: '2024-02-15',
        subtotal: '1000',
        totalAmount: '1000',
        lines: [
          {
            lineNumber: 1,
            description: 'Service',
            quantity: '1',
            unitPrice: '1000',
            amount: '1000',
          },
        ],
      });

      // Record partial payment
      const paymentResult = await caller.invoice.recordPayment({
        invoiceId: invoice.id,
        amount: '500',
        paymentDate: '2024-01-20',
        paymentMethod: 'check',
      });

      expect(paymentResult.payment).toBeDefined();
      expect(paymentResult.payment.amount).toBe('500.00');
      expect(paymentResult.invoice.status).toBe('partially_paid');
      expect(parseFloat(paymentResult.invoice.amountPaid)).toBe(500);
      expect(parseFloat(paymentResult.invoice.amountDue)).toBe(500);

      // Record remaining payment to fully pay
      const finalPayment = await caller.invoice.recordPayment({
        invoiceId: invoice.id,
        amount: '500',
        paymentDate: '2024-01-25',
        paymentMethod: 'ach',
      });

      expect(finalPayment.invoice.status).toBe('paid');
      expect(parseFloat(finalPayment.invoice.amountPaid)).toBe(1000);
      expect(parseFloat(finalPayment.invoice.amountDue)).toBe(0);
    });
  });

  describe('amount calculations', () => {
    it('should verify subtotal + tax - discount = total', async () => {
      const subtotal = 2000;
      const taxAmount = 160;
      const discountAmount = 100;
      const totalAmount = subtotal + taxAmount - discountAmount;

      const invoice = await caller.invoice.createInvoice({
        invoiceNumber: `INV-CALC-${Date.now()}`,
        contactId: testContact.id,
        issueDate: '2024-01-15',
        dueDate: '2024-02-15',
        subtotal: subtotal.toString(),
        taxAmount: taxAmount.toString(),
        discountAmount: discountAmount.toString(),
        totalAmount: totalAmount.toString(),
        lines: [
          {
            lineNumber: 1,
            description: 'Item 1',
            quantity: '2',
            unitPrice: '1000',
            amount: '2000',
          },
        ],
      });

      const fetched = await caller.invoice.getInvoiceById({ id: invoice.id });

      const fetchedSubtotal = parseFloat(fetched.subtotal);
      const fetchedTax = parseFloat(fetched.taxAmount ?? '0');
      const fetchedDiscount = parseFloat(fetched.discountAmount ?? '0');
      const fetchedTotal = parseFloat(fetched.totalAmount);

      expect(fetchedSubtotal + fetchedTax - fetchedDiscount).toBe(fetchedTotal);
      expect(fetchedTotal).toBe(totalAmount);
    });
  });
});
