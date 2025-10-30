import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not, IsNull } from "typeorm";
import { Order } from "../order/entities/order.entity";
import { OrderItem } from "../order/entities/order-item.entity";
import { OrderTracking } from "../order/entities/order-tracking.entity";
import { Payment } from "../payment/entities/payment.entity";
import { User } from "../user/entities/user.entity";
import { Store } from "../store/entities/store.entity";
import { Item } from "../item/entities/item.entity";
import { ItemCustomizationGroups } from "../item/entities/item-customization-groups.entity";
import {
  GenerateInvoiceDto,
  InvoiceResponseDto,
  InvoiceFormat,
} from "./dto/invoice.dto";
import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(OrderTracking)
    private readonly orderTrackingRepository: Repository<OrderTracking>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(ItemCustomizationGroups)
    private readonly itemCustomizationGroupsRepository: Repository<ItemCustomizationGroups>,
  ) {}

  /**
   * Generate invoice for an order
   */
  async generateInvoice(
    userId: number,
    orderId: number,
    generateInvoiceDto: GenerateInvoiceDto,
  ): Promise<InvoiceResponseDto | Buffer> {
    try {
      this.logger.log(
        `🧾 Generating invoice for order ${orderId} by user ${userId}`,
      );

      // Get order with all relations
      const order = await this.orderRepository.findOne({
        where: { id: orderId, user: { id: userId } },
        relations: [
          "user",
          "store",
          "store.fulfillments",
          "store.locations",
          "order_items",
          "order_items.item",
          "tracking",
        ],
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      // Get payment information
      const payment = await this.paymentRepository.findOne({
        where: { order: { id: orderId } },
        order: { created_at: "DESC" },
      });

      // Get latest tracking information with agent details
      let latestTracking = await this.orderTrackingRepository.findOne({
        where: {
          order: { id: orderId },
          agent_name: Not(IsNull()), // Only get tracking records that have agent details
        },
        order: { created_at: "DESC" },
      });

      // If no tracking with agent details, get the latest tracking record
      if (!latestTracking) {
        latestTracking = await this.orderTrackingRepository.findOne({
          where: { order: { id: orderId } },
          order: { created_at: "DESC" },
        });
      }

      // Format invoice data
      const invoiceData = await this.formatInvoiceData(
        order,
        payment,
        latestTracking,
        generateInvoiceDto.notes,
      );

      if (generateInvoiceDto.format === InvoiceFormat.JSON) {
        return invoiceData;
      }

      // Generate PDF
      try {
        const pdfBuffer = await this.generatePDF(invoiceData);
        return pdfBuffer;
      } catch (pdfError) {
        this.logger.error(
          "PDF generation failed, falling back to JSON:",
          pdfError,
        );
        return invoiceData;
      }
    } catch (error) {
      this.logger.error(`❌ Error generating invoice:`, error);
      throw error;
    }
  }

  /**
   * Format order data into invoice structure
   */
  private async formatInvoiceData(
    order: Order,
    payment: Payment | null,
    tracking: OrderTracking | null,
    notes?: string,
  ): Promise<InvoiceResponseDto> {
    // Generate invoice number
    const invoiceNumber = `INV-${order.order_number}`;

    // Format customer information
    const customer = {
      name: order.user.name || "Customer",
      email: order.user.email || "customer@example.com",
      phone: order.user.phone_number?.toString() || "N/A",
      address: {
        street: order.delivery_address_line1,
        city: order.delivery_city,
        state: order.delivery_state,
        pincode: order.delivery_pincode,
        country: "India",
      },
    };

    // Format store information
    const storeFulfillment = order.store.fulfillments?.[0];
    const storeLocation = order.store.locations?.[0];

    const store = {
      name: order.store.name,
      email: storeFulfillment?.contact_email || "info@store.com",
      phone: storeFulfillment?.contact_phone || "N/A",
      address: {
        street: storeLocation?.address_street || "Store Address",
        locality: storeLocation?.address_locality || "",
        city: storeLocation?.address_city || "City",
        state: storeLocation?.address_state || "State",
        pincode: storeLocation?.address_area_code || "000000",
        country: "India",
      },
      gst_number: order.store.gst_number || "N/A",
      license_number: order.store.fssai_license_no || "N/A",
    };

    // Format order items
    const items = await Promise.all(
      order.order_items.map(async (orderItem) => {
        const customizations = await this.getCustomizationDetails(
          orderItem.customizations,
        );

        return {
          name: orderItem.item.name,
          description:
            orderItem.item.short_desc || orderItem.item.long_desc || "",
          quantity: orderItem.quantity,
          unit_price: Number(orderItem.unit_price),
          total_price: Number(orderItem.total_price),
          customizations: customizations,
          special_instructions: orderItem.special_instructions || undefined,
        };
      }),
    );

    // Format pricing
    const pricing = {
      subtotal: Number(order.subtotal),
      delivery_fee: Number(order.delivery_fee),
      tax_amount: Number(order.tax_amount),
      discount_amount: Number(order.discount_amount),
      total_amount: Number(order.total_amount),
    };

    // Format payment information
    const paymentInfo = {
      method: order.payment_method,
      status: order.payment_status,
      transaction_id: payment?.payment_id || undefined,
    };

    // Format delivery information
    const delivery = {
      estimated_time: order.estimated_delivery_time?.toISOString(),
      delivered_at: order.delivered_at?.toISOString(),
      agent_name: tracking?.agent_name || undefined,
      agent_phone: tracking?.agent_phone || undefined,
    };

    return {
      invoice_number: invoiceNumber,
      order_number: order.order_number,
      invoice_date: new Date().toISOString(),
      order_date: order.created_at.toISOString(),
      customer,
      store,
      items,
      pricing,
      payment: paymentInfo,
      delivery,
      notes,
    };
  }

  /**
   * Get customization details from stored JSON
   */
  private async getCustomizationDetails(
    customizations: any,
  ): Promise<string[]> {
    if (!customizations) {
      this.logger.debug("No customizations provided");
      return [];
    }

    try {
      const customizationsData =
        typeof customizations === "string"
          ? JSON.parse(customizations)
          : customizations;

      this.logger.debug("Customizations data:", customizationsData);

      // Handle array of customization groups
      if (Array.isArray(customizationsData)) {
        const allSelectedOptions: number[] = [];

        customizationsData.forEach((group: any) => {
          if (group.selected_options && Array.isArray(group.selected_options)) {
            allSelectedOptions.push(...group.selected_options);
          }
        });

        if (allSelectedOptions.length === 0) {
          this.logger.debug(
            "No selected_options found in customization groups",
          );
          return [];
        }

        // Get individual customization items by their IDs with prices
        const customizationItems = await this.itemRepository
          .createQueryBuilder("item")
          .leftJoinAndSelect("item.prices", "price")
          .where("item.id IN (:...ids)", { ids: allSelectedOptions })
          .getMany();

        const customizationsList: string[] = [];

        this.logger.debug(
          `Found ${customizationItems.length} customization items`,
        );

        customizationItems.forEach((item) => {
          // Get the first price entry (usually INR) or default to 0
          const price =
            item.prices?.find((p) => p.currency === "INR")?.base_price ||
            item.prices?.[0]?.base_price ||
            0;
          const customizationText = `${item.name} - Rs. ${price}`;
          customizationsList.push(customizationText);
          this.logger.debug(`Added customization: ${customizationText}`);
        });

        this.logger.debug("Final customizations list:", customizationsList);
        return customizationsList;
      }

      // Handle single customization object (fallback)
      if (
        !customizationsData.selected_options ||
        !Array.isArray(customizationsData.selected_options)
      ) {
        this.logger.debug("No selected_options found in customizations");
        return [];
      }

      // Get individual customization items by their IDs with prices
      const customizationItems = await this.itemRepository
        .createQueryBuilder("item")
        .leftJoinAndSelect("item.prices", "price")
        .where("item.id IN (:...ids)", {
          ids: customizationsData.selected_options,
        })
        .getMany();

      const customizationsList: string[] = [];

      this.logger.debug(
        `Found ${customizationItems.length} customization items`,
      );

      customizationItems.forEach((item) => {
        // Get the first price entry (usually INR) or default to 0
        const price =
          item.prices?.find((p) => p.currency === "INR")?.base_price ||
          item.prices?.[0]?.base_price ||
          0;
        const customizationText = `${item.name} - Rs. ${price}`;
        customizationsList.push(customizationText);
        this.logger.debug(`Added customization: ${customizationText}`);
      });

      this.logger.debug("Final customizations list:", customizationsList);
      return customizationsList;
    } catch (error) {
      this.logger.warn(`⚠️ Error parsing customizations:`, error);
      return [];
    }
  }

  /**
   * Generate PDF invoice
   */
  private async generatePDF(invoiceData: InvoiceResponseDto): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      let doc: any = null;

      try {
        // Create a simpler PDF document
        doc = new (PDFDocument as any)({
          margin: 40,
          size: "A4",
        });

        const buffers: Buffer[] = [];

        doc.on("data", (chunk: Buffer) => {
          buffers.push(chunk);
        });

        doc.on("end", () => {
          try {
            const pdfData = Buffer.concat(buffers);
            resolve(pdfData);
          } catch (error) {
            this.logger.error("Error concatenating PDF buffers:", error);
            reject(error);
          }
        });

        doc.on("error", (error: Error) => {
          this.logger.error("PDF generation error:", error);
          reject(error);
        });

        // PDF will auto-create the first page

        // Colors
        const primaryColor = "#FF6B35";
        const secondaryColor = "#2C3E50";
        const lightGray = "#F8F9FA";
        const darkGray = "#6C757D";

        // Header with background (reduced height)
        doc.rect(0, 0, 595, 80).fill(primaryColor);

        // Company logo area (smaller, better aligned)
        doc.rect(40, 15, 50, 50).fill("white").stroke();

        doc
          .fillColor("white")
          .fontSize(12)
          .text("LOGO", 45, 35, { align: "center" });

        // Invoice title
        doc
          .fillColor("white")
          .fontSize(24)
          .font("Helvetica-Bold")
          .text("INVOICE", 100, 20);

        // Invoice details
        doc
          .fontSize(10)
          .text(`Invoice #: ${invoiceData.invoice_number}`, 100, 45);
        doc.text(
          `Date: ${new Date(invoiceData.invoice_date).toLocaleDateString("en-IN")}`,
          100,
          58,
        );

        // Store Information (From)
        doc
          .fillColor(secondaryColor)
          .fontSize(14)
          .font("Helvetica-Bold")
          .text("FROM", 40, 100);

        doc
          .fillColor("black")
          .fontSize(12)
          .font("Helvetica-Bold")
          .text(invoiceData.store.name, 40, 120);

        doc
          .font("Helvetica")
          .fontSize(10)
          .text(invoiceData.store.email, 40, 135);
        doc.text(invoiceData.store.phone, 40, 150);

        // Full store address with proper formatting
        const storeAddressLines = [
          invoiceData.store.address.street,
          `${invoiceData.store.address.city} - ${invoiceData.store.address.pincode}`,
          invoiceData.store.address.state,
          invoiceData.store.address.country,
        ].filter(Boolean);

        let addressY = 165;
        storeAddressLines.forEach((line) => {
          doc.text(line, 40, addressY);
          addressY += 12;
        });

        // Customer Information (To)
        doc
          .fillColor(secondaryColor)
          .fontSize(14)
          .font("Helvetica-Bold")
          .text("TO", 300, 100);

        doc
          .fillColor("black")
          .fontSize(12)
          .font("Helvetica-Bold")
          .text(invoiceData.customer.name, 300, 120);

        doc
          .font("Helvetica")
          .fontSize(10)
          .text(invoiceData.customer.email, 300, 135);
        doc.text(invoiceData.customer.phone, 300, 150);

        // Full customer address with proper formatting
        const customerAddressLines = [
          invoiceData.customer.address.street,
          `${invoiceData.customer.address.city} - ${invoiceData.customer.address.pincode}`,
          invoiceData.customer.address.state,
          invoiceData.customer.address.country,
        ].filter(Boolean);

        let customerAddressY = 165;
        customerAddressLines.forEach((line) => {
          doc.text(line, 300, customerAddressY);
          customerAddressY += 12;
        });

        // Items section header (adjusted position)
        doc.fillColor(lightGray).rect(40, 220, 515, 30).fill();

        doc
          .fillColor(secondaryColor)
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("ITEMS", 50, 230);

        // Items table header
        doc
          .fillColor("black")
          .fontSize(10)
          .font("Helvetica-Bold")
          .text("Item", 50, 260)
          .text("Qty", 380, 260)
          .text("Price", 430, 260)
          .text("Total", 500, 260);

        // Draw line under headers
        doc
          .strokeColor(darkGray)
          .lineWidth(1)
          .moveTo(50, 275)
          .lineTo(550, 275)
          .stroke();

        // Items
        let yPosition = 290;
        invoiceData.items.forEach((item, index) => {
          // Alternate row background
          if (index % 2 === 0) {
            doc
              .fillColor("#F8F9FA")
              .rect(40, yPosition - 5, 520, 25)
              .fill();
          }

          doc
            .fillColor("black")
            .fontSize(10)
            .font("Helvetica-Bold")
            .text(item.name, 50, yPosition);

          // Customizations
          if (item.customizations && item.customizations.length > 0) {
            this.logger.debug(
              `Adding ${item.customizations.length} customizations for item: ${item.name}`,
            );
            doc.fontSize(8).font("Helvetica").fillColor(darkGray);
            item.customizations.forEach((customization) => {
              yPosition += 12;
              doc.text(`  + ${customization}`, 60, yPosition);
              this.logger.debug(`Added customization to PDF: ${customization}`);
            });
            yPosition -= item.customizations.length * 12;
          } else {
            this.logger.debug(`No customizations found for item: ${item.name}`);
          }

          doc
            .fontSize(10)
            .font("Helvetica")
            .fillColor("black")
            .text(item.quantity.toString(), 380, yPosition)
            .text(`Rs. ${item.unit_price.toFixed(2)}`, 430, yPosition)
            .text(`Rs. ${item.total_price.toFixed(2)}`, 500, yPosition);

          yPosition += 25;
        });

        // Totals section
        yPosition += 20;
        doc.fillColor(lightGray).rect(350, yPosition, 205, 120).fill();

        doc
          .fillColor(secondaryColor)
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("ORDER SUMMARY", 360, yPosition + 10);

        yPosition += 30;
        doc
          .fillColor("black")
          .fontSize(10)
          .font("Helvetica")
          .text(`Subtotal:`, 360, yPosition)
          .text(
            `Rs. ${invoiceData.pricing.subtotal.toFixed(2)}`,
            500,
            yPosition,
          );

        yPosition += 15;
        doc
          .text(`Delivery Fee:`, 360, yPosition)
          .text(
            `Rs. ${invoiceData.pricing.delivery_fee.toFixed(2)}`,
            500,
            yPosition,
          );

        yPosition += 15;
        doc
          .text(`Tax:`, 360, yPosition)
          .text(
            `Rs. ${invoiceData.pricing.tax_amount.toFixed(2)}`,
            500,
            yPosition,
          );

        yPosition += 20;
        doc
          .strokeColor(darkGray)
          .lineWidth(1)
          .moveTo(360, yPosition)
          .lineTo(550, yPosition)
          .stroke();

        yPosition += 15;
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .text(`Total:`, 360, yPosition)
          .text(
            `Rs. ${invoiceData.pricing.total_amount.toFixed(2)}`,
            500,
            yPosition,
          );

        // Payment Information
        if (invoiceData.payment) {
          yPosition += 50;
          doc
            .fillColor(secondaryColor)
            .fontSize(12)
            .font("Helvetica-Bold")
            .text("PAYMENT INFORMATION", 50, yPosition);

          yPosition += 20;
          doc
            .fillColor("black")
            .fontSize(10)
            .font("Helvetica")
            .text(
              `Method: ${invoiceData.payment.method.toUpperCase()}`,
              50,
              yPosition,
            );
          yPosition += 15;
          doc.text(
            `Status: ${invoiceData.payment.status.toUpperCase()}`,
            50,
            yPosition,
          );

          // Only show transaction ID if not COD and transaction_id exists
          if (
            invoiceData.payment.method.toLowerCase() !== "cod" &&
            invoiceData.payment.transaction_id
          ) {
            yPosition += 15;
            doc.text(
              `Transaction ID: ${invoiceData.payment.transaction_id}`,
              50,
              yPosition,
            );
          }
        }

        // Delivery Information (only show if agent details are available)
        if (
          invoiceData.delivery &&
          invoiceData.delivery.agent_name &&
          invoiceData.delivery.agent_phone
        ) {
          yPosition += 30;
          doc
            .fillColor(secondaryColor)
            .fontSize(12)
            .font("Helvetica-Bold")
            .text("DELIVERY INFORMATION", 50, yPosition);

          yPosition += 20;
          doc
            .fillColor("black")
            .fontSize(10)
            .font("Helvetica")
            .text(`Agent: ${invoiceData.delivery.agent_name}`, 50, yPosition);
          yPosition += 15;
          doc.text(`Phone: ${invoiceData.delivery.agent_phone}`, 50, yPosition);
        }

        // Footer
        doc.fillColor(primaryColor).rect(0, 750, 595, 50).fill();

        doc
          .fillColor("white")
          .fontSize(10)
          .text("Thank you for your order!", 50, 765, { align: "center" });
        doc.text("For support, contact us at support@example.com", 50, 780, {
          align: "center",
        });

        doc.end();
      } catch (error) {
        this.logger.error("Error generating PDF:", error);
        reject(error);
      }
    });
  }

  /**
   * Get invoice data without generating PDF
   */
  async getInvoiceData(
    userId: number,
    orderId: number,
  ): Promise<InvoiceResponseDto> {
    const invoiceData = await this.generateInvoice(userId, orderId, {
      format: InvoiceFormat.JSON,
    });
    return invoiceData as InvoiceResponseDto;
  }
}
