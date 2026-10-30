# Backend audit report

**পর্যালোচনার তারিখ:** ১১ অক্টোবর ২০২৬  
**সীমা:** `src/`, Prisma schema/config, test setup, package scripts ও বর্তমান ডকুমেন্টেশন। Production database বা deployed server-এ পরীক্ষা করা হয়নি।

## সারসংক্ষেপ

বর্তমান ব্যাকএন্ডকে production বা industry-ready API হিসেবে ব্যবহার করা নিরাপদ নয়। সোর্সে auth, admin, contact, media,
products, blog, services, projects, team, FAQs, company, testimonials ও site-settings-এর API implementation আছে; কিন্তু
এগুলো একসাথে compile হয় না এবং অধিকাংশই `AppModule`-এ register করা নেই। বাস্তবে বর্তমানে শুধু health module register করা।

সবচেয়ে জরুরি বাধা হলো পরস্পরবিরোধী API/auth/schema implementation: পুরোনো API অংশ JWT/roles ও `PrismaModule` আশা করে,
অন্য অংশ session-cookie auth ব্যবহার করে, আর একাধিক service বর্তমান Prisma schema-তে নেই এমন model ধরে। পূর্ণ feature
refactor ছাড়া এগুলোকে শুধু AppModule-এ যোগ করলে কাজের API পাওয়া যাবে না এবং নিরাপত্তা/ডেটা ঝুঁকি তৈরি হবে।

## API inventory ও wiring

| API area | সোর্সে আছে | বর্তমানে `AppModule`-এ register |
|---|---:|---:|
| Health/liveness/readiness | হ্যাঁ | হ্যাঁ |
| Auth/session/password change | আংশিক | না |
| Admin/dashboard | আংশিক | না |
| Contact/inquiries, media | আংশিক | না |
| Products, blog, FAQs, company, site settings, testimonials | আংশিক | না |
| Services, projects, team | আংশিক | না |
| Navigation, careers ও অন্যান্য schema domain | অসম্পূর্ণ/শুধু পরিকল্পনা | না |

এ কারণে API controller থাকা মানেই endpoint live নয়। `AppModule` এখন শুধু `HealthModule` ও common infrastructure
import করে; অন্য controller Swagger বা HTTP routing-এ প্রকাশ পায় না।

## উচ্চ অগ্রাধিকারের blocker

1. **Build/type safety — P0**
   - `npm run typecheck` ব্যর্থ: ৬০টিরও বেশি TypeScript diagnostic দেখা গেছে।
   - বহু controller অনুপস্থিত `jwt-auth.guard`, `roles.guard`, `roles.decorator` আমদানি করে; একাধিক feature module
     অনুপস্থিত `PrismaModule`/`PrismaService` path ব্যবহার করে।
   - `argon2` dependency অনুপস্থিত; media upload-এর `multer` type declaration-ও নেই।
   - পুরোনো contact code `Contact`/`ContactStatus`/`ContactWhereInput` চায়, অথচ schema-তে inquiry model হলো `Lead`।
     পুরোনো blog/media/dashboard code-ও schema-র `Post`/`MediaAsset`-এর বদলে অন্য model নাম ব্যবহার করে।
   - `npm run lint` ব্যর্থ: ৭৩টি error, প্রধানত `any`-ভিত্তিক typing এবং formatting/regex issue।

2. **Auth ও route integration — P0**
   - `AuthModule` session cookie-ভিত্তিক, কিন্তু পুরোনো admin/contact/blog/products/company/FAQs/media controller
     JWT bearer + roles guard ধরে—সেই guard/decorator files নেই।
   - পুরোনো `src/common/guards/permissions.guard.ts` এবং `src/auth/guards/permissions.guard.ts` আলাদা metadata ও
     authorization contracts ব্যবহার করে। দুটিই global guard হিসেবে যুক্ত হলে বৈধ route-ও ভুলভাবে deny হতে পারে।
   - Admin route প্রকাশ করার আগে একটিমাত্র auth contract, cookie/CSRF/CORS নীতি, permission mapping ও guard order
     স্থির করে integration test দরকার।
   - `auth.config.ts`-এ `AUTH_IP_HASH_SALT` বাধ্যতামূলক, কিন্তু `.env.example`-এ auth settings নেই। AuthModule
     চালু করলে setup documentation/env template আগে সম্পূর্ণ করতে হবে।

