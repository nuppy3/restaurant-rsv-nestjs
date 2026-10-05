/* istanbul ignore file */
// ↑ GraphQLのField型指定(() => Stringなど)は、GraphQLModule起動時にしか
//   呼ばれないため、通常のunit testではカバーできない。regions.module.tsと同じ理由で除外。

import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Region, RegionStatus } from '../../../../regions/domain/regions.model';

// -------------------------------------------------
// GraphQLのenum型として作成したEnumをNestJSの
// 内部レジストリに登録: 自作EnumをGraphQLのEnumに登録
// -------------------------------------------------
// RegionStatus(modern enum)
registerEnumType(RegionStatus, { name: 'RegionStatus' });

// -------------------------------------------------
// ObjectType: 型安全なRegionドメインのサブセット
// -------------------------------------------------
export const RegionObjectTypeKeys = [
  'name',
  'code',
  'kanaName',
  'kanaEn',
  'status',
] satisfies (keyof Region)[];

/**
 * RegionObjectTypeの輪郭(Region domainをベースに)
 */
export type RegionObjectTypeShape = Pick<
  Region,
  (typeof RegionObjectTypeKeys)[number]
>;
/**
 * GraphQLのレスポンス定義
 *
 * "@ObjectType","@Field"はTypeScriptの型定義からGraphQLのオブジェクト型を
 * 作成するために使用される
 *
 * コードベースの場合は、このObject-TypeからGraphQLスキーマが自動生成される。
 */
@ObjectType()
export class RegionObjectType implements RegionObjectTypeShape {
  @Field()
  id!: string;

  @Field()
  code!: string;

  @Field()
  name!: string;

  @Field()
  kanaName!: string;

  @Field(() => String, { description: 'カナ英語' })
  kanaEn!: string;

  @Field(() => RegionStatus)
  status!: RegionStatus;

  // ↓追加。ロジックは書かない。型宣言のみ(実際の値はResolverの@ResolveField()が供給する)
  @Field(() => String, {
    description: 'ステータスの日本語ラベル(掲載中/編集中/停止)',
  })
  statusLabel!: string;

  // Query Service(findAll)の結果にPrismaの_countで既に含まれている値をそのまま公開
  // prefectureCountは任意項目(?付き) → nullable: ture
  @Field(() => Int, { nullable: true, description: '紐づく都道府県の件数' })
  prefectureCount?: number;
}

/**
 * @ResolveField()側が個別に供給するフィールド名の一覧(Queryメソッドの戻り値には含まれない)
 * 新しく@ResolveField()専用フィールドを追加する時は、ここに '|' で追記していく
 */
export type RegionObjectTypeResolverFields = 'statusLabel'; // union で繋げる。（'xxxx' | 'yyyyy' | 'zzzzz')

/**
 * Queryメソッドが実際に返す形(@ResolveField()専用フィールドを除いたもの)
 */
export type RegionQueryReturnType = Omit<
  RegionObjectType,
  RegionObjectTypeResolverFields
>;
