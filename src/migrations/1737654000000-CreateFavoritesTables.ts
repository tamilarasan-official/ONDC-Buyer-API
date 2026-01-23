import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm";

export class CreateFavoritesTables1737654000000 implements MigrationInterface {
    name = 'CreateFavoritesTables1737654000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create user_favorite_items table
        await queryRunner.createTable(
            new Table({
                name: "user_favorite_items",
                columns: [
                    {
                        name: "id",
                        type: "int",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
                    },
                    {
                        name: "user_id",
                        type: "int",
                        isNullable: false,
                    },
                    {
                        name: "item_id",
                        type: "int",
                        isNullable: false,
                    },
                    {
                        name: "created_at",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP",
                    },
                    {
                        name: "updated_at",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP",
                    },
                ],
            }),
            true,
        );

        // Create unique constraint on user_id and item_id
        await queryRunner.createIndex(
            "user_favorite_items",
            new TableIndex({
                name: "UQ_user_favorite_items_user_item",
                columnNames: ["user_id", "item_id"],
                isUnique: true,
            }),
        );

        // Create indexes
        await queryRunner.createIndex(
            "user_favorite_items",
            new TableIndex({
                name: "IDX_user_favorite_items_user",
                columnNames: ["user_id"],
            }),
        );

        await queryRunner.createIndex(
            "user_favorite_items",
            new TableIndex({
                name: "IDX_user_favorite_items_item",
                columnNames: ["item_id"],
            }),
        );

        await queryRunner.createIndex(
            "user_favorite_items",
            new TableIndex({
                name: "IDX_user_favorite_items_created_at",
                columnNames: ["created_at"],
            }),
        );

        // Create foreign keys
        await queryRunner.createForeignKey(
            "user_favorite_items",
            new TableForeignKey({
                columnNames: ["user_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "user",
                onDelete: "CASCADE",
            }),
        );

        await queryRunner.createForeignKey(
            "user_favorite_items",
            new TableForeignKey({
                columnNames: ["item_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "item",
                onDelete: "CASCADE",
            }),
        );

        // Create user_favorite_restaurants table
        await queryRunner.createTable(
            new Table({
                name: "user_favorite_restaurants",
                columns: [
                    {
                        name: "id",
                        type: "int",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment",
                    },
                    {
                        name: "user_id",
                        type: "int",
                        isNullable: false,
                    },
                    {
                        name: "store_id",
                        type: "int",
                        isNullable: false,
                    },
                    {
                        name: "created_at",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP",
                    },
                    {
                        name: "updated_at",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP",
                    },
                ],
            }),
            true,
        );

        // Create unique constraint on user_id and store_id
        await queryRunner.createIndex(
            "user_favorite_restaurants",
            new TableIndex({
                name: "UQ_user_favorite_restaurants_user_store",
                columnNames: ["user_id", "store_id"],
                isUnique: true,
            }),
        );

        // Create indexes
        await queryRunner.createIndex(
            "user_favorite_restaurants",
            new TableIndex({
                name: "IDX_user_favorite_restaurants_user",
                columnNames: ["user_id"],
            }),
        );

        await queryRunner.createIndex(
            "user_favorite_restaurants",
            new TableIndex({
                name: "IDX_user_favorite_restaurants_store",
                columnNames: ["store_id"],
            }),
        );

        await queryRunner.createIndex(
            "user_favorite_restaurants",
            new TableIndex({
                name: "IDX_user_favorite_restaurants_created_at",
                columnNames: ["created_at"],
            }),
        );

        // Create foreign keys
        await queryRunner.createForeignKey(
            "user_favorite_restaurants",
            new TableForeignKey({
                columnNames: ["user_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "user",
                onDelete: "CASCADE",
            }),
        );

        await queryRunner.createForeignKey(
            "user_favorite_restaurants",
            new TableForeignKey({
                columnNames: ["store_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "store",
                onDelete: "CASCADE",
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop user_favorite_restaurants table (foreign keys will be dropped automatically)
        await queryRunner.dropTable("user_favorite_restaurants", true);

        // Drop user_favorite_items table (foreign keys will be dropped automatically)
        await queryRunner.dropTable("user_favorite_items", true);
    }
}

