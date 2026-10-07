import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendAuditLogs20261007000000 implements MigrationInterface {
  name = 'ExtendAuditLogs20261007000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "actor_type" varchar(12) NOT NULL DEFAULT 'USER'`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "actor_email" varchar(254)`);
    await queryRunner.query(`UPDATE "audit_logs" AS log SET "actor_email" = app_user.email FROM "users" AS app_user WHERE log.user_id = app_user.id`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD CONSTRAINT "CHK_audit_logs_actor_type" CHECK ("actor_type" IN ('USER', 'SYSTEM'))`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_action_created_at" ON "audit_logs" ("action", "created_at" DESC)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_action_created_at"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "CHK_audit_logs_actor_type"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "actor_email"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "actor_type"`);
  }
}
