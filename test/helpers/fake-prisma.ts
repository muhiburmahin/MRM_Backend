import { randomUUID } from 'node:crypto';
import { hashToken } from '../../src/auth/utils/token.util';

export interface FakeLead {
  id: string;
  ref: string;
  type: string;
  status: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string;
  payload: unknown;
  locale: string | null;
  landingPath: string | null;
  createdAt: Date;
  updatedAt: Date;
  consentAt: Date;
  policyId: string | null;
  assignedToId: string | null;
  firstContactedAt: Date | null;
  deletedAt: Date | null;
  changes: Array<{ from: string; to: string; createdAt: Date }>;
  notes: Array<{
    id: string;
    body: string;
    createdAt: Date;
    author: { id: string; name: string };
  }>;
}

export interface FakeMediaAsset {
  id: string;
  folderId: string | null;
  kind: string;
  storageKey: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  blurHash: string | null;
  alt: unknown;
  caption: unknown;
  createdAt: Date;
  uploadedById: string;
}

type SelectedMediaAsset = Omit<FakeMediaAsset, 'uploadedById'>;

type Data = Record<string, unknown>;

const asData = (value: unknown): Data =>
  typeof value === 'object' && value !== null ? (value as Data) : {};

const matchesValue = (value: unknown, condition: unknown): boolean => {
  if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) {
    return value === condition;
  }

  const filters = condition as Data;
  if (Array.isArray(filters.in) && !filters.in.includes(value)) return false;
  if (filters.not !== undefined && value === filters.not) return false;
  if (
    filters.lte instanceof Date &&
    (!(value instanceof Date) || value.getTime() > filters.lte.getTime())
  ) {
    return false;
  }
  if (typeof filters.contains === 'string') {
    if (typeof value !== 'string') return false;
    const haystack = filters.mode === 'insensitive' ? value.toLowerCase() : value;
    const needle =
      filters.mode === 'insensitive' ? filters.contains.toLowerCase() : filters.contains;
    if (!haystack.includes(needle)) return false;
  }
  return true;
};

const matchesWhere = (row: Data, where: unknown): boolean => {
  const filters = asData(where);
  return Object.entries(filters).every(([key, condition]) => {
    if (key === 'AND' && Array.isArray(condition)) {
      return condition.every((clause) => matchesWhere(row, clause));
    }
    if (key === 'OR' && Array.isArray(condition)) {
      return condition.some((clause) => matchesWhere(row, clause));
    }
    if (key === 'translations' || key === 'i18n') {
      const translations = Array.isArray(row.translations) ? row.translations.map(asData) : [];
      const relation = asData(condition);
      if (relation.some !== undefined) {
        const some = asData(relation.some);
        return translations.some((translation) => {
          const { OR, ...rest } = some;
          return (
            matchesWhere(translation, rest) &&
            (!Array.isArray(OR) || OR.some((clause) => matchesWhere(translation, clause)))
          );
        });
      }
      if (relation.none !== undefined) {
        return !translations.some((translation) => matchesWhere(translation, relation.none));
      }
      if (key === 'i18n' && typeof row.i18n === 'object' && row.i18n !== null) {
        return JSON.stringify(row.i18n)
          .toLowerCase()
          .includes(String(asData(condition).string_contains ?? '').toLowerCase());
      }
      return true;
    }
    return matchesValue(row[key], condition);
  });
};

const paginate = (rows: Data[], args: Data): Data[] => {
  const order = asData(args.orderBy);
  const [[field, direction]] = Object.entries(order);
  const ordered = field
    ? [...rows].sort((left, right) => {
        const a = left[field];
        const b = right[field];
        if (a === b) return 0;
        const leftValue = a instanceof Date ? a.getTime() : a;
        const rightValue = b instanceof Date ? b.getTime() : b;
        const comparison =
          leftValue === undefined
            ? -1
            : rightValue === undefined
              ? 1
              : typeof leftValue === 'number' && typeof rightValue === 'number'
                ? leftValue < rightValue
                  ? -1
                  : 1
                : String(leftValue).localeCompare(String(rightValue));
        return direction === 'desc' ? -comparison : comparison;
      })
    : [...rows];
  const skip = typeof args.skip === 'number' ? args.skip : 0;
  return typeof args.take === 'number'
    ? ordered.slice(skip, skip + args.take)
    : ordered.slice(skip);
};

const requiredRow = (rows: Data[], id: unknown, model: string): Data => {
  const row = rows.find((candidate) => candidate.id === id);
  if (!row) throw new Error(`${model} not found in fake database`);
  return row;
};

const assignDefined = (target: Data, source: unknown): void => {
  for (const [key, value] of Object.entries(asData(source))) {
    if (value !== undefined) target[key] = value;
  }
};

