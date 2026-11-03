-- AlterTable
ALTER TABLE "CaseStudy" ADD COLUMN     "backendRepoUrl" TEXT,
ADD COLUMN     "backendTechSummary" JSONB,
ADD COLUMN     "dbToolsSummary" JSONB,
ADD COLUMN     "demoVideoUrl" TEXT,
ADD COLUMN     "frontendRepoUrl" TEXT,
ADD COLUMN     "frontendTechSummary" JSONB,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "projectWorkStatus" TEXT NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "showBackendRepo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showFrontendRepo" BOOLEAN NOT NULL DEFAULT false;
