-- Run once after the first `prisma migrate`, e.g. as an extra migration file.
-- These make the "trust rule" and other invariants impossible to bypass, even from a script.

-- TRUST RULE: verified => evidence written; public => verified
ALTER TABLE "Client" ADD CONSTRAINT client_trust CHECK (
  ("isVerified" = false OR length(btrim(coalesce("evidenceNote",''))) > 0) AND ("showOnSite" = false OR "isVerified" = true));
ALTER TABLE "Testimonial" ADD CONSTRAINT testimonial_trust CHECK (
  ("isVerified" = false OR length(btrim(coalesce("evidenceNote",''))) > 0) AND ("showOnSite" = false OR "isVerified" = true));
ALTER TABLE "TrustBadge" ADD CONSTRAINT badge_trust CHECK (
  ("isVerified" = false OR length(btrim(coalesce("evidenceNote",''))) > 0) AND ("showOnSite" = false OR "isVerified" = true));
ALTER TABLE "CaseStudy" ADD CONSTRAINT casestudy_trust CHECK (
  "publishedAt" IS NULL OR ("isVerified" = true AND length(btrim(coalesce("evidenceNote",''))) > 0 AND "clientApprovedAt" IS NOT NULL));

-- Pricing belongs to exactly one parent
ALTER TABLE "PricingPlan" ADD CONSTRAINT pricing_one_parent CHECK (
  ("productId" IS NOT NULL AND "serviceId" IS NULL) OR ("productId" IS NULL AND "serviceId" IS NOT NULL));

-- A lead needs some way to reply
ALTER TABLE "Lead" ADD CONSTRAINT lead_contactable CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);

-- Only one active theme, only one default language
CREATE UNIQUE INDEX one_active_theme ON "Theme" ("isActive") WHERE "isActive" = true;
CREATE UNIQUE INDEX one_default_language ON "Language" ("isDefault") WHERE "isDefault" = true;

-- Testimonial rating is a 1-5 star value
ALTER TABLE "Testimonial" ADD CONSTRAINT testimonial_rating_range CHECK ("rating" BETWEEN 1 AND 5);