export class FakePrisma {
  readonly contact: { rows: FakeLead[] } = { rows: [] };
  readonly media: { rows: FakeMediaAsset[] } = { rows: [] };
  readonly posts: Data[] = [];
  readonly postTranslations: Data[] = [];
  readonly faqs: Data[] = [];
  readonly products: Data[] = [];
  readonly productTranslations: Data[] = [];
  readonly services: Data[] = [];
  readonly testimonials: Data[] = [];
  readonly pages: Data[] = [];
  readonly navigationMenus: Data[] = [];
  readonly navigationItems: Data[] = [];
  readonly clients: Data[] = [];
  readonly categories: Data[] = [];
  readonly tagsList: Data[] = [];
  readonly redirects: Data[] = [];

  readonly language = {
    findMany: async ({ where }: Data = {}): Promise<Data[]> => {
      const codes = asData(asData(where).code).in;
      const languages: Data[] = [
        { code: 'en', isEnabled: true, isDefault: true },
        { code: 'bn', isEnabled: true, isDefault: false },
      ];
      return languages.filter(
        (language) =>
          language.isEnabled === true && (!Array.isArray(codes) || codes.includes(language.code)),
      );
    },
  };

  readonly page = {
    count: async ({ where }: Data = {}): Promise<number> =>
      this.pages.filter((page) => matchesWhere(page, where)).length,
    findMany: async (args: Data): Promise<Data[]> => {
      const where = args.where;
      const skip = typeof args.skip === 'number' ? args.skip : 0;
      const take = typeof args.take === 'number' ? args.take : this.pages.length;
      return this.pages
        .filter((page) => matchesWhere(page, where))
        .sort(
          (left, right) =>
            Number(left.sortOrder) - Number(right.sortOrder) ||
            String(left.key).localeCompare(String(right.key)),
        )
        .slice(skip, skip + take)
        .map((page) => ({ ...page, translations: [...(page.translations as Data[])] }));
    },
    findUnique: async ({ where }: Data): Promise<Data | null> => {
      const page = this.pages.find((candidate) => candidate.id === asData(where).id);
      if (!page) return null;
      const children = this.pages.filter((candidate) => candidate.parentId === page.id).length;
      const translations = Array.isArray(page.translations) ? [...page.translations] : [];
      return {
        ...page,
        translations,
        _count: { children, policies: Number(page.policyCount ?? 0) },
      };
    },
    findFirst: async ({ where, select }: Data): Promise<Data | null> => {
      const page = this.pages.find((candidate) => matchesWhere(candidate, where));
      if (!page) return null;
      const pageSelection = asData(select);
      const translationSelection = asData(pageSelection.translations);
      const translationFields = asData(translationSelection.select);
      const translations = (page.translations as Data[])
        .filter((translation) => matchesWhere(translation, translationSelection.where))
        .map((translation) =>
          Object.keys(translationFields).length
            ? Object.fromEntries(
                Object.entries(translationFields)
                  .filter(([, include]) => include === true)
                  .map(([field]) => [field, translation[field]]),
              )
            : translation,
        );
      return {
        ...Object.fromEntries(
          Object.entries(pageSelection)
            .filter(([field, include]) => field !== 'translations' && include === true)
            .map(([field]) => [field, page[field]]),
        ),
        translations,
      };
    },
    create: async ({ data }: Data): Promise<Data> => {
      const input = asData(data);
      const now = new Date();
      const nested = asData(input.translations).create;
      const page: Data = {
        id: randomUUID(),
        key: input.key,
        template: input.template ?? 'default',
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder ?? 0,
        isSystem: false,
        createdAt: now,
        updatedAt: now,
        translations: [],
      };
      if (Array.isArray(nested)) {
        page.translations = nested.map((entry) => {
          const translation = asData(entry);
          const { language, ...fields } = translation;
          return {
            id: randomUUID(),
            pageId: page.id,
            locale: asData(asData(language).connect).code,
            ...fields,
            updatedAt: now,
          };
        });
      }
      this.pages.push(page);
      return { ...page, translations: [...(page.translations as Data[])] };
    },
    update: async ({ where, data }: Data): Promise<Data> => {
      const page = this.pages.find((candidate) => candidate.id === asData(where).id);
      if (!page) throw new Error('Page not found in fake database');
      const input = asData(data);
      const nested = asData(input.translations).upsert;
      const fields = Object.fromEntries(
        Object.entries(input).filter(([field]) => field !== 'translations'),
      );
      assignDefined(page, fields);
      if (Array.isArray(nested)) {
        const rows = page.translations as Data[];
        for (const entry of nested) {
          const upsert = asData(entry);
          const locale = asData(asData(upsert.where).pageId_locale).locale;
          const existing = rows.find((translation) => translation.locale === locale);
          if (existing) {
            assignDefined(existing, upsert.update);
            existing.updatedAt = new Date();
          } else {
            const create = asData(upsert.create);
            const { language, ...translationFields } = create;
            rows.push({
              id: randomUUID(),
              pageId: page.id,
              locale: asData(asData(language).connect).code,
              ...translationFields,
              updatedAt: new Date(),
            });
          }
        }
      }
      page.updatedAt = new Date();
      return { ...page, translations: [...(page.translations as Data[])] };
    },
    delete: async ({ where }: Data): Promise<Data> => {
      const index = this.pages.findIndex((candidate) => candidate.id === asData(where).id);
      if (index < 0) throw new Error('Page not found in fake database');
      return this.pages.splice(index, 1)[0];
    },
  };

