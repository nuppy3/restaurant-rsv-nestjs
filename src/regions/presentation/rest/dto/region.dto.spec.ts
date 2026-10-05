import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegionStatus } from '../../../domain/regions.model';
import { SortBy, SortOrder } from '../../../query/region.filter';
import { FindAllRegionsQueryDto } from './region.dto';

/**
 * クエリパラメーターは実際には常にstringで渡ってくるため、
 * plainToInstance() による validation、string → nummber/enum変換込みで検証する
 */
describe('■■■ FindAllRegionsQueryDto TEST ■■■', () => {
  describe('validationテスト(正常系)', () => {
    it('正常系: code/name/status/page/size/sortBy/sortOrder(正常値)が指定された場合、validationエラーが発生しないこと', async () => {
      // const dto = {
      //   code: '01',
      //   name: '北海道',
      //   status: RegionStatus.PUBLISHED,
      //   page: 1,
      //   size: 20,
      // } satisfies FindAllRegionsQueryDto;

      // ⭐️memo:
      //  FindAllRegionsQueryDtoのデコレーターのチェックのため、インスタンス化。
      //  上記のsatisfies FindAllRegionsQueryDtoは、あくまで型チェックしているだけであり
      //  実際にFindAllRegionsQueryDtoを作成している訳ではないのでNG
      //  ただ、@Type(() => Number) の変換処理を検証する場合はplainToInstanceでインスタンスを
      //  作成する必要がある。
      //
      // const dto = new FindAllRegionsQueryDto();
      // dto.code = '01';
      // dto.name = '北海道';
      // dto.status = RegionStatus.PUBLISHED;
      // dto.page = 1;
      // dto.size = 20;

      // 正式版: クエリパラメーターは実際には常にstringで渡ってくる
      const obj = {
        code: '01',
        name: '北海道',
        status: RegionStatus.PUBLISHED,
        page: '1', // string (最小)
        size: '1', // string (最小)
        sortBy: SortBy.NAME,
        sortOrder: SortOrder.DESC,
      };

      // FindAllRegionsQueryDtoを作成(+ @Type(() => Number) の変換処理も実施)
      const dto = plainToInstance(FindAllRegionsQueryDto, obj);

      // validation実行
      const errors = await validate(dto);

      // 検証: エラーが発生しないこと/ pageとsizeがnumberに変換されること
      expect(errors).toHaveLength(0);
      expect(dto).toMatchObject({
        code: '01',
        name: '北海道',
        status: RegionStatus.PUBLISHED,
        page: 1, // string → number (最小)
        size: 1, // string → number (最小)
        sortBy: SortBy.NAME,
        sortOrder: SortOrder.DESC,
      });
    });
  });

  describe('validationテスト(正常系)の境界値テスト', () => {
    // 正常系の境界値ケース（異常系は後続で実施） ※page/sizeはそれぞれ分けるべきだが、ちょっと面倒だった。。
    it('正常系: page/size(正常値)の境界値', async () => {
      // 正式版: クエリパラメーターは実際には常にstringで渡ってくる
      const obj = {
        page: '10000', // (最大)
        size: '2000', // (最大)
      };

      const dto = plainToInstance(FindAllRegionsQueryDto, obj);

      // validation実行
      const errors = await validate(dto);

      // 検証: エラーが発生しないこと/ pageとsizeがnumberに変換されること
      expect(errors).toHaveLength(0);
      expect(dto).toMatchObject({
        page: 10000, // string → number
        size: 2000, // string → number
      });
    });
  });

  /**
   * DTOのUTは異常系がメイン
   */
  describe('validationテスト(異常系)', () => {
    it('異常系：codeのエラーチェック(@IsString,@Maxlength)', async () => {
      // 正式版: クエリパラメーターは実際には常にstringで渡ってくる
      const obj = {
        code: 123, // numberで渡してみる
        // name: '北海道',
        // status: RegionStatus.PUBLISHED,
        // page: '1', // string
        // size: '20', // string
      };

      const dto = plainToInstance(FindAllRegionsQueryDto, obj);

      // validation実行
      const errors = await validate(dto);

      // 検証： ValidationErrorの内容を検証する
      //
      // memo： 実際のValidationErrorの中身
      //
      // interface ValidationError {
      //   property: string;                    // どのプロパティでエラーになったか
      //   value?: unknown;                      // 実際に渡された値
      //   constraints?: { [type: string]: string }; // どの制約に違反したか（キー: 制約名、値: エラーメッセージ）
      //   children?: ValidationError[];         // ネストしたオブジェクトのエラー
      // }
      //
      // 具体例で、{ code: '010' }をvalidate()に渡すと、errors[0]は概ねこうなります。
      // {
      //   property: 'code',
      //   value: '010',
      //   constraints: {
      //     maxLength: 'code must be shorter than or equal to 2 characters',
      //   },
      // }

      // 同じプロパティが複数のルールに同時違反（constraintsに複数キー）
      // 例えばcodeに数値123（@IsString()違反）を渡すと、値が文字列でないため@MaxLength()側も
      // 評価できず一緒にエラーになることがあります（class-validatorはデフォルトで
      // 全デコレーターを評価するため）。この場合、codeに対するValidationErrorは1件だが、
      // constraintsは複数キーになります。
      expect(errors).toHaveLength(1); // codeプロパティのエラーは1件だけだが、constraintsは複数
      expect(errors[0].property).toBe('code');
      // constraintsオブジェクトにisString,maxLengthというキーが存在すること
      expect(errors[0].constraints).toHaveProperty('isString');
      expect(errors[0].constraints).toHaveProperty('maxLength');
    });

    it('異常系：nameのエラーチェック(@IsString,@Maxlength)', async () => {
      // テスト対象DTO作成: クエリパラメーターは実際には常にstringで渡ってくる
      const obj = {
        // 41桁(nuber型で41桁はオーバーフローのため実施しない)
        name: '12345678901234567890123456789012345678901',
        // status: RegionStatus.PUBLISHED,
        // page: '1', // string
        // size: '20', // string
      };
      const dto = plainToInstance(FindAllRegionsQueryDto, obj);

      // validation実行
      const errors = await validate(dto);

      // 検証： ValidationErrorの内容を検証する
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      // constraintsオブジェクトにisString,maxLengthというキーが存在すること
      // expect(errors[0].constraints).toHaveProperty('isString'); // 省略
      expect(errors[0].constraints).toHaveProperty('maxLength');
    });

    it('異常系：statusのエラーチェック(@IsEnum) 不正なenum値の場合、エラー', async () => {
      // テスト対象DTO作成: クエリパラメーターは実際には常にstringで渡ってくる
      const obj = {
        status: '不正なステータス',
        // page: '1', // string
        // size: '20', // string
      };
      const dto = plainToInstance(FindAllRegionsQueryDto, obj);

      // validation実行
      const errors = await validate(dto);

      // 検証： ValidationErrorの内容を検証する
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('status');
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });

    it('異常系：sortByのエラーチェック(@IsEnum) 不正なenum値の場合、エラー', async () => {
      // テスト対象DTO作成: クエリパラメーターは実際には常にstringで渡ってくる
      const obj = {
        sortBy: 'hogehoge',
        // sortOrder: SortOrder.DESC,
      };
      const dto = plainToInstance(FindAllRegionsQueryDto, obj);

      // validation実行
      const errors = await validate(dto);

      // 検証： ValidationErrorの内容を検証する
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('sortBy');
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });

    it('異常系：sortOrderのエラーチェック(@IsEnum) 不正なenum値の場合、エラー', async () => {
      // テスト対象DTO作成: クエリパラメーターは実際には常にstringで渡ってくる
      const obj = {
        // sortBy: SortBy.NAME,
        sortOrder: 'hogehoge',
      };
      const dto = plainToInstance(FindAllRegionsQueryDto, obj);

      // validation実行
      const errors = await validate(dto);

      // 検証： ValidationErrorの内容を検証する
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('sortOrder');
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });
  });

  describe('pageのエラーチェック', () => {
    // it.each([{}])('', async ({}) => {});
    it.each([
      {
        testCase: '@IsInt: pageが少数あり(Intじゃない)',
        note: 'isInt エラーが発生すること',
        filters: { page: '0.22' },
        expectedParam: 'isInt',
      },
      {
        testCase: '@Min(1): pageが０以下',
        note: 'min エラーが発生すること',
        filters: { page: '0' },
        expectedParam: 'min',
      },
      {
        testCase: '@Max(10000): pageが10000超(上限値+1)',
        note: 'max エラーが発生すること',
        filters: { page: '10001' },
        expectedParam: 'max',
      },
    ])('$testCase', async ({ filters, expectedParam }) => {
      // テスト対象DTO作成: クエリパラメーターは実際には常にstringで渡ってくる
      const dto = plainToInstance(FindAllRegionsQueryDto, filters);
      // validation実行
      const errors = await validate(dto);

      // 期待値：key名を取得（
      // memo: 配列の0番目の要素をpropertyという名前の変数に入れいる。2つ以上取りたければ、
      // const [a, b, c] = Object.keys(filters)
      const [property] = Object.keys(filters);

      // 検証： ValidationErrorの内容を検証する
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe(property);
      // constraintsオブジェクトにisString,maxLengthというキーが存在すること
      expect(errors[0].constraints).toHaveProperty(expectedParam);
    });
  });

  describe('sizeのエラーチェック(@IsInt,@Min,@Max)', () => {
    // it.each([{}])('', async ({}) => {});
    it.each([
      {
        testCase: '@IsInt: sizeが少数あり(Intじゃない)',
        note: 'isInt エラーが発生すること',
        filters: { size: '0.22' },
        expectedParam: 'isInt',
      },
      {
        testCase: '@Min(1): sizeが０以下',
        note: 'min エラーが発生すること',
        filters: { size: '0' },
        expectedParam: 'min',
      },
      {
        testCase: '@Max(2000): sizeが2000超(上限値+1)',
        note: 'max エラーが発生すること',
        filters: { size: '2001' },
        expectedParam: 'max',
      },
    ])('$testCase', async ({ filters, expectedParam }) => {
      // テスト対象DTO作成: クエリパラメーターは実際には常にstringで渡ってくる
      const dto = plainToInstance(FindAllRegionsQueryDto, filters);
      // validation実行
      const errors = await validate(dto);

      // key名取得
      const [property] = Object.keys(filters);

      // 検証： ValidationErrorの内容を検証する
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe(property);
      // constraintsオブジェクトにisString,maxLengthというキーが存在すること
      expect(errors[0].constraints).toHaveProperty(expectedParam);
    });
  });
});
