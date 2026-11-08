-- Invariant Check Constraints and Indexes

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_trust') THEN
    ALTER TABLE "Client" ADD CONSTRAINT client_trust CHECK (
      ("isVerified" = false OR length(btrim(coalesce("evidenceNote",''))) > 0) AND ("showOnSite" = false OR "isVerified" = true));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'testimonial_trust') THEN
    ALTER TABLE "Testimonial" ADD CONSTRAINT testimonial_trust CHECK (
      ("isVerified" = false OR length(btrim(coalesce("evidenceNote",''))) > 0) AND ("showOnSite" = false OR "isVerified" = true));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'badge_trust') THEN
    ALTER TABLE "TrustBadge" ADD CONSTRAINT badge_trust CHECK (
      ("isVerified" = false OR length(btrim(coalesce("evidenceNote",''))) > 0) AND ("showOnSite" = false OR "isVerified" = true));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'casestudy_trust') THEN
    ALTER TABLE "CaseStudy" ADD CONSTRAINT casestudy_trust CHECK (
      "publishedAt" IS NULL OR ("isVerified" = true AND length(btrim(coalesce("evidenceNote",''))) > 0 AND "clientApprovedAt" IS NOT NULL));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pricing_one_parent') THEN
    ALTER TABLE "PricingPlan" ADD CONSTRAINT pricing_one_parent CHECK (
      ("productId" IS NOT NULL AND "serviceId" IS NULL) OR ("productId" IS NULL AND "serviceId" IS NOT NULL));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lead_contactable') THEN
    ALTER TABLE "Lead" ADD CONSTRAINT lead_contactable CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS one_active_theme ON "Theme" ("isActive") WHERE "isActive" = true;
CREATE UNIQUE INDEX IF NOT EXISTS one_default_language ON "Language" ("isDefault") WHERE "isDefault" = true;

