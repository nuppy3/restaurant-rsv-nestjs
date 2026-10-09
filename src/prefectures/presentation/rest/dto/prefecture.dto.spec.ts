import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PAGINATION } from '../../../../common/constants/pagination.constants';
import {
  CreatePrefectureDto,
  FindAllPrefectureQueryDto,
} from './prefecture.dto';
import { UpdatePrefectureDto } from './update-prefecture.dto';

// Prefecture の DTO(リクエストのバリデーション)のテスト
// 本番では、NestJS の ValidationPipe がリクエスト(JSON / クエリパラメータ)を
//   ① plainToInstance() で DTO のクラスのインスタンスに変換し(@Type による型変換もここで行われる)
//   ② validate() で DTO に付けたデコレーター(@IsNotEmpty / @MaxLength など)のチェックを行う
// という2段階で処理している。このテストでは、その2つを直接呼び出して同じことを再現する。

/**
 * plain object → DTO に変換してバリデーションし、エラーになったプロパティ名を返すヘルパー
 *
 * ⭐️memo: `{ name: '東京都' } satisfies CreatePrefectureDto` のような書き方では、
 *         型をチェックしているだけで DTO のインスタンスは作られない(デコレーターも動かない)。
 *         そのため plainToInstance() で、デコレーター付きのクラスのインスタンスに変換してから validate() する。
 *
 * 戻り値はエラーになったプロパティ名の配列(例: ['name'])。エラーが無ければ空配列 []。
 * 「どの項目がエラーになったか」だけを見れば十分なので、メッセージまでは検証しない。
 *
 * 🗒： <T extends object>：ジェネリクス（型の引数）
 * const validateDto = async <T extends object>( ... ) => { ... }
 * <T> は「呼び出すときに決まる型」を入れる箱です。関数の普通の引数（値）とは別に、型も引数として
 * 受け取れます。extends object は「T はオブジェクトの型に限る」という制約です（
 * 数値や文字列は不可）。DTO はクラスのインスタンス、つまりオブジェクトなので、この制約で十分です。
 * 位置について：アロー関数では、型の引数を ( の直前に書きます。async の後ろ、(引数) の前です。
 *
 * 呼び出し側は、T を明示しなくて構いません。渡したクラスから TypeScript が推論します。
 * validateDto(CreatePrefectureDto, {...})   // → T は CreatePrefectureDto と推論される
 * validateDto(UpdatePrefectureDto, {...})   // → T は UpdatePrefectureDto と推論される
 * 1つの関数で、どの DTO でも検証できるようにするための仕組みです。
 *
 * cls: new () => T, この場合の=> Tは、関数の型を矢印で書いている。
 * 「数値を受け取って、文字列を返す関数」の型
 * let fn: (x: number) => string; みたいなこと。
 * クラスは fn() のようには呼ばず、new Xxx() で使います。そこで、型の先頭に new を付けて
 * 「new で呼ぶもの」であることを表します。
 * let fn:  () => T;       // fn() と呼ぶと T が返る関数
 * let cls: new () => T;   // new cls() とすると T のインスタンスができるもの(= クラス)
 *
 * つまり new () => T は、「引数なしで new すると T ができるもの」＝「T のクラス」という意味です。
 *
 * 補足：JavaScript では、クラスも値です。なので、変数に入れたり、引数として渡したりできます。
 *
 * const C = CreatePrefectureDto;   // クラスそのものを変数に入れる(インスタンスではない)
 * const dto = new C();             // 変数に入ったクラスを new できる
 *
 * @param cls 検証するDTOのクラス(例: CreatePrefectureDto)
 * @param plain リクエストの内容を表すプレーンなオブジェクト
 */
const validateDto = async <T extends object>(
  cls: new () => T, // Tのクラスという意味(クラスであれば何でも渡せる) （cls: ClassConstructor<T> でもいいみたい）
  plain: Record<string, unknown>,
): Promise<string[]> => {
  const errors = await validate(plainToInstance(cls, plain));
  return errors.map((e) => e.property);
};

