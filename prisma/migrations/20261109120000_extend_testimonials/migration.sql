-- Extend Testimonial with the fields the CMS needs (all additive; existing rows get defaults).
-- AlterTable
ALTER TABLE "Testimonial" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "projectSlug" TEXT,
ADD COLUMN     "rating" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "reviewDate" TIMESTAMP(3),
ADD COLUMN     "serviceSlug" TEXT,
ADD COLUMN     "source" TEXT DEFAULT 'Direct Client',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Invariant (not representable in Prisma): rating is a 1-5 star value.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'testimonial_rating_range') THEN
    ALTER TABLE "Testimonial" ADD CONSTRAINT testimonial_rating_range CHECK ("rating" BETWEEN 1 AND 5);
  END IF;
END $$;
