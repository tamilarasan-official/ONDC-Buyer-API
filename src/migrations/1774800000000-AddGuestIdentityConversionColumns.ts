import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGuestIdentityConversionColumns1774800000000
  implements MigrationInterface
{
  name = "AddGuestIdentityConversionColumns1774800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE guest_identities
      ADD COLUMN IF NOT EXISTS converted_to_user boolean NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      ALTER TABLE guest_identities
      ADD COLUMN IF NOT EXISTS linked_user_id integer;
    `);

    await queryRunner.query(`
      ALTER TABLE guest_identities
      ADD COLUMN IF NOT EXISTS converted_at timestamp with time zone;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_guest_identities_linked_user_id
      ON guest_identities (linked_user_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Keep down migration minimal; removing analytics columns may be undesirable.
    await queryRunner.query(`
      ALTER TABLE guest_identities
      DROP COLUMN IF EXISTS converted_to_user;
    `);
    await queryRunner.query(`
      ALTER TABLE guest_identities
      DROP COLUMN IF EXISTS linked_user_id;
    `);
    await queryRunner.query(`
      ALTER TABLE guest_identities
      DROP COLUMN IF EXISTS converted_at;
    `);
  }
}

