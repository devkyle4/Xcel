CREATE TYPE "public"."degree_type" AS ENUM('certificate', 'diploma', 'hnd', 'bachelor');--> statement-breakpoint
CREATE TYPE "public"."ghana_region" AS ENUM('ahafo', 'ashanti', 'bono', 'bono_east', 'central', 'eastern', 'greater_accra', 'north_east', 'northern', 'oti', 'savannah', 'upper_east', 'upper_west', 'volta', 'western', 'western_north');--> statement-breakpoint
CREATE TYPE "public"."institution_type" AS ENUM('public_university', 'private_university', 'technical_university', 'college_of_education', 'nursing_and_midwifery_college', 'other');--> statement-breakpoint
CREATE TYPE "public"."mentor_expertise_kind" AS ENUM('topic', 'field', 'programme_area');--> statement-breakpoint
CREATE TYPE "public"."mentor_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."publish_status" AS ENUM('draft', 'needs_verification', 'verified', 'published', 'unpublished', 'archived');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'under_review', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."reportable_entity_type" AS ENUM('university', 'programme', 'scholarship');--> statement-breakpoint
CREATE TYPE "public"."requirement_operator" AS ENUM('all', 'any', 'at_least');--> statement-breakpoint
CREATE TYPE "public"."scholarship_status" AS ENUM('draft', 'published', 'expired', 'archived');--> statement-breakpoint
CREATE TYPE "public"."study_level" AS ENUM('certificate', 'diploma', 'undergraduate', 'postgraduate');--> statement-breakpoint
CREATE TYPE "public"."subject_category" AS ENUM('core', 'elective');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin');--> statement-breakpoint
CREATE TYPE "public"."verifiable_entity_type" AS ENUM('university', 'programme_admission_cycle', 'scholarship_cycle');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"rank" smallint NOT NULL,
	"points" smallint,
	"is_pass" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grades_code_unique" UNIQUE("code"),
	CONSTRAINT "grades_rank_unique" UNIQUE("rank"),
	CONSTRAINT "grades_rank_positive" CHECK ("grades"."rank" > 0),
	CONSTRAINT "grades_points_positive" CHECK ("grades"."points" IS NULL OR "grades"."points" > 0)
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" "subject_category" NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subjects_code_unique" UNIQUE("code"),
	CONSTRAINT "subjects_name_unique" UNIQUE("name"),
	CONSTRAINT "subjects_code_format" CHECK ("subjects"."code" ~ '^[A-Z][A-Z0-9_]*$')
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb
);
--> statement-breakpoint
CREATE TABLE "mentor_expertise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentor_id" uuid NOT NULL,
	"kind" "mentor_expertise_kind" NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mentor_expertise_mentor_kind_value_key" UNIQUE("mentor_id","kind","value")
);
--> statement-breakpoint
CREATE TABLE "mentor_request_stats" (
	"mentor_id" uuid NOT NULL,
	"month" date NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "mentor_request_stats_mentor_id_month_pk" PRIMARY KEY("mentor_id","month"),
	CONSTRAINT "mentor_request_stats_month_start" CHECK (extract(day from "mentor_request_stats"."month") = 1)
);
--> statement-breakpoint
CREATE TABLE "mentors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"full_name" text NOT NULL,
	"headline" text,
	"photo_url" text,
	"bio" text,
	"background" text,
	"contact_email" text NOT NULL,
	"status" "mentor_status" DEFAULT 'inactive' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mentors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "programme_admission_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"programme_id" uuid NOT NULL,
	"academic_year" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"supersedes_cycle_id" uuid,
	"application_opens_on" date,
	"application_deadline" date,
	"application_url" text,
	"notes" text,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"verified_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programme_cycles_programme_year_version_key" UNIQUE("programme_id","academic_year","version"),
	CONSTRAINT "programme_cycles_academic_year_format" CHECK (CASE WHEN academic_year ~ '^[0-9]{4}/[0-9]{4}$' THEN substr(academic_year, 6, 4)::int = substr(academic_year, 1, 4)::int + 1 ELSE false END),
	CONSTRAINT "programme_cycles_version_positive" CHECK ("programme_admission_cycles"."version" > 0),
	CONSTRAINT "programme_cycles_dates_ordered" CHECK ("programme_admission_cycles"."application_opens_on" IS NULL OR "programme_admission_cycles"."application_deadline" IS NULL OR "programme_admission_cycles"."application_opens_on" <= "programme_admission_cycles"."application_deadline")
);
--> statement-breakpoint
CREATE TABLE "programmes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"university_id" uuid NOT NULL,
	"faculty_school_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"field" text,
	"degree_type" "degree_type" NOT NULL,
	"duration_years" smallint,
	"campus" text,
	"description" text,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(name, '')), 'A') || setweight(to_tsvector('english', coalesce(field, '')), 'B') || setweight(to_tsvector('english', coalesce(description, '')), 'C')) STORED,
	CONSTRAINT "programmes_university_slug_key" UNIQUE("university_id","slug"),
	CONSTRAINT "programmes_duration_positive" CHECK ("programmes"."duration_years" IS NULL OR "programmes"."duration_years" > 0)
);
--> statement-breakpoint
CREATE TABLE "requirement_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"parent_group_id" uuid,
	"operator" "requirement_operator" NOT NULL,
	"min_count" smallint,
	"label" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requirement_groups_id_cycle_key" UNIQUE("id","cycle_id"),
	CONSTRAINT "requirement_groups_min_count_matches_operator" CHECK (("requirement_groups"."operator" = 'at_least' AND "requirement_groups"."min_count" IS NOT NULL AND "requirement_groups"."min_count" >= 1) OR ("requirement_groups"."operator" <> 'at_least' AND "requirement_groups"."min_count" IS NULL)),
	CONSTRAINT "requirement_groups_not_own_parent" CHECK ("requirement_groups"."parent_group_id" IS NULL OR "requirement_groups"."parent_group_id" <> "requirement_groups"."id")
);
--> statement-breakpoint
CREATE TABLE "requirement_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"rule_type" text NOT NULL,
	"params" jsonb NOT NULL,
	"label" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requirement_rules_type_format" CHECK ("requirement_rules"."rule_type" ~ '^[a-z][a-z0-9_]*$'),
	CONSTRAINT "requirement_rules_params_object" CHECK (jsonb_typeof("requirement_rules"."params") = 'object')
);
--> statement-breakpoint
CREATE TABLE "user_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "reportable_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"message" text NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"admin_notes" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_reports_message_length" CHECK (char_length("user_reports"."message") BETWEEN 1 AND 2000)
);
--> statement-breakpoint
CREATE TABLE "scholarship_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scholarship_id" uuid NOT NULL,
	"academic_year" text NOT NULL,
	"opens_on" date,
	"closes_on" date,
	"application_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scholarship_cycles_scholarship_year_key" UNIQUE("scholarship_id","academic_year"),
	CONSTRAINT "scholarship_cycles_academic_year_format" CHECK (CASE WHEN academic_year ~ '^[0-9]{4}/[0-9]{4}$' THEN substr(academic_year, 6, 4)::int = substr(academic_year, 1, 4)::int + 1 ELSE false END),
	CONSTRAINT "scholarship_cycles_dates_ordered" CHECK ("scholarship_cycles"."opens_on" IS NULL OR "scholarship_cycles"."closes_on" IS NULL OR "scholarship_cycles"."opens_on" <= "scholarship_cycles"."closes_on")
);
--> statement-breakpoint
CREATE TABLE "scholarship_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"description" text NOT NULL,
	"rule_type" text,
	"params" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scholarship_requirements_rule_complete" CHECK (("scholarship_requirements"."rule_type" IS NULL) = ("scholarship_requirements"."params" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "scholarships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"provider_name" text NOT NULL,
	"provider_url" text,
	"university_id" uuid,
	"description" text,
	"coverage" text,
	"study_levels" "study_level"[] DEFAULT '{}' NOT NULL,
	"fields" text[] DEFAULT '{}'::text[] NOT NULL,
	"eligibility_categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"location" text,
	"status" "scholarship_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(provider_name, '')), 'A') || setweight(to_tsvector('english', coalesce(description, '')), 'C')) STORED,
	CONSTRAINT "scholarships_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faculty_schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"university_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faculty_schools_university_name_key" UNIQUE("university_id","name")
);
--> statement-breakpoint
CREATE TABLE "universities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"institution_type" "institution_type" NOT NULL,
	"region" "ghana_region",
	"town" text,
	"description" text,
	"website_url" text,
	"admissions_url" text,
	"logo_url" text,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(short_name, '')), 'A') || setweight(to_tsvector('english', coalesce(description, '')), 'C')) STORED,
	CONSTRAINT "universities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'admin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text,
	"title" text NOT NULL,
	"publisher" text,
	"academic_year" text,
	"retrieved_on" date,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_academic_year_format" CHECK ("sources"."academic_year" IS NULL OR (CASE WHEN academic_year ~ '^[0-9]{4}/[0-9]{4}$' THEN substr(academic_year, 6, 4)::int = substr(academic_year, 1, 4)::int + 1 ELSE false END))
);
--> statement-breakpoint
CREATE TABLE "verification_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "verifiable_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"source_id" uuid,
	"status" "verification_status" NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_records_verified_needs_source" CHECK ("verification_records"."status" <> 'verified' OR "verification_records"."source_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_expertise" ADD CONSTRAINT "mentor_expertise_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_request_stats" ADD CONSTRAINT "mentor_request_stats_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme_admission_cycles" ADD CONSTRAINT "programme_admission_cycles_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme_admission_cycles" ADD CONSTRAINT "programme_cycles_supersedes_fk" FOREIGN KEY ("supersedes_cycle_id") REFERENCES "public"."programme_admission_cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programmes" ADD CONSTRAINT "programmes_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programmes" ADD CONSTRAINT "programmes_faculty_school_id_faculty_schools_id_fk" FOREIGN KEY ("faculty_school_id") REFERENCES "public"."faculty_schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_groups" ADD CONSTRAINT "requirement_groups_cycle_id_programme_admission_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."programme_admission_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_groups" ADD CONSTRAINT "requirement_groups_parent_same_cycle_fk" FOREIGN KEY ("parent_group_id","cycle_id") REFERENCES "public"."requirement_groups"("id","cycle_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_rules" ADD CONSTRAINT "requirement_rules_group_id_requirement_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."requirement_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_cycles" ADD CONSTRAINT "scholarship_cycles_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_requirements" ADD CONSTRAINT "scholarship_requirements_cycle_id_scholarship_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."scholarship_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarships" ADD CONSTRAINT "scholarships_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faculty_schools" ADD CONSTRAINT "faculty_schools_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs" USING btree ("occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "programme_cycles_one_published_per_year_idx" ON "programme_admission_cycles" USING btree ("programme_id","academic_year") WHERE "programme_admission_cycles"."status" = 'published';--> statement-breakpoint
CREATE INDEX "programmes_university_idx" ON "programmes" USING btree ("university_id");--> statement-breakpoint
CREATE INDEX "programmes_status_idx" ON "programmes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "programmes_search_idx" ON "programmes" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "programmes_name_trgm_idx" ON "programmes" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_groups_one_root_per_cycle_idx" ON "requirement_groups" USING btree ("cycle_id") WHERE "requirement_groups"."parent_group_id" IS NULL;--> statement-breakpoint
CREATE INDEX "requirement_groups_parent_idx" ON "requirement_groups" USING btree ("parent_group_id");--> statement-breakpoint
CREATE INDEX "requirement_rules_group_idx" ON "requirement_rules" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "user_reports_status_idx" ON "user_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_reports_entity_idx" ON "user_reports" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "scholarship_cycles_closes_on_idx" ON "scholarship_cycles" USING btree ("closes_on");--> statement-breakpoint
CREATE INDEX "scholarship_requirements_cycle_idx" ON "scholarship_requirements" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "scholarships_status_idx" ON "scholarships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scholarships_search_idx" ON "scholarships" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "scholarships_name_trgm_idx" ON "scholarships" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "universities_status_idx" ON "universities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "universities_search_idx" ON "universities" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "universities_name_trgm_idx" ON "universities" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "verification_records_entity_idx" ON "verification_records" USING btree ("entity_type","entity_id","verified_at" DESC NULLS LAST);