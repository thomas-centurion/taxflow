import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialSchema20261005000000 implements MigrationInterface {
  name = 'CreateInitialSchema20261005000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "users_role_enum" AS ENUM ('ADMIN', 'TAX_MANAGER', 'ANALYST')`);
    await queryRunner.query(`CREATE TYPE "tax_obligation_type_enum" AS ENUM ('VAT', 'INCOME_TAX', 'WITHHOLDING', 'PAYROLL_TAX', 'OTHER')`);
    await queryRunner.query(`CREATE TYPE "tax_obligation_status_enum" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'OVERDUE', 'CANCELLED')`);
    await queryRunner.query(`CREATE TYPE "notification_type_enum" AS ENUM ('DEADLINE', 'SYSTEM', 'DOCUMENT', 'AUTOMATION')`);

    await queryRunner.query(`CREATE TABLE "countries" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "name" varchar(120) NOT NULL, "code" varchar(2) NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "UQ_countries_code" UNIQUE ("code"),
      CONSTRAINT "CHK_countries_code_uppercase" CHECK ("code" ~ '^[A-Z]{2}$'))`);
    await queryRunner.query(`CREATE TABLE "users" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "first_name" varchar(80) NOT NULL, "last_name" varchar(80) NOT NULL,
      "email" varchar(254) NOT NULL, "password_hash" varchar(255) NOT NULL, "role" "users_role_enum" NOT NULL,
      "is_active" boolean NOT NULL DEFAULT true, "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "UQ_users_email" UNIQUE ("email"))`);
    await queryRunner.query(`CREATE TABLE "companies" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "name" varchar(200) NOT NULL, "tax_id" varchar(100) NOT NULL,
      "country_id" uuid NOT NULL, "email" varchar(254), "phone" varchar(40), "is_active" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_companies_country" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT,
      CONSTRAINT "UQ_companies_country_tax_id" UNIQUE ("country_id", "tax_id"),
      CONSTRAINT "UQ_companies_id_country_id" UNIQUE ("id", "country_id"))`);
    await queryRunner.query(`CREATE TABLE "tax_obligations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "company_id" uuid NOT NULL, "country_id" uuid NOT NULL,
      "name" varchar(200) NOT NULL, "description" text, "type" "tax_obligation_type_enum" NOT NULL,
      "status" "tax_obligation_status_enum" NOT NULL DEFAULT 'PENDING', "due_date" date NOT NULL, "responsible_user_id" uuid,
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_tax_obligations_company_country" FOREIGN KEY ("company_id", "country_id") REFERENCES "companies"("id", "country_id") ON DELETE RESTRICT,
      CONSTRAINT "FK_tax_obligations_country" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_tax_obligations_responsible_user" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
      CONSTRAINT "UQ_tax_obligations_seed_key" UNIQUE ("company_id", "name", "type", "due_date"),
      CONSTRAINT "UQ_tax_obligations_id_company_id" UNIQUE ("id", "company_id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_tax_obligations_status_due_date" ON "tax_obligations" ("status", "due_date")`);
    await queryRunner.query(`CREATE INDEX "IDX_tax_obligations_responsible_user_id" ON "tax_obligations" ("responsible_user_id")`);
    await queryRunner.query(`CREATE TABLE "documents" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "company_id" uuid NOT NULL, "tax_obligation_id" uuid NOT NULL,
      "file_name" varchar(255) NOT NULL, "file_path" varchar(1024) NOT NULL, "mime_type" varchar(127) NOT NULL,
      "file_size" integer NOT NULL CHECK ("file_size" > 0), "uploaded_by_id" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_documents_tax_obligation_company" FOREIGN KEY ("tax_obligation_id", "company_id") REFERENCES "tax_obligations"("id", "company_id") ON DELETE RESTRICT,
      CONSTRAINT "FK_documents_uploaded_by" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
      CONSTRAINT "UQ_documents_file_path" UNIQUE ("file_path"))`);
    await queryRunner.query(`CREATE INDEX "IDX_documents_company_id" ON "documents" ("company_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_documents_tax_obligation_id" ON "documents" ("tax_obligation_id")`);
    await queryRunner.query(`CREATE TABLE "notifications" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "title" varchar(200) NOT NULL,
      "message" text NOT NULL, "type" "notification_type_enum" NOT NULL, "is_read" boolean NOT NULL DEFAULT false,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_user_read_created" ON "notifications" ("user_id", "is_read", "created_at")`);
    await queryRunner.query(`CREATE TABLE "audit_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid, "action" varchar(100) NOT NULL,
      "entity" varchar(100) NOT NULL, "entity_id" uuid, "metadata" jsonb, "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "FK_audit_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL)`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entity" ON "audit_logs" ("entity", "entity_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_user_id" ON "audit_logs" ("user_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TABLE "documents"`);
    await queryRunner.query(`DROP TABLE "tax_obligations"`);
    await queryRunner.query(`DROP TABLE "companies"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "countries"`);
    await queryRunner.query(`DROP TYPE "notification_type_enum"`);
    await queryRunner.query(`DROP TYPE "tax_obligation_status_enum"`);
    await queryRunner.query(`DROP TYPE "tax_obligation_type_enum"`);
    await queryRunner.query(`DROP TYPE "users_role_enum"`);
  }
}