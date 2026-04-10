import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not, IsNull, DataSource } from "typeorm";
import { Order } from "../order/entities/order.entity";
import { OrderItem } from "../order/entities/order-item.entity";
import { OrderTracking } from "../order/entities/order-tracking.entity";
import { Invoice } from "../order/entities/invoice.entity";
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
import * as fs from "fs";
import * as path from "path";
import { UploadService } from "../shared/upload.service";

/** Max concurrent Puppeteer PDF renders. Prevents OOM when many orders arrive simultaneously. */
const PDF_CONCURRENCY = 3;

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  /** Counts active Puppeteer renders; callers await when limit is reached. */
  private pdfSemaphore = 0;
  private pdfQueue: Array<() => void> = [];

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
    private readonly uploadService: UploadService,
    private readonly dataSource: DataSource,
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
    invoiceNo?: string,
  ): Promise<InvoiceResponseDto> {
    // Use supplied invoice number or fall back to order-number-based placeholder
    const invoiceNumber = invoiceNo ?? `INV-${order.order_number}`;

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
      total_tax_amount: Number(order.total_tax_amount) || Number(order.tax_amount),
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
   * Generate PDF invoice — renders invoice.hbs template via Handlebars then converts to PDF via Puppeteer
   */
  private async generatePDF(invoiceData: InvoiceResponseDto): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { toWords } = require("number-to-words") as { toWords: (n: number) => string };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Handlebars = require("handlebars") as typeof import("handlebars");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer  = require("puppeteer") as typeof import("puppeteer");

    const amountToWords = (n: number): string => {
      const rupees = Math.floor(Math.abs(n));
      const paise  = Math.round((Math.abs(n) - rupees) * 100);
      const cap = (s: string) =>
        s.split(" ").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : "")).join(" ").replace(/-/g, " ");
      return cap(toWords(rupees)) + " Rupees" +
        (paise > 0 ? " And " + cap(toWords(paise)) + " Paise" : "") + " Only";
    };

    const fmt = (n: number | string) => Number(n).toFixed(2);
    const invoiceDate = new Date(invoiceData.invoice_date).toLocaleDateString("en-IN",
      { day: "2-digit", month: "2-digit", year: "numeric" });

    const totalTax    = Number(invoiceData.pricing.total_tax_amount ?? invoiceData.pricing.tax_amount) || 0;
    const cgst        = +(totalTax / 2).toFixed(2);
    const sgst        = +(totalTax / 2).toFixed(2);
    const subtotal    = Number(invoiceData.pricing.subtotal) || 0;
    const deliveryFee = Number(invoiceData.pricing.delivery_fee) || 0;
    const total       = Number(invoiceData.pricing.total_amount) || 0;

    // Map truncated ONDC state codes to full state names
    const STATE_MAP: Record<string, string> = {
      ANDHR: "Andhra Pradesh",  ARUN: "Arunachal Pradesh", ASSAM: "Assam",
      BIHAR: "Bihar",           CHHAT: "Chhattisgarh",      GOA: "Goa",
      GUJAR: "Gujarat",         HARYA: "Haryana",           HIMAP: "Himachal Pradesh",
      JHARK: "Jharkhand",       KARNA: "Karnataka",          KERAL: "Kerala",
      MADHY: "Madhya Pradesh",  MAHAR: "Maharashtra",       MANIP: "Manipur",
      MEGHA: "Meghalaya",       MIZOR: "Mizoram",            NAGAL: "Nagaland",
      ODISH: "Odisha",          PUNJA: "Punjab",             RAJAS: "Rajasthan",
      SIKKI: "Sikkim",          TAMIL: "Tamil Nadu",         TELAN: "Telangana",
      TRIPU: "Tripura",         UTTAR: "Uttar Pradesh",     UTTARAKHAND: "Uttarakhand",
      WBENG: "West Bengal",     DELHI: "Delhi",              JAMMU: "Jammu and Kashmir",
      LADAK: "Ladakh",          PONDI: "Puducherry",         CHANDI: "Chandigarh",
      ANDNI: "Andaman and Nicobar Islands", DADRA: "Dadra and Nagar Haveli and Daman and Diu",
      LAKSH: "Lakshadweep",
    };
    const resolveState = (s: string) => STATE_MAP[s?.trim()?.toUpperCase()] ?? s ?? "N/A";

    const storeState  = resolveState(invoiceData.store.address.state);
    const storeAddr   = [invoiceData.store.address.street, invoiceData.store.address.city]
      .filter(Boolean).join(", ");
    const custAddr    = [
      invoiceData.customer.address.street,
      invoiceData.customer.address.city,
      invoiceData.customer.address.state,
      invoiceData.customer.address.pincode,
    ].filter(Boolean).join(", ");
    const storeGstin  = (invoiceData.store.gst_number && invoiceData.store.gst_number !== "N/A")
      ? invoiceData.store.gst_number : "-";
    const storeFssai  = (invoiceData.store.license_number && invoiceData.store.license_number !== "N/A")
      ? invoiceData.store.license_number : "-";

    // Load and compile Handlebars template
    const templatePath = path.join(process.cwd(), "src", "templates", "invoice.hbs");
    const templateSrc  = fs.readFileSync(templatePath, "utf8");
    const template     = Handlebars.compile(templateSrc);

    // Build template context
    const context = {
      invoice_number:   invoiceData.invoice_number,
      invoice_date:     invoiceDate,
      order_number:     invoiceData.order_number,
      customer_name:    invoiceData.customer.name,
      customer_address: custAddr,
      store_name:       invoiceData.store.name,
      store_gstin:      storeGstin,
      store_fssai:      storeFssai,
      store_address:    storeAddr,
      store_state:      storeState,
      items: invoiceData.items.map((item, i) => ({
        sr_no:      i + 1,
        name:       item.name,
        quantity:   item.quantity,
        unit_price: fmt(item.unit_price),
        total_price: fmt(item.total_price),
      })),
      subtotal:          fmt(subtotal),
      cgst:              fmt(cgst),
      sgst:              fmt(sgst),
      show_igst:         totalTax > 0 && cgst === 0 && sgst === 0,
      total_tax:         fmt(totalTax),
      delivery_fee_row:  deliveryFee > 0,
      delivery_fee:      fmt(deliveryFee),
      total:             fmt(total),
      amount_in_words:   amountToWords(total),
    };

    const html = template(context);

    // Render HTML to PDF via Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  /**
   * Generate a PDF invoice and upload it to S3, returning the public URL.
   * Used internally when an order is marked as delivered.
   */
  /**
   * Acquire a slot in the Puppeteer semaphore.
   * Callers block here when PDF_CONCURRENCY renders are already in flight.
   */
  private acquirePdfSlot(): Promise<void> {
    if (this.pdfSemaphore < PDF_CONCURRENCY) {
      this.pdfSemaphore++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.pdfQueue.push(resolve));
  }

  private releasePdfSlot(): void {
    const next = this.pdfQueue.shift();
    if (next) {
      next(); // give slot to next waiter
    } else {
      this.pdfSemaphore--;
    }
  }

  async generateAndUploadForOrder(orderId: number): Promise<{ url: string | null; invoiceNo: string | null }> {
    try {
      this.logger.log(`[Invoice] START order=${orderId}`);

      const order = await this.orderRepository.findOne({
        where: { id: orderId },
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
        this.logger.warn(`[Invoice] order=${orderId} not found`);
        return { url: null, invoiceNo: null };
      }

      // 1. Assign invoice number atomically (serialised via table lock across all concurrent calls)
      const invoiceRecord = await this.ensureBuyerInvoice(orderId, null);
      this.logger.log(`[Invoice] order=${orderId} invoice_no=${invoiceRecord.invoice_no} — generating PDF`);

      const payment = await this.paymentRepository.findOne({
        where: { order: { id: orderId } },
        order: { created_at: "DESC" },
      });

      let latestTracking = await this.orderTrackingRepository.findOne({
        where: { order: { id: orderId }, agent_name: Not(IsNull()) },
        order: { created_at: "DESC" },
      });
      if (!latestTracking) {
        latestTracking = await this.orderTrackingRepository.findOne({
          where: { order: { id: orderId } },
          order: { created_at: "DESC" },
        });
      }

      // 2. Throttle Puppeteer: wait for a free slot (max PDF_CONCURRENCY renders at once)
      await this.acquirePdfSlot();
      let pdfBuffer: Buffer;
      try {
        const invoiceData = await this.formatInvoiceData(order, payment, latestTracking, undefined, invoiceRecord.invoice_no);
        pdfBuffer = await this.generatePDF(invoiceData);
      } finally {
        this.releasePdfSlot();
      }

      // 3. Upload to S3
      const key = `invoices/${order.order_number}.pdf`;
      const url = await this.uploadService.uploadFile(pdfBuffer, "application/pdf", key);

      // 4. Persist URL back onto the invoice record
      const invoiceRepo = this.dataSource.getRepository(Invoice);
      await invoiceRepo.update(invoiceRecord.id, { invoice_url: url });

      this.logger.log(`[Invoice] DONE order=${orderId} invoice_no=${invoiceRecord.invoice_no} url=${url}`);
      return { url, invoiceNo: invoiceRecord.invoice_no };
    } catch (error) {
      this.logger.error(
        `[Invoice] FAILED order=${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { url: null, invoiceNo: null };
    }
  }

  /**
   * Ensure an invoice record exists for the given order.
   * Idempotent — safe to call concurrently for the same or different orders.
   *
   * Concurrency design:
   *  - LOCK TABLE invoices IN EXCLUSIVE MODE serialises all concurrent insert attempts.
   *  - The idempotency check (SELECT) is performed INSIDE the lock so there is no
   *    time-of-check / time-of-use gap.
   *  - If a duplicate-key error still occurs (e.g. two Node processes on a cluster),
   *    the handler falls back to returning the already-committed record.
   */
  async ensureBuyerInvoice(orderId: number, invoiceUrl: string | null): Promise<Invoice> {
    const invoiceRepo = this.dataSource.getRepository(Invoice);

    // Fetch order date outside the lock (read-only, cheap).
    const order = await this.orderRepository.findOne({ where: { id: orderId }, select: ["id", "created_at"] });
    const orderDate = order?.created_at ?? new Date();
    const istDateStr = orderDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
    const datePart = istDateStr.replace(/-/g, "");

    try {
      await this.dataSource.transaction(async (em) => {
        // Lock first — then check. This eliminates the check-then-act race
        // between concurrent calls for the same or different order_ids.
        await em.query(`LOCK TABLE invoices IN EXCLUSIVE MODE`);

        // Idempotency check INSIDE the lock.
        const rows: { id: number }[] = await em.query(
          `SELECT id FROM invoices WHERE order_id = $1 LIMIT 1`,
          [orderId],
        );
        if (rows.length > 0) {
          // Already exists — nothing to do (URL update done separately via invoiceRepo.update).
          return;
        }

        const seqResult: { n: number }[] = await em.query(
          `SELECT next_invoice_seq($1::DATE) AS n`,
          [istDateStr],
        );
        const seq = seqResult[0].n;
        const invoiceNo = `T-${datePart}-${String(seq).padStart(5, "0")}`;

        await em.query(
          `INSERT INTO invoices (order_id, invoice_no, invoice_url, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())`,
          [orderId, invoiceNo, invoiceUrl],
        );

        this.logger.log(`[Invoice] order=${orderId} assigned invoice_no=${invoiceNo}`);
      });

      return (await invoiceRepo.findOne({ where: { order_id: orderId } })) as Invoice;
    } catch (err: any) {
      // Duplicate key — another OS-level process (e.g. PM2 cluster) committed first.
      if (err?.code === "23505") {
        this.logger.warn(`[Invoice] order=${orderId} duplicate key on insert; fetching existing record`);
        const fallback = await invoiceRepo.findOne({ where: { order_id: orderId } });
        if (fallback) return fallback;
      }
      throw err;
    }
  }

  /**
   * GET /api/buyer/invoice/:orderId
   *
   * Check-then-generate:
   * 1. Invoice record with URL already stored → return immediately (no re-generation).
   * 2. Record exists but URL missing (webhook failed mid-way) → regenerate, upload, update.
   * 3. No record at all → assign invoice number, generate PDF, upload, store.
   */
  async getOrGenerateInvoiceUrl(
    userId: number,
    orderId: number,
  ): Promise<{ invoice_no: string; order_number: string; invoice_url: string }> {
    // Check order exists first, then check ownership separately for clear messages
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      select: ["id", "order_number", "user"],
      relations: ["user"],
    });
    if (!order) {
      throw new NotFoundException("Order not found.");
    }
    if (order.user.id !== userId) {
      throw new NotFoundException("This order does not belong to you.");
    }

    const invoiceRepo = this.dataSource.getRepository(Invoice);
    const existing = await invoiceRepo.findOne({ where: { order_id: orderId } });

    if (existing?.invoice_url) {
      this.logger.log(`[Invoice] GET order=${orderId} — returning cached URL`);
      return {
        invoice_no: existing.invoice_no,
        order_number: order.order_number,
        invoice_url: existing.invoice_url,
      };
    }

    this.logger.log(`[Invoice] GET order=${orderId} — generating PDF on demand`);
    const { url, invoiceNo } = await this.generateAndUploadForOrder(orderId);

    if (!url || !invoiceNo) {
      throw new Error("Invoice could not be generated at this time. Please try again later.");
    }

    return { invoice_no: invoiceNo, order_number: order.order_number, invoice_url: url };
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
