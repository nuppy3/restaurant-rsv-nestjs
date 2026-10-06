/**
 * 【新規作成用】Application層の入力(Command)
 * 外部から入力される項目のみ（statusや日付は内部で生成するため除外）
 *
 * domain(CreatePrefectureProps)は地方をregionId(ID参照)で持つが、
 * 外部(API)からは地方コード(regionCode)で指定されるため、Commandは外部の形で受け取り、
 * Application Serviceでid(regionId)に解決してからdomainに渡す。
 *
 * PrefectureStateに項目が追加されても影響を受けないよう、Omitではなく明示的に定義する
 */
export type CreatePrefectureCommand = {
  code: string;
  name: string;
  kanaName: string;
  kanaEn: string;
  regionCode?: string;
};
