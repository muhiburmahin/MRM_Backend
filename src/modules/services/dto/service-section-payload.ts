import type { Prisma } from '@prisma/client';

/** A child row as sent by the admin UI (the owning service id is added by the server). */
type Child<T extends { serviceId: string }> = Omit<T, 'serviceId' | 'id'>;

/** Scalar columns of `Service` that the per-tab section saves may write. All optional: a tab sends its own subset. */
type ServiceScalars = Partial<
  Pick<
    Prisma.ServiceUncheckedCreateInput,
    | 'allowPublicDetail'
    | 'approach'
    | 'brandColor'
    | 'canonicalUrl'
    | 'categoryId'
    | 'coverImage'
    | 'coverImageUrl'
    | 'description'
    | 'featuredOrder'
    | 'fullDescription'
    | 'homepageOrder'
    | 'icon'
    | 'includeInSitemap'
    | 'isFeatured'
    | 'keywords'
    | 'metaDescription'
    | 'name'
    | 'navbarOrder'
    | 'noIndex'
    | 'ogDescription'
    | 'ogImage'
    | 'ogTitle'
    | 'ourApproachSummary'
    | 'primaryCtaLabel'
    | 'problemSolved'
    | 'problemsAddressed'
    | 'secondaryCtaLabel'
    | 'seoDescription'
    | 'seoKeywords'
    | 'seoTitle'
    | 'serviceType'
    | 'servicesPageOrder'
    | 'shortDescription'
    | 'showInNavDropdown'
    | 'showInNavbar'
    | 'showOnHomepage'
    | 'showOnServicesPage'
    | 'slug'
    | 'status'
    | 'tagline'
    | 'targetAudience'
    | 'thumbnailImage'
    | 'thumbnailUrl'
    | 'title'
    | 'twitterImage'
  >
>;

/**
 * Body of `PATCH /admin/services/:id/section`. The controller validates only that `data` is an object, so every
 * field is optional and each tab reads just the keys it owns.
 */
export type ServiceSectionPayload = ServiceScalars & {
  offerings?: Array<Child<Prisma.ServiceOfferingItemUncheckedCreateInput>>;
  benefits?: Array<Child<Prisma.ServiceBenefitItemUncheckedCreateInput>>;
  processSteps?: Array<Child<Prisma.ServiceProcessStepItemUncheckedCreateInput>>;
  mediaGallery?: Array<Child<Prisma.ServiceMediaItemUncheckedCreateInput>>;
  serviceFaqs?: Array<Child<Prisma.ServiceFaqItemUncheckedCreateInput>>;
};