3. **Automated test gate — P1**
   - Unit test চালনায় ১১টি suite pass করেছে; ২টি suite `argon2` না পাওয়ায় compile/run হয়নি। সফল ১২৮টি test pass।
   - Full e2e-তে contact/media suite-এর প্রয়োজনীয় `helpers/create-app`, `helpers/test-guards`,
     `helpers/fake-prisma` নেই। `supertest` import/type-ও ওই test-গুলোতে সঠিকভাবে resolve হচ্ছে না।
   - `test/setup-env.ts` আগে e2e Jest config-এ লোড হতো না; ফলে health e2e-র CORS test ব্যর্থ হচ্ছিল। এই wiring
     ঠিক করার পরে health e2e-র ৮টি test pass করেছে। বাকি e2e suite এখনও blocked।

4. **Feature completeness ও data safety — P1**
   - Public contact endpoint-এ per-route anti-abuse controls, honeypot/CAPTCHA strategy, privacy notice/consent,
     retention/deletion policy ও mail delivery/retry flow সম্পূর্ণ নয়। বর্তমান global in-memory throttle বহু instance
     deployment-এ shared rate limit নয়।
   - Media service local filesystem ও `process.env.UPLOAD_DIR` সরাসরি পড়ে; schema/provider mismatch আছে। MIME/signature
     ও size check থাকলেও image decode/re-encode, malware scan, durable object storage, reference/in-use deletion guard,
     backup/cleanup ও public URL serving যাচাই করা হয়নি।
   - Auth-এ session/password core আছে, কিন্তু 2FA, password reset, account invite/recovery, owner provisioning command,
     audit/revision workflow, production session cleanup ও integration tests পূর্ণ নয়। 2FA-enabled user-কে fail-closed
     block করা হয়েছে—এটি নিরাপদ fallback, কিন্তু feature complete নয়।

5. **Operations/production readiness — P1**
   - Prisma schema validation pass করেছে, কিন্তু migration তৈরি/পর্যালোচনা/প্রয়োগ এবং live PostgreSQL smoke test করা হয়নি।
   - `npm run build` এই অডিটে চালানো হয়নি; typecheck-এর blocker থাকায় production artifact সফল বলে ধরা যাবে না।
   - Multi-instance rate limiting, backup/restore drill, metrics/alerting, log retention, graceful shutdown under
     deployment, storage lifecycle ও incident procedures যাচাই বাকি।

## ইতিবাচক ভিত্তি

- Prisma schema নিজে `npm run prisma:validate`-এ pass করেছে।
- Health endpoint, global DTO validation, exception response mapping, Helmet/CORS configuration ও structured logging-এর
  ভালো foundation আছে।
- session token database-এ hash করে রাখা, password Argon2id দিয়ে hash করার code, generic login error এবং permission
  default-deny—এসব সঠিক দিকের design decision; তবে missing dependency/integration-এর কারণে এখনো verified live protection নয়।
- e2e test setup wiring সংশোধনের পর health suite-এর ৮/৮ test pass করেছে।

## এখন পর্যন্ত করা ছোট polish

- `test/jest-e2e.json`-এ `test/setup-env.ts` যুক্ত করা হয়েছে, যাতে e2e runtime-এ intended test environment ও CORS
  allow-list সত্যিই লোড হয়।
- README ও implementation status-এ বর্তমান partial/unwired অবস্থা স্পষ্ট করা হয়েছে; পুরোনো “foundation only” বিবরণকে
  production readiness হিসেবে ভুল বোঝার ঝুঁকি কমানো হয়েছে।
- কোনো feature controller production-এ register করা, schema বদলানো, migration চালানো বা database-এ লেখা হয়নি।

## প্রস্তাবিত কাজের ক্রম

1. API implementation-কে schema-র সঙ্গে মিলিয়ে একীভূত করা: কোন পুরোনো/নতুন module রাখা হবে স্থির করা; `Lead`, `Post`,
   `MediaAsset` ইত্যাদি canonical model-এ DTO/service rewrite করা; duplicate/ভাঙা code সরানোর আগে প্রতিটি route-এর
   প্রয়োজন ও source যাচাই করা।
2. `argon2`/multer dependencies ও test helpers যোগ করে typecheck, lint, unit, e2e, build—সব CI gate pass করানো।
3. session-cookie + CSRF + permission guard একীভূত করে প্রথমে auth/users/admin এবং একবারে একটি feature module wire করা।
4. public API-তে published-only filtering, response DTO allowlist, pagination/sort whitelist, per-route throttling,
   consent/retention ও integration tests সম্পূর্ণ করা।
5. media storage/security, transactional audit/revisions, migrations, production environment/secrets, observability,
   backup/restore ও staging smoke tests সম্পূর্ণ করে তারপর production readiness review করা।

**Go-live সুপারিশ:** বর্তমান অবস্থায় নয়। প্রথমে P0 build/integration blocker ও P1 auth/data safety কাজ শেষ করে staging
পরীক্ষা চালানো প্রয়োজন।