  readonly service = {
    findUnique: async ({ where }: Data): Promise<Data | null> =>
      this.services.find((row) => row.id === asData(where).id) ?? null,
  };

  readonly navMenu = {
    findMany: async (): Promise<Data[]> =>
      [...this.navigationMenus]
        .sort((left, right) => String(left.key).localeCompare(String(right.key)))
        .map((menu) => ({
          id: menu.id,
          key: menu.key,
          _count: {
            items: this.navigationItems.filter((item) => item.menuId === menu.id).length,
          },
        })),
    findUnique: async ({ where }: Data): Promise<Data | null> => {
      const menu = this.navigationMenus.find((candidate) => candidate.key === asData(where).key);
      return menu ? { id: menu.id, key: menu.key } : null;
    },
    create: async ({ data }: Data): Promise<Data> => {
      const menu = { id: randomUUID(), key: asData(data).key };
      this.navigationMenus.push(menu);
      return menu;
    },
    update: async ({ where, data }: Data): Promise<Data> => {
      const menu = this.navigationMenus.find((candidate) => candidate.key === asData(where).key);
      if (!menu) throw new Error('Navigation menu not found in fake database');
      assignDefined(menu, data);
      return menu;
    },
  };

  readonly navItem = {
    findMany: async (args: Data): Promise<Data[]> => {
      const rows = this.navigationItems
        .filter((item) => matchesWhere(item, args.where))
        .sort(
          (left, right) =>
            Number(left.sortOrder) - Number(right.sortOrder) ||
            String(left.id).localeCompare(String(right.id)),
        );
      return rows.map((item) => {
        const select = asData(args.select);
        return Object.keys(select).length
          ? Object.fromEntries(
              Object.entries(select)
                .filter(([, include]) => include === true)
                .map(([field]) => [field, item[field]]),
            )
          : item;
      });
    },
    findFirst: async ({ where, select }: Data): Promise<Data | null> => {
      const item = this.navigationItems.find((candidate) => matchesWhere(candidate, where));
      if (!item) return null;
      const selected = Object.fromEntries(
        Object.entries(asData(select))
          .filter(([field, include]) => field !== '_count' && include === true)
          .map(([field]) => [field, item[field]]),
      );
      if (asData(select)._count) {
        selected._count = {
          children: this.navigationItems.filter((candidate) => candidate.parentId === item.id)
            .length,
        };
      }
      return selected;
    },
    create: async ({ data }: Data): Promise<Data> => {
      const item = { id: randomUUID(), ...asData(data) };
      this.navigationItems.push(item);
      return item;
    },
    update: async ({ where, data }: Data): Promise<Data> => {
      const item = requiredRow(this.navigationItems, asData(where).id, 'Navigation item');
      assignDefined(item, data);
      return item;
    },
    delete: async ({ where }: Data): Promise<Data> => {
      const item = requiredRow(this.navigationItems, asData(where).id, 'Navigation item');
      this.navigationItems.splice(this.navigationItems.indexOf(item), 1);
      return item;
    },
  };

