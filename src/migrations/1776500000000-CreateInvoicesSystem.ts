import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateInvoicesSystem1776500000000 implements MigrationInterface {
  name = "CreateInvoicesSystem1776500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Atomic helper: returns the next invoice sequence number for a given date
    //    by counting existing rows in the invoices table for that date.
    //    Caller must hold LOCK TABLE invoices IN EXCLUSIVE MODE before calling.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION next_invoice_seq(p_date DATE)
      RETURNS INTEGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_seq INTEGER;
      BEGIN
        SELECT COALESCE(COUNT(*)::INTEGER, 0) + 10001
          INTO v_seq
          FROM invoices
         WHERE invoice_no LIKE 'T-' || TO_CHAR(p_date, 'YYYYMMDD') || '-%';
        RETURN v_seq;
      END;
      $$;
    `);

    // 2. Invoices table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id          SERIAL PRIMARY KEY,
        order_id    INTEGER NOT NULL UNIQUE REFERENCES "order"(id) ON DELETE CASCADE,
        invoice_no  VARCHAR(30) NOT NULL UNIQUE,
        invoice_url TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 3. Backfill: assign invoice numbers to all existing delivered orders (ASC id order)
    await queryRunner.query(`
      DO $$
      DECLARE
        rec    RECORD;
        v_date DATE;
        v_seq  INTEGER;
        v_no   VARCHAR(30);
      BEGIN
        LOCK TABLE invoices IN EXCLUSIVE MODE;
        FOR rec IN
          SELECT o.id, o.order_number, o.created_at, o.invoice_url
          FROM "order" o
          WHERE o.status = 'delivered'
            AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = o.id)
          ORDER BY o.id ASC
        LOOP
          v_date := DATE(rec.created_at AT TIME ZONE 'Asia/Kolkata');
          v_seq  := next_invoice_seq(v_date);
          v_no   := 'T-' || TO_CHAR(v_date, 'YYYYMMDD') || '-' || LPAD(v_seq::TEXT, 5, '0');

          INSERT INTO invoices (order_id, invoice_no, invoice_url, created_at, updated_at)
          VALUES (rec.id, v_no, rec.invoice_url, NOW(), NOW())
          ON CONFLICT (order_id) DO NOTHING;
        END LOOP;
      END;
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS invoices;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS next_invoice_seq(DATE);`);
  }
}
