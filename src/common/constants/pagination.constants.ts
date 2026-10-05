export const PAGINATION = {
  // ↓Default値はvalidationで使用しないので.envにて定義。
  // DEFAULT_PAGE_SIZE: 20,

  // NestJSのvalidationにおいて、Max(2000)など、2000の部分は静的リテラルしか受け付ける
  // ことができないので、以下のように定数で定義。this.configService.get<number>('MAX_PAGE_SIZE')
  // のように動的に取得してセットできない。
  MAX_PAGE_SIZE: 2000,
  MIN_PAGE_SIZE: 1,
  MAX_PAGE: 10000,
  MIN_PAGE: 1,

  // DEFAULT_PAGE: 1,
} as const; // メンバーをreadonlyに
