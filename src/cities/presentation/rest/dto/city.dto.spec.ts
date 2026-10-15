import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PAGINATION } from '../../../../common/constants/pagination.constants';
import { CreateCityDto, FindAllCityQueryDto } from './city.dto';
import { UpdateCityDto } from './update-city.dto';

// City の DTO(リクエストのバリデーション)のテスト
// 本番では、NestJS の ValidationPipe がリクエスト(JSON / クエリパラメータ)を
//   ① plainToInstance() で DTO のクラスのインスタンスに変換し(@Type による型変換もここで行われる)
//   ② validate() で DTO に付けたデコレーター(@IsNotEmpty / @Matches など)のチェックを行う
// という2段階で処理している。このテストでは、その2つを直接呼び出して同じことを再現する。
// ※ テストデータ(validCreatePlain)と検証用のヘルパー(validateDto)はファイル末尾に定義している

describe('□□□ City DTO TEST □□□', () => {
  //--------------------------------------
  // CreateCityDto
  //--------------------------------------
  // POST /cities のリクエストボディ
  // 必須: code / name / kanaName / slug / sortOrder、任意: prefectureCode(statusは受け付けない)
  describe('CreateCityDto', () => {
    it('正常系: 全項目が正しい場合、エラーにならないこと', async () => {
      // 検証: エラーが無い(空配列)こと
      expect(await validateDto(CreateCityDto, validCreatePlain)).toEqual([]);

      // 🗒：上記の検証はスマートで非常に素晴らしい。
      //     検証のプロセスを分解すると以下のことを実施している。参考まで。
      // const validPlain = {
      //   code: '001',
      //   name: '東京',
      //   kanaName: 'トウキョウ',
      //   slug: 'tokyo',
      //   sortOrder: 1,
      //   prefectureCode: '13',
      // };

      // // FindAllRegionsQueryDtoを作成(+ @Type(() => Number) の変換処理も実施)
      // const dto = plainToInstance(CreateCityDto, validPlain);

      // // validation実行
      // const errors = await validate(dto);

      // // 検証: エラーが発生しないこと/ pageとsizeがnumberに変換されること
      // expect(errors).toHaveLength(0);
      // expect(dto).toMatchObject({
      //   code: '001',
      //   name: '東京',
      //   kanaName: 'トウキョウ',
      //   slug: 'tokyo',
      //   sortOrder: 1,
      //   prefectureCode: '13',
      // });
    });

    it('正常系: prefectureCode(任意項目)が未指定でもエラーにならないこと', async () => {
      // リクエスト作成: 正常なリクエストから prefectureCode だけを取り除く
      const plain: Record<string, unknown> = { ...validCreatePlain };
      delete plain.prefectureCode;

      // 検証: @IsOptional() なので、未指定でもエラーにならないこと
      expect(await validateDto(CreateCityDto, plain)).toEqual([]);
    });

    // it.each: 同じテストを、配列の値(必須項目の名前)ごとに繰り返し実行する
    // (テスト名の %s に項目名が入る → 5件のテストになる)
    it.each(['code', 'name', 'kanaName', 'slug', 'sortOrder'])(
      '異常系: 必須項目(%s)が未指定の場合、エラーになること',
      async (property) => {
        // リクエスト作成: 正常なリクエストから、対象の項目だけを削除する
        const plain: Record<string, unknown> = { ...validCreatePlain };
        delete plain[property];

        // 検証: 削除した項目だけがエラーになること
        expect(await validateDto(CreateCityDto, plain)).toEqual([property]);
      },
    );

    it.each(['code', 'name', 'kanaName', 'slug'])(
      '異常系: 必須項目(%s)が空文字の場合、エラーになること',
      async (property) => {
        // リクエスト作成: 対象の項目だけを空文字にする
        // ([property]: '' は「変数 property の値をキー名にする」書き方(計算されたプロパティ名))
        // 検証: @IsNotEmpty() により、空文字の項目だけがエラーになること
        expect(
          await validateDto(CreateCityDto, {
            ...validCreatePlain,
            [property]: '',
          }),
        ).toEqual([property]);
      },
    );

    // 文字数の上限(@MaxLength)の境界値テスト
    // [項目名, 上限の文字数] の組み合わせごとに、上限ちょうど(OK)と上限+1(NG)を検証する
    // (テスト名の %s に項目名、%i に文字数が入る)
    // ・it.each<[string, number]>: 表の1行の型を [項目名(string), 文字数(number)] と指定する
    //   (指定しないと各引数が string | number と推論され、repeat() に渡すときに as number が必要になる)
    // ・'a'.repeat(n): 'a' を n 回繰り返した n 文字の文字列を作る
    //   slug は形式(@Matches)も満たす必要があるため、半角英小文字の 'a' を使う
    it.each<[string, number]>([
      ['code', 3],
      ['name', 255],
      ['kanaName', 255],
      ['slug', 50],
      ['prefectureCode', 2],
    ])(
      '境界値: %s は %i 文字まで許容し、超える場合はエラーになること',
      async (property, max) => {
        // 検証: 上限ちょうどの文字数はエラーにならないこと
        expect(
          await validateDto(CreateCityDto, {
            ...validCreatePlain,
            [property]: 'a'.repeat(max),
          }),
        ).toEqual([]);
        // 検証: 上限+1文字はエラーになること
        expect(
          await validateDto(CreateCityDto, {
            ...validCreatePlain,
            [property]: 'a'.repeat(max + 1),
          }),
        ).toEqual([property]);
      },
    );

    // slug の形式(@Matches(SLUG_PATTERN))のテスト
    // 形式: 半角英小文字・数字を、単語区切りのハイフン(1つ)でつないだもの
    it.each(['tokyo', 'new-york', 'area1', 'a-b-c', '123'])(
      '正常系: slugが正しい形式(%s)の場合、エラーにならないこと',
      async (slug) => {
        expect(
          await validateDto(CreateCityDto, { ...validCreatePlain, slug }),
        ).toEqual([]);
      },
    );

    // [slugの値, NGの理由] の組み合わせ(テスト名の %s に順番に入る)
    it.each<[string, string]>([
      ['Tokyo', '大文字を含む'],
      ['-tokyo', '先頭がハイフン'],
      ['tokyo-', '末尾がハイフン'],
      ['new--york', 'ハイフンが連続している'],
      ['new_york', 'アンダースコアを含む'],
      ['new york', '空白を含む'],
      ['東京', '日本語'],
    ])(
      '異常系: slugが不正な形式(%s: %s)の場合、エラーになること',
      async (slug) => {
        // 検証: slug だけがエラーになること
        expect(
          await validateDto(CreateCityDto, { ...validCreatePlain, slug }),
        ).toEqual(['slug']);
      },
    );

    it('正常系: sortOrderが0の場合、エラーにならないこと(下限ちょうど)', async () => {
      // 検証: @Min(0) なので 0 は許容されること
      expect(
        await validateDto(CreateCityDto, { ...validCreatePlain, sortOrder: 0 }),
      ).toEqual([]);
    });

    // [sortOrderの値, NGの理由]
    it.each<[number | string, string]>([
      [-1, '負の数'],
      [1.5, '小数'],
      ['1', '数値ではなく文字列'],
    ])(
      '異常系: sortOrderが不正(%s: %s)の場合、エラーになること',
      async (sortOrder) => {
        // 検証: sortOrder だけがエラーになること
        // (@IsInt(): 小数・文字列はNG / @Min(0): 負の数はNG)
        expect(
          await validateDto(CreateCityDto, { ...validCreatePlain, sortOrder }),
        ).toEqual(['sortOrder']);
      },
    );
  });

  //--------------------------------------
  // UpdateCityDto
  //--------------------------------------
  // PATCH /cities/:id のリクエストボディ
  // CreateCityDto の全項目を任意にしたもの(PartialType)。指定した項目のバリデーションは引き継がれる
  describe('UpdateCityDto', () => {
    it('正常系: 全項目が未指定(空のオブジェクト)でもエラーにならないこと', async () => {
      // 検証: 全項目が任意なので、何も指定しなくてもエラーにならないこと
      expect(await validateDto(UpdateCityDto, {})).toEqual([]);
    });

    it('正常系: 一部の項目だけを指定した場合、エラーにならないこと', async () => {
      expect(
        await validateDto(UpdateCityDto, { name: '東京', sortOrder: 10 }),
      ).toEqual([]);
    });

    it('異常系: 指定した項目は、CreateCityDtoと同じバリデーションが行われること(slugの形式違反)', async () => {
      // 検証: 任意項目でも、指定した場合は形式チェックが行われること
      expect(await validateDto(UpdateCityDto, { slug: 'Tokyo' })).toEqual([
        'slug',
      ]);
    });
  });

  //--------------------------------------
  // FindAllCityQueryDto
  //--------------------------------------
  // GET /cities?page=1&size=20 のクエリパラメータ
  // クエリパラメータは文字列で届くため、@Type(() => Number) で数値に変換してからチェックされる
  describe('FindAllCityQueryDto', () => {
    it('正常系: 未指定の場合、エラーにならないこと', async () => {
      expect(await validateDto(FindAllCityQueryDto, {})).toEqual([]);
    });

    it('正常系: 文字列の数値(クエリパラメータの形)が数値に変換され、エラーにならないこと', async () => {
      // 検証: '2' / '10' が @Type(() => Number) で 2 / 10 に変換され、チェックを通ること
      expect(
        await validateDto(FindAllCityQueryDto, { page: '2', size: '10' }),
      ).toEqual([]);
    });

    // [項目名, 下限, 上限] の組み合わせごとに、範囲外の値がエラーになることを検証する
    it.each<[string, number, number]>([
      ['size', PAGINATION.MIN_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE],
      ['page', PAGINATION.MIN_PAGE, PAGINATION.MAX_PAGE],
    ])(
      '境界値: %s は %i〜%i の範囲外の場合、エラーになること',
      async (property, min, max) => {
        // 検証: 下限-1 はエラー(クエリパラメータと同じく文字列で渡す)
        expect(
          await validateDto(FindAllCityQueryDto, {
            [property]: String(min - 1),
          }),
        ).toEqual([property]);
        // 検証: 上限+1 はエラー
        expect(
          await validateDto(FindAllCityQueryDto, {
            [property]: String(max + 1),
          }),
        ).toEqual([property]);
      },
    );

    it('異常系: 数値に変換できない値の場合、エラーになること', async () => {
      // 検証: 'abc' は Number('abc') = NaN になり、@IsInt() でエラーになること
      expect(await validateDto(FindAllCityQueryDto, { page: 'abc' })).toEqual([
        'page',
      ]);
    });
  });
});