  readonly post = {
    rows: this.posts,
    findFirst: async ({ where }: Data): Promise<Data | null> =>
      this.posts.find((post) => matchesWhere(post, where)) ?? null,
    findMany: async (args: Data): Promise<Data[]> =>
      paginate(
        this.posts.filter((post) => matchesWhere(post, args.where)),
        args,
      ).map((post) => ({
        ...post,
        translations: this.includedTranslations(post, asData(args.include).translations),
      })),
    count: async ({ where }: Data): Promise<number> =>
      this.posts.filter((post) => matchesWhere(post, where)).length,
    findUnique: async ({ where }: Data): Promise<Data | null> => {
      const post = this.posts.find((candidate) => candidate.id === asData(where).id);
      return post
        ? { ...post, translations: [...(post.translations as Data[])], tags: post.tags }
        : null;
    },
    create: async ({ data }: Data): Promise<Data> => {
      const input = asData(data);
      const nestedTranslations = asData(input.translations).create;
      const now = new Date();
      const post: Data = {
        id: randomUUID(),
        key: input.key,
        authorId: 'test-admin-id',
        categoryId: input.categoryId ?? null,
        coverId: input.coverId ?? null,
        readingMinutes: input.readingMinutes ?? null,
        isFeatured: input.isFeatured ?? false,
        createdAt: now,
        updatedAt: now,
        translations: [],
        tags: [],
      };
      if (Array.isArray(nestedTranslations)) {
        post.translations = nestedTranslations.map((value) => {
          const { language, ...details } = asData(value);
          const translation = {
            id: randomUUID(),
            postId: post.id,
            locale: asData(asData(language).connect).code ?? details.locale,
            ...details,
          };
          this.postTranslations.push(translation);
          return translation;
        });
      }
      this.posts.push(post);
      return { ...post, translations: [...(post.translations as Data[])], tags: [] };
    },
    update: async ({ where, data }: Data): Promise<Data> => {
      const post = requiredRow(this.posts, asData(where).id, 'Post');
      assignDefined(post, data);
      post.updatedAt = new Date();
      return { ...post, translations: [...(post.translations as Data[])], tags: post.tags };
    },
    delete: async ({ where }: Data): Promise<Data> => {
      const post = requiredRow(this.posts, asData(where).id, 'Post');
      this.posts.splice(this.posts.indexOf(post), 1);
      for (const translation of [...this.postTranslations]) {
        if (translation.postId === post.id) {
          this.postTranslations.splice(this.postTranslations.indexOf(translation), 1);
        }
      }
      return post;
    },
  };

  readonly postTranslation = {
    findFirst: async ({ where }: Data): Promise<Data | null> =>
      this.postTranslations.find((translation) => matchesWhere(translation, where)) ?? null,
    findMany: async (args: Data): Promise<Data[]> =>
      this.postTranslations
        .filter((translation) => {
          const where = asData(args.where);
          return (
            matchesWhere(translation, where) &&
            this.posts.some(
              (post) => post.id === translation.postId && matchesWhere(post, where.post),
            )
          );
        })
        .map((translation) => ({
          ...translation,
          post: this.posts.find((post) => post.id === translation.postId),
        })),
    upsert: async ({ where, create, update }: Data): Promise<Data> => {
      const unique = asData(asData(where).postId_locale);
      let translation = this.postTranslations.find(
        (item) => item.postId === unique.postId && item.locale === unique.locale,
      );
      if (translation) assignDefined(translation, update);
      else {
        translation = { id: randomUUID(), ...asData(create) };
        this.postTranslations.push(translation);
        const post = this.posts.find((candidate) => candidate.id === translation?.postId);
        if (post) (post.translations as Data[]).push(translation);
      }
      return translation;
    },
  };

  readonly faq = {
    rows: this.faqs,
    findMany: async (args: Data): Promise<Data[]> =>
      paginate(
        this.faqs.filter((faq) => matchesWhere(faq, args.where)),
        args,
      ),
    count: async ({ where }: Data): Promise<number> =>
      this.faqs.filter((faq) => matchesWhere(faq, where)).length,
    findUnique: async ({ where }: Data): Promise<Data | null> =>
      this.faqs.find((faq) => faq.id === asData(where).id) ?? null,
    create: async ({ data }: Data): Promise<Data> => {
      const input = asData(data);
      const faq = {
        id: randomUUID(),
        productId: input.productId ?? null,
        serviceId: input.serviceId ?? null,
        i18n: input.i18n,
        isPublished: input.isPublished ?? false,
        sortOrder: input.sortOrder ?? 0,
      };
      this.faqs.push(faq);
      return faq;
    },
    update: async ({ where, data }: Data): Promise<Data> => {
      const faq = requiredRow(this.faqs, asData(where).id, 'FAQ');
      assignDefined(faq, data);
      return faq;
    },
    delete: async ({ where }: Data): Promise<Data> => {
      const faq = requiredRow(this.faqs, asData(where).id, 'FAQ');
      this.faqs.splice(this.faqs.indexOf(faq), 1);
      return faq;
    },
  };

