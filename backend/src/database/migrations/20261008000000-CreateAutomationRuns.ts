import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAutomationRuns20261008000000 implements MigrationInterface {
  name = 'CreateAutomationRuns20261008000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "automation_run_status_enum" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')`);
    await queryRunner.query(`CREATE TYPE "automation_run_trigger_enum" AS ENUM ('MANUAL', 'SCHEDULED')`);
    await queryRunner.query(`CREATE TABLE "automation_runs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tax_obligation_id" uuid NOT NULL,
      "requested_by_id" uuid,
      "trigger" "automation_run_trigger_enum" NOT NULL,
      "status" "automation_run_status_enum" NOT NULL DEFAULT 'PENDING',
      "started_at" timestamptz,
      "finished_at" timestamptz,
      "error_code" varchar(50),
      "error_message" varchar(500),
      "result" jsonb,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_automation_runs_tax_obligation" FOREIGN KEY ("tax_obligation_id") REFERENCES "tax_obligations"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_automation_runs_requested_by" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL)`);
    await queryRunner.query(`CREATE INDEX "IDX_automation_runs_obligation_created" ON "automation_runs" ("tax_obligation_id", "created_at")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_automation_runs_active_obligation" ON "automation_runs" ("tax_obligation_id") WHERE "status" IN ('PENDING', 'RUNNING')`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_automation_runs_active_obligation"`);
    await queryRunner.query(`DROP INDEX "IDX_automation_runs_obligation_created"`);
    await queryRunner.query(`DROP TABLE "automation_runs"`);
    await queryRunner.query(`DROP TYPE "automation_run_trigger_enum"`);
    await queryRunner.query(`DROP TYPE "automation_run_status_enum"`);
  }
}