// テストデータ・ヘルパー
// ⭐️memo: ファイル末尾に定義していても、テストから問題なく参照できる。
//         describe() の中の各 it() の処理は「このファイル全体の読み込みが終わった後」に実行されるため、
//         その時点では下の const はすべて初期化済み(TDZ: 宣言前アクセスのエラーにはならない)。
//         ※ ただし describe() の直下(it() の外)で使うと、読み込み中に実行されるためエラーになる

// ベースとなるテストデータ: CreateCityDto の正常なリクエスト(全項目を指定)
// 各テストでは、この値の一部だけを上書き・削除して異常系を作る
const validCreatePlain = {
  code: '001',
  name: '東京',
  kanaName: 'トウキョウ',
  slug: 'tokyo',
  sortOrder: 1,
  prefectureCode: '13',
};

/**
 * plain object → DTO に変換してバリデーションし、エラーになったプロパティ名を返すヘルパー
 *
 * ⭐️memo: `{ name: '東京' } satisfies CreateCityDto` のような書き方では、
 *         型をチェックしているだけで DTO のインスタンスは作られない(デコレーターも動かない)。
 *         そのため plainToInstance() で、デコレーター付きのクラスのインスタンスに変換してから validate() する。
 *
 * 戻り値はエラーになったプロパティ名の配列(例: ['slug'])。エラーが無ければ空配列 []。
 * 「どの項目がエラーになったか」だけを見れば十分なので、メッセージまでは検証しない。
 *
 * <T extends object>: 呼び出すときに決まる型(ジェネリクス)。渡したクラスから TypeScript が推論する
 * cls: new () => T  : 「new すると T ができるもの」= T のクラス(CreateCityDto など)
 *
 * @param cls 検証するDTOのクラス(例: CreateCityDto)
 * @param plain リクエストの内容を表すプレーンなオブジェクト
 */
const validateDto = async <T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
): Promise<string[]> => {
  const errors = await validate(plainToInstance(cls, plain));
  return errors.map((e) => e.property);
};