  readonly product = {
    rows: this.products,
    findFirst: async ({ where }: Data): Promise<Data | null> =>
      this.products.find((product) => matchesWhere(product, where)) ?? null,
    findMany: async (args: Data): Promise<Data[]> =>
      paginate(
        this.products.filter((product) => matchesWhere(product, args.where)),
        args,
      ).map((product) => ({ ...product, translations: [...(product.translations as Data[])] })),
    count: async ({ where }: Data): Promise<number> =>
      this.products.filter((product) => matchesWhere(product, where)).length,
    findUnique: async ({ where }: Data): Promise<Data | null> => {
      const product = this.products.find((candidate) => candidate.id === asData(where).id);
      return product ? { ...product, translations: [...(product.translations as Data[])] } : null;
    },
    create: async ({ data }: Data): Promise<Data> => {
      const input = asData(data);
      const nestedTranslations = asData(input.translations).create;
      const now = new Date();
      const product: Data = {
        id: randomUUID(),
        slug: input.slug,
        stage: input.stage ?? 'LIVE',
        status: input.status ?? (Array.isArray(nestedTranslations) && nestedTranslations.some((t: any) => t.status === 'PUBLISHED') ? 'PUBLISHED' : (Array.isArray(nestedTranslations) && nestedTranslations.length ? 'DRAFT' : 'PUBLISHED')),
        allowPublicDetail: input.allowPublicDetail ?? true,
        showOnHomepage: input.showOnHomepage ?? true,
        showOnProductsPage: input.showOnProductsPage ?? true,
        showInNavDropdown: input.showInNavDropdown ?? true,
        displayOrder: input.displayOrder ?? 0,
        logoId: input.logoId ?? null,
        heroImageId: input.heroImageId ?? null,
        brandColor: input.brandColor ?? null,
        productSiteUrl: input.productSiteUrl ?? null,
        demoUrl: input.demoUrl ?? null,
        privacyUrl: input.privacyUrl ?? null,
        termsUrl: input.termsUrl ?? null,
        isFeatured: input.isFeatured ?? false,
        sortOrder: input.sortOrder ?? 0,
        launchedAt: input.launchedAt ?? null,
        createdAt: now,
        updatedAt: now,
        translations: [],
      };
      if (Array.isArray(nestedTranslations)) {
        product.translations = nestedTranslations.map((value) => {
          const { language, ...details } = asData(value);
          const translation = {
            id: randomUUID(),
            productId: product.id,
            locale: asData(asData(language).connect).code ?? details.locale,
            ...details,
          };
          this.productTranslations.push(translation);
          return translation;
        });
      }
      this.products.push(product);
      return { ...product, translations: [...(product.translations as Data[])] };
    },
    update: async ({ where, data }: Data): Promise<Data> => {
      const product = requiredRow(this.products, asData(where).id, 'Product');
      assignDefined(product, data);
      product.updatedAt = new Date();
      return { ...product, translations: [...(product.translations as Data[])] };
    },
    delete: async ({ where }: Data): Promise<Data> => {
      const product = requiredRow(this.products, asData(where).id, 'Product');
      this.products.splice(this.products.indexOf(product), 1);
      for (const translation of [...this.productTranslations]) {
        if (translation.productId === product.id) {
          this.productTranslations.splice(this.productTranslations.indexOf(translation), 1);
        }
      }
      return product;
    },
  };

  readonly productTranslation = {
    findFirst: async ({ where }: Data): Promise<Data | null> =>
      this.productTranslations.find((translation) => matchesWhere(translation, where)) ?? null,
    findMany: async (args: Data): Promise<Data[]> =>
      this.productTranslations
        .filter((translation) => {
          const where = asData(args.where);
          const productWhere = asData(where.product);
          const product = this.products.find(
            (candidate) =>
              candidate.id === translation.productId && matchesWhere(candidate, productWhere),
          );
          return Boolean(product) && matchesWhere(translation, where);
        })
        .map((translation) => ({
          ...translation,
          product: this.products.find((product) => product.id === translation.productId),
        })),
    upsert: async ({ where, create, update }: Data): Promise<Data> => {
      const unique = asData(asData(where).productId_locale);
      const productId = (unique.productId as string) ?? (asData(where).productId as string);
      const locale = (unique.locale as string) ?? (asData(where).locale as string);
      let translation = this.productTranslations.find(
        (item) => item.productId === productId && item.locale === locale,
      );
      if (translation) {
        assignDefined(translation, update);
        const product = this.products.find((candidate) => candidate.id === productId);
        if (product && Array.isArray(product.translations)) {
          const idx = (product.translations as Data[]).findIndex((t) => t.locale === locale);
          if (idx !== -1) {
            assignDefined((product.translations as Data[])[idx], update);
          } else {
            (product.translations as Data[]).push(translation);
          }
        }
      } else {
        const createData = asData(create);
        const { product: prodConn, language: langConn, ...cleanCreate } = createData;
        translation = { id: randomUUID(), productId, locale, ...cleanCreate };
        this.productTranslations.push(translation);
        const product = this.products.find((candidate) => candidate.id === productId);
        if (product) (product.translations as Data[]).push(translation);
      }
      return translation;
    },
  };

