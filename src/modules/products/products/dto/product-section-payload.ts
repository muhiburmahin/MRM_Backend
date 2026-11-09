import type { Prisma } from '@prisma/client';

/** A child row as sent by the admin UI (the owning product id is added by the server). */
type Child<T extends { productId: string }> = Omit<T, 'productId' | 'id'>;

/** Scalar columns of `Product` that the per-tab section saves may write. All optional: a tab sends its own subset. */
type ProductScalars = Partial<
  Pick<
    Prisma.ProductUncheckedCreateInput,
    | 'allowPublicDetail'
    | 'brandColor'
    | 'canonicalUrl'
    | 'displayOrder'
    | 'enableCaseStudies'
    | 'enableDemos'
    | 'enableFaq'
    | 'enableGallery'
    | 'featuredOrder'
    | 'homepageOrder'
    | 'isFeatured'
    | 'logoUrl'
    | 'mainPurpose'
    | 'navOrder'
    | 'noIndex'
    | 'ogDescription'
    | 'ogImage'
    | 'ogTitle'
    | 'problemsAddressed'
    | 'productType'
    | 'seoDescription'
    | 'seoTitle'
    | 'shortDescription'
    | 'showInNavDropdown'
    | 'showOnHomepage'
    | 'showOnProductsPage'
    | 'slug'
    | 'stage'
    | 'status'
    | 'tagline'
    | 'targetAudience'
    | 'thumbnailUrl'
    | 'title'
    | 'twitterImage'
    | 'version'
  >
>;

/**
 * Body of `PATCH /admin/products/:id/section`. The controller validates only that `data` is an object, so every
 * field is optional and each tab reads just the keys it owns.
 */
export type ProductSectionPayload = ProductScalars & {
  description?: string | null;
  seoKeywords?: string | null;
  categoryId?: string | null;
  launchedAt?: string | Date | null;
  richFeatures?: Array<Child<Prisma.ProductFeatureItemUncheckedCreateInput> & { description?: string }>;
  mediaItems?: Array<Child<Prisma.ProductMediaItemUncheckedCreateInput>>;
  benefits?: Array<Child<Prisma.ProductBenefitUncheckedCreateInput>>;
  links?: Array<Child<Prisma.ProductLinkUncheckedCreateInput>>;
  demonstrations?: Array<Child<Prisma.ProductDemonstrationUncheckedCreateInput>>;
  productFaqs?: Array<Child<Prisma.ProductFaqItemUncheckedCreateInput>>;
};
