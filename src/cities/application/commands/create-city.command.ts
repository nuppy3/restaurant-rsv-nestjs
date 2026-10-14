/**
 * 【新規作成用】Application層の入力(Command)
 * 外部から入力される項目のみ（id・statusや日付はdomainの中で決まるため除外）
 *
 * domain(CreateCityProps)は都道府県をprefectureId(ID参照)で持つが、
 * 外部(API)からは都道府県コード(prefectureCode。例: '13' = 東京都)で指定されるため、
 * Commandは外部の形で受け取り、Application Serviceでid(prefectureId)に解決してからdomainに渡す。
 *
 * CityStateに項目が追加されても影響を受けないよう、Omitではなく明示的に定義する
 */
export type CreateCityCommand = {
  code: string;
  name: string;
  kanaName: string;
  // URL用の識別子(例: tokyo)。形式のチェック(半角英小文字・数字・ハイフン)はPresentation層のDTOで行う
  slug: string;
  // 表示順(小さいほど先に表示する)
  sortOrder: number;
  // 都道府県は任意(未指定なら都道府県なしで作成する)
  prefectureCode?: string;
};