  readonly testimonial = {
    rows: this.testimonials,
    findMany: async (args: Data): Promise<Data[]> =>
      paginate(
        this.testimonials.filter((row) => matchesWhere(row, args.where)),
        args,
      ),
    findFirst: async ({ where }: Data): Promise<Data | null> =>
      this.testimonials.find((row) => matchesWhere(row, where)) ?? null,
    findUnique: async ({ where }: Data): Promise<Data | null> =>
      this.testimonials.find((row) => row.id === asData(where).id) ?? null,
    count: async ({ where }: Data): Promise<number> =>
      this.testimonials.filter((row) => matchesWhere(row, where)).length,
    create: async ({ data }: Data): Promise<Data> => {
      const input = asData(data);
      const testimonial = {
        id: randomUUID(),
        clientId: input.clientId ?? null,
        authorName: input.authorName,
        authorRole: input.authorRole ?? null,
        quote: input.quote,
        isVerified: input.isVerified ?? false,
        evidenceNote: input.evidenceNote ?? null,
        consentAt: input.consentAt ?? null,
        showOnSite: input.showOnSite ?? false,
        sortOrder: input.sortOrder ?? 0,
      };
      this.testimonials.push(testimonial);
      return testimonial;
    },
    update: async ({ where, data }: Data): Promise<Data> => {
      const testimonial = requiredRow(this.testimonials, asData(where).id, 'Testimonial');
      assignDefined(testimonial, data);
      return testimonial;
    },
    delete: async ({ where }: Data): Promise<Data> => {
      const testimonial = requiredRow(this.testimonials, asData(where).id, 'Testimonial');
      this.testimonials.splice(this.testimonials.indexOf(testimonial), 1);
      return testimonial;
    },
  };