// ベースとなるテストデータ：CreatePrefectureDto の正常なリクエスト(全項目を指定)
// 各テストでは、この値の一部だけを上書き・削除して異常系を作る
const validCreatePlain = {
  name: '東京都',
  code: '13',
  kanaName: 'トウキョウト',
  kanaEn: 'Tokyo-to',
  regionCode: '03',
};

describe('□□□ Prefecture DTO TEST □□□', () => {
  //--------------------------------------
  // CreatePrefectureDto
  //--------------------------------------
  // POST /prefectures のリクエストボディ
  // 必須: name / code / kanaName / kanaEn、任意: regionCode(statusは受け付けない)
  describe('CreatePrefectureDto', () => {
    it('正常系: 全項目が正しい場合、エラーにならないこと', async () => {
      // 検証: エラーが無い(空配列)こと
      expect(await validateDto(CreatePrefectureDto, validCreatePlain)).toEqual(
        [],
      );
    });

    it('正常系: regionCode(任意項目)が未指定でもエラーにならないこと', async () => {
      // リクエスト作成: 正常なリクエストから regionCode だけを取り除く
      // (分割代入で regionCode を取り出し、残りを plain に入れる)
      const { regionCode, ...plain } = validCreatePlain;
      // 取り出した regionCode は使わないため、未使用変数の lint エラーを避ける目的で void で参照する
      void regionCode;

      // 検証: @IsOptional() なので、未指定でもエラーにならないこと
      expect(await validateDto(CreatePrefectureDto, plain)).toEqual([]);
    });

    // it.each: 同じテストを、配列の値(必須項目の名前)ごとに繰り返し実行する
    // (テスト名の %s に項目名が入る → name / code / kanaName / kanaEn の4件のテストになる)
    it.each(['name', 'code', 'kanaName', 'kanaEn'])(
      '異常系: 必須項目(%s)が未指定の場合、エラーになること',
      async (property) => {
        // リクエスト作成: 正常なリクエストから、対象の項目だけを削除する
        const plain: Record<string, unknown> = { ...validCreatePlain };
        delete plain[property];

        // 検証: 削除した項目だけがエラーになること
        expect(await validateDto(CreatePrefectureDto, plain)).toEqual([
          property,
        ]);
      },
    );

    it.each(['name', 'code', 'kanaName', 'kanaEn'])(
      '異常系: 必須項目(%s)が空文字の場合、エラーになること',
      async (property) => {
        // リクエスト作成: 対象の項目だけを空文字にする
        // ([property]: '' は「変数 property の値をキー名にする」書き方(計算されたプロパティ名))
        // 検証: @IsNotEmpty() により、空文字の項目だけがエラーになること
        expect(
          await validateDto(CreatePrefectureDto, {
            ...validCreatePlain,
            [property]: '',
          }),
        ).toEqual([property]);
      },
    );

    // 文字数の上限(@MaxLength)の境界値テスト
    // [項目名, 上限の文字数] の組み合わせごとに、上限ちょうど(OK)と上限+1(NG)の2つを検証する
    // (テスト名の %s に項目名、%i に文字数が入る)
    it.each([
      ['name', 40],
      ['kanaName', 40],
      ['kanaEn', 40],
      ['code', 2],
      ['regionCode', 2],
    ])(
      '境界値: %s は %i 文字まで許容し、超える場合はエラーになること',
      async (property, max) => {
        // 検証: 上限ちょうどの文字数('a'.repeat(max))はエラーにならないこと
        expect(
          await validateDto(CreatePrefectureDto, {
            ...validCreatePlain,
            [property]: 'a'.repeat(max),
          }),
        ).toEqual([]);
        // 検証: 上限を1文字超えると、その項目だけがエラーになること
        expect(
          await validateDto(CreatePrefectureDto, {
            ...validCreatePlain,
            [property]: 'a'.repeat(max + 1),
          }),
        ).toEqual([property]);
      },
    );
  });

  //--------------------------------------
  // UpdatePrefectureDto
  //--------------------------------------
  // PATCH /prefectures/:id のリクエストボディ
  // PartialType(CreatePrefectureDto) なので、全項目が任意(@IsOptional)になり、
  // それ以外のバリデーション(@IsNotEmpty / @MaxLength など)はCreateから引き継がれる
  describe('UpdatePrefectureDto', () => {
    it('正常系: 全項目が任意のため、空のオブジェクトでもエラーにならないこと', async () => {
      // 検証: 何も指定しなくてもエラーにならないこと
      expect(await validateDto(UpdatePrefectureDto, {})).toEqual([]);
    });

    it('正常系: 一部の項目だけ指定した場合、エラーにならないこと', async () => {
      // 検証: 更新したい項目(name)だけを指定してもエラーにならないこと
      expect(await validateDto(UpdatePrefectureDto, { name: '東京' })).toEqual(
        [],
      );
    });

    it('異常系: 指定した項目が空文字の場合、エラーになること(Createのバリデーションを引き継ぐ)', async () => {
      // 検証: 任意項目でも、指定した場合は @IsNotEmpty() のチェックが行われること
      // (@IsOptional は undefined / null のときだけチェックを飛ばす。空文字はチェックされる)
      expect(await validateDto(UpdatePrefectureDto, { name: '' })).toEqual([
        'name',
      ]);
    });

    it('異常系: 文字数の上限を超える場合、エラーになること', async () => {
      // 検証: code(上限2文字)に3文字を指定するとエラーになること(@MaxLength も引き継がれる)
      expect(await validateDto(UpdatePrefectureDto, { code: '123' })).toEqual([
        'code',
      ]);
    });
  });

  //--------------------------------------
  // FindAllPrefectureQueryDto
  //--------------------------------------
  // GET /prefectures のクエリパラメータ(?page=2&size=10)
  // ⭐️memo: クエリパラメータは、HTTPでは常に文字列で届く('2' や '10')。
  //         @Type(() => Number) で数値に変換してから、@IsInt / @Min / @Max でチェックする。
  //         そのため、テストでも値を文字列で渡している
  describe('FindAllPrefectureQueryDto', () => {
    it('正常系: 文字列のクエリパラメータが数値に変換されること', async () => {
      // DTO 作成: 文字列で渡す(実際のクエリパラメータと同じ)
      // (変換後の値も検証したいので、ヘルパーを使わずに plainToInstance を直接呼ぶ)
      const dto = plainToInstance(FindAllPrefectureQueryDto, {
        page: '2',
        size: '10',
      });

      // 検証: バリデーションエラーが無いこと
      expect(await validate(dto)).toEqual([]);
      // 検証: @Type(() => Number) により、文字列が数値に変換されていること
      expect(dto.page).toBe(2);
      expect(dto.size).toBe(10);
    });

    it('正常系: 未指定の場合、エラーにならないこと', async () => {
      // 検証: page / size は任意(@IsOptional)なので、未指定でもエラーにならないこと
      // (未指定のときは QueryService が環境変数のデフォルト値を使う)
      expect(await validateDto(FindAllPrefectureQueryDto, {})).toEqual([]);
    });

    // 異常な値の組み合わせごとに、エラーになることを検証する
    // [項目名, 値] の組み合わせ(テスト名の %s に順に入る → 「page=0 の場合…」など)
    // ・'0'          : @Min の下限(1)未満
    // ・'1.5'        : @IsInt(整数のみ)に違反
    // ・上限 + 1     : @Max の上限(MAX_PAGE / MAX_PAGE_SIZE)超え
    it.each([
      ['page', '0'],
      ['page', '1.5'],
      ['page', String(PAGINATION.MAX_PAGE + 1)],
      ['size', '0'],
      ['size', '1.5'],
      ['size', String(PAGINATION.MAX_PAGE_SIZE + 1)],
    ])('異常系: %s=%s の場合、エラーになること', async (property, value) => {
      // 検証: 指定した項目だけがエラーになること
      expect(
        await validateDto(FindAllPrefectureQueryDto, { [property]: value }),
      ).toEqual([property]);
    });
  });
});
