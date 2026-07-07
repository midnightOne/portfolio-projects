-- D7: visibility (PUBLIC/PRIVATE) is the only publication axis; the legacy
-- draft/published status column and enum are dropped.
-- DropIndex
DROP INDEX "public"."projects_status_visibility_idx";

-- AlterTable
ALTER TABLE "public"."projects" DROP COLUMN "status";

-- DropEnum
DROP TYPE "public"."project_status";

-- CreateIndex
CREATE INDEX "projects_visibility_idx" ON "public"."projects"("visibility");