  readonly session = {
    findUnique: async ({ where }: { where: Data }) => {
      const tokenHash = String(where.tokenHash);
      const admin = tokenHash === hashToken('e2e-admin-session-token');
      const user = tokenHash === hashToken('e2e-user-session-token');
      if (!admin && !user) return null;
      return {
        id: admin ? 'admin-session-id' : 'user-session-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: admin ? 'test-admin-id' : 'test-user-id',
          email: admin ? 'admin@example.test' : 'user@example.test',
          name: admin ? 'Test Admin' : 'Test User',
          uiLocale: 'en',
          mustChangePassword: false,
          twoFactorEnabled: false,
          isActive: true,
          deletedAt: null,
          role: {
            id: admin ? 'admin-role-id' : 'user-role-id',
            key: admin ? 'admin' : 'user',
            name: admin ? 'Admin' : 'User',
            permissions: admin
              ? [
                  { permission: { key: 'lead:read' } },
                  { permission: { key: 'lead:write' } },
                  { permission: { key: 'lead:delete' } },
                  { permission: { key: 'media:upload' } },
                  { permission: { key: 'media:delete' } },
                  { permission: { key: 'post:read' } },
                  { permission: { key: 'post:write' } },
                  { permission: { key: 'post:delete' } },
                  { permission: { key: 'post:publish' } },
                  { permission: { key: 'content:read' } },
                  { permission: { key: 'content:write' } },
                  { permission: { key: 'content:delete' } },
                  { permission: { key: 'content:publish' } },
                  { permission: { key: 'product:read' } },
                  { permission: { key: 'product:write' } },
                  { permission: { key: 'product:delete' } },
                  { permission: { key: 'product:publish' } },
                  { permission: { key: 'page:read' } },
                  { permission: { key: 'page:write' } },
                  { permission: { key: 'page:publish' } },
                  { permission: { key: 'page:delete' } },
                  { permission: { key: 'nav:write' } },
                ]
              : [],
          },
        },
      };
    },
  };

  readonly lead = {
    create: async ({ data }: { data: Data }): Promise<FakeLead> => {
      const now = new Date();
      const row: FakeLead = {
        id: randomUUID(),
        ref: String(data.ref),
        type: String(data.type),
        status: 'NEW',
        name: String(data.name),
        email: String(data.email),
        phone: (data.phone as string | null | undefined) ?? null,
        company: null,
        message: String(data.message),
        payload: data.payload ?? null,
        locale: null,
        landingPath: null,
        createdAt: now,
        updatedAt: now,
        consentAt: data.consentAt as Date,
        policyId: null,
        assignedToId: null,
        firstContactedAt: null,
        deletedAt: null,
        changes: [],
        notes: [],
      };
      this.contact.rows.push(row);
      return row;
    },
    findMany: async ({ where, skip, take }: Data): Promise<FakeLead[]> => {
      let rows = this.contact.rows.filter((row) => this.matchesLead(row, asData(where)));
      const offset = typeof skip === 'number' ? skip : 0;
      if (typeof take === 'number') rows = rows.slice(offset, offset + take);
      return rows;
    },
    count: async ({ where }: { where: Data }): Promise<number> =>
      this.contact.rows.filter((row) => this.matchesLead(row, where)).length,
    findFirst: async ({ where }: { where: Data }): Promise<FakeLead | null> => {
      const row =
        this.contact.rows.find((lead) => lead.id === where.id && lead.deletedAt === null) ?? null;
      return row ? { ...row, changes: [...row.changes], notes: [...row.notes] } : null;
    },
    update: async ({ where, data }: { where: Data; data: Data }): Promise<FakeLead> => {
      const row = this.contact.rows.find((lead) => lead.id === where.id);
      if (!row) throw new Error('Lead not found in fake database');
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    },
  };

  readonly leadStatusChange = {
    create: async ({ data }: { data: Data }) => {
      const row = this.contact.rows.find((lead) => lead.id === data.leadId);
      row?.changes.push({
        from: String(data.from),
        to: String(data.to),
        createdAt: new Date(),
      });
      return data;
    },
  };

  readonly leadNote = {
    create: async ({ data }: { data: Data }) => {
      const row = this.contact.rows.find((lead) => lead.id === data.leadId);
      row?.notes.push({
        id: randomUUID(),
        body: String(data.body),
        createdAt: new Date(),
        author: { id: String(data.authorId), name: 'Test Admin' },
      });
      return data;
    },
  };

  readonly mediaAsset = {
    create: async ({ data }: { data: Data }): Promise<SelectedMediaAsset> => {
      const asset: FakeMediaAsset = {
        id: randomUUID(),
        folderId: (data.folderId as string | null | undefined) ?? null,
        kind: String(data.kind),
        storageKey: String(data.storageKey),
        url: String(data.url),
        fileName: String(data.fileName),
        mimeType: String(data.mimeType),
        sizeBytes: Number(data.sizeBytes),
        width: (data.width as number | null | undefined) ?? null,
        height: (data.height as number | null | undefined) ?? null,
        blurHash: (data.blurHash as string | null | undefined) ?? null,
        alt: data.alt ?? null,
        caption: data.caption ?? null,
        createdAt: new Date(),
        uploadedById: String(data.uploadedById),
      };
      this.media.rows.push(asset);
      return this.selectMedia(asset);
    },
    findMany: async ({ where, skip, take }: Data): Promise<SelectedMediaAsset[]> => {
      const filters = asData(where);
      let rows = this.media.rows.filter(
        (asset) =>
          (filters.kind === undefined || asset.kind === filters.kind) &&
          (filters.mimeType === undefined || asset.mimeType === filters.mimeType) &&
          (filters.folderId === undefined || asset.folderId === filters.folderId),
      );
      const offset = typeof skip === 'number' ? skip : 0;
      if (typeof take === 'number') rows = rows.slice(offset, offset + take);
      return rows.map((asset) => this.selectMedia(asset));
    },
    count: async ({ where }: { where: Data }): Promise<number> => {
      const filters = asData(where);
      return this.media.rows.filter(
        (asset) =>
          (filters.kind === undefined || asset.kind === filters.kind) &&
          (filters.mimeType === undefined || asset.mimeType === filters.mimeType) &&
          (filters.folderId === undefined || asset.folderId === filters.folderId),
      ).length;
    },
    findUnique: async ({ where }: { where: Data }): Promise<SelectedMediaAsset | null> => {
      const asset = this.media.rows.find((row) => row.id === where.id);
      return asset ? this.selectMedia(asset) : null;
    },
    delete: async ({ where }: { where: Data }): Promise<FakeMediaAsset> => {
      const index = this.media.rows.findIndex((asset) => asset.id === where.id);
      if (index < 0) throw new Error('Media asset not found in fake database');
      return this.media.rows.splice(index, 1)[0];
    },
  };

  readonly auditLog = { create: async ({ data }: { data: Data }) => data };

  readonly caseStudy = { findFirst: async () => null };
  readonly client = {
    findMany: async () => [...this.clients],
    findUnique: async ({ where }: Data) => {
      const match = this.clients.find((c) => c.id === asData(where).id);
      return match ? { ...match, caseStudies: [], testimonials: [] } : null;
    },
    findFirst: async () => this.clients[0] ?? null,
    create: async ({ data }: Data) => {
      const row = { id: randomUUID(), ...asData(data) };
      this.clients.push(row);
      return row;
    },
    update: async ({ where, data }: Data) => {
      const match = this.clients.find((c) => c.id === asData(where).id);
      if (match) assignDefined(match, data);
      return match ?? null;
    },
    delete: async ({ where }: Data) => {
      const idx = this.clients.findIndex((c) => c.id === asData(where).id);
      if (idx >= 0) this.clients.splice(idx, 1);
      return { success: true };
    },
  };

  readonly postCategory = {
    findMany: async () => [...this.categories],
    findUnique: async ({ where }: Data) => {
      const w = asData(where);
      return this.categories.find((c) => (w.id ? c.id === w.id : c.slug === w.slug)) ?? null;
    },
    create: async ({ data }: Data) => {
      const row = { id: randomUUID(), ...asData(data) };
      this.categories.push(row);
      return row;
    },
    update: async ({ where, data }: Data) => {
      const match = this.categories.find((c) => c.id === asData(where).id);
      if (match) assignDefined(match, data);
      return match ?? null;
    },
    delete: async ({ where }: Data) => {
      const idx = this.categories.findIndex((c) => c.id === asData(where).id);
      if (idx >= 0) this.categories.splice(idx, 1);
      return { success: true };
    },
  };

  readonly tag = {
    findMany: async () => [...this.tagsList],
    findUnique: async ({ where }: Data) => {
      const w = asData(where);
      return this.tagsList.find((t) => (w.id ? t.id === w.id : t.slug === w.slug)) ?? null;
    },
    create: async ({ data }: Data) => {
      const row = { id: randomUUID(), ...asData(data) };
      this.tagsList.push(row);
      return row;
    },
    delete: async ({ where }: Data) => {
      const idx = this.tagsList.findIndex((t) => t.id === asData(where).id);
      if (idx >= 0) this.tagsList.splice(idx, 1);
      return { success: true };
    },
  };
  readonly pageTranslation = { findFirst: async () => null };
  readonly teamMember = { findFirst: async () => null };
  readonly technology = { findFirst: async () => null };
  readonly trustBadge = { findFirst: async () => null };
  readonly theme = { findFirst: async () => null };
  readonly redirect = {
    findMany: async () => [],
    findFirst: async () => null,
    create: async ({ data }: { data: Data }) => data,
  };
  readonly user = { findFirst: async () => null };
  readonly passwordReset = {
    findUnique: async () => null,
    deleteMany: async () => ({ count: 0 }),
    create: async ({ data }: { data: Data }) => data,
    update: async ({ data }: { data: Data }) => data,
  };
  readonly fontAsset = { findFirst: async () => null };
  readonly productScreenshot = { findFirst: async () => null };
  readonly caseStudyMedia = { findFirst: async () => null };
  readonly jobPosting = {
    findFirst: async () => null,
    findUnique: async () => null,
    findMany: async () => [],
    count: async () => 0,
    create: async ({ data }: { data: Data }) => data,
    update: async ({ data }: { data: Data }) => data,
    delete: async () => ({}),
  };
  readonly jobPostingTranslation = {
    create: async ({ data }: { data: Data }) => data,
    update: async ({ data }: { data: Data }) => data,
  };

  async $transaction<T>(
    operation: Promise<unknown>[] | ((tx: FakePrisma) => Promise<T>),
  ): Promise<T | unknown[]> {
    if (typeof operation === 'function') return operation(this);
    return Promise.all(operation);
  }

  private matchesLead(row: FakeLead, where: Data): boolean {
    if (row.deletedAt !== null) return false;
    if (where.status !== undefined && row.status !== where.status) return false;
    const clauses = where.OR;
    if (!Array.isArray(clauses)) return true;
    const searchTerms = clauses.map((clause) => {
      const fields = asData(clause);
      return Object.entries(fields).some(([field, condition]) => {
        const needle = String(asData(condition).contains ?? '').toLowerCase();
        const value = row[field as keyof FakeLead];
        return typeof value === 'string' && value.toLowerCase().includes(needle);
      });
    });
    return searchTerms.some(Boolean);
  }

  private includedTranslations(post: Data, include: unknown): Data[] {
    const translations = post.translations as Data[];
    const where = asData(include).where;
    return translations.filter((translation) => matchesWhere(translation, where));
  }

  private selectMedia(asset: FakeMediaAsset): SelectedMediaAsset {
    const {
      id,
      folderId,
      kind,
      storageKey,
      url,
      fileName,
      mimeType,
      sizeBytes,
      width,
      height,
      blurHash,
      alt,
      caption,
      createdAt,
    } = asset;
    return {
      id,
      folderId,
      kind,
      storageKey,
      url,
      fileName,
      mimeType,
      sizeBytes,
      width,
      height,
      blurHash,
      alt,
      caption,
      createdAt,
    };
  }
}
