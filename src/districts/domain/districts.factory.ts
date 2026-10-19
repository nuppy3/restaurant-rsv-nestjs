import { CreateDistrictProps, District } from './districts.model';

/**
 * District domain の生成を担うFactory
 *
 * 🗒 現場、DistrictFactory.from()とDistrict.createNew()はどちらもdomainのFactory。
 *    TypeScript では「Factory からだけ呼べる」ようにはできない。
 *    Java の package-private や C# の internal に当たる「同じモジュール内だけ公開」
 *    という修飾子が、TypeScript にはありません。
 *
 *    Domain生成が単純なら、当該factoryのようなファクトリメソッドは不要で、CreateNew()だけで
 *    十分というのがよくある考え方です。が、以下の観点があるので、当該ファクトリメソッドを実装している。
 *
 *    Factory クラスが意味を持つのは、生成が複雑になったときです。例えば次のような場合です。
 *    code の自動採番など、他の集約や Repository の情報が必要
 *    複数の Entity や Value Object をまとめて組み立てる
 *    生成の種類が多く、Entity に置くと肥大化する
 */
export class DistrictFactory {
  static from(props: CreateDistrictProps): District {
    return District.createNew({
      code: props.code,
      name: props.name,
      kanaName: props.kanaName,
      slug: props.slug,
      sortOrder: props.sortOrder,
      cityId: props.cityId,
    } satisfies CreateDistrictProps);
  }
}
