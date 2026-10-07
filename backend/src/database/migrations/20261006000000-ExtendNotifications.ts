import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendNotifications20261006000000 implements MigrationInterface {
  name = 'ExtendNotifications20261006000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notifications" ADD "tax_obligation_id" uuid`);
    await queryRunner.query(`ALTER TABLE "notifications" ADD "dedupe_key" varchar(250)`);
    await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_notifications_tax_obligation" FOREIGN KEY ("tax_obligation_id") REFERENCES "tax_obligations"("id") ON DELETE SET NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_notifications_dedupe_key" ON "notifications" ("dedupe_key")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_notifications_dedupe_key"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_tax_obligation"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "dedupe_key"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "tax_obligation_id"`);
  }
}
