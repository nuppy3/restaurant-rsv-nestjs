import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prefecture } from '../../prefectures/domain/prefectures.model';
import { PrefecturesQueryService } from '../../prefectures/query/prefectures.query.service';
import {
  City,
  CityStatus,
  ReconstituteCityProps,
} from '../domain/cities.model';
import {
  CITY_REPOSITORY_PORT,
  CityRepositoryPort,
} from '../domain/city.repository.port';
import {
  CityAlreadyEditedException,
  CityAlreadyPublishedException,
  CityAlreadySuspendedException,
} from '../domain/errors/cities.exceptions';
import { CitiesService } from './cities.service';
import { CreateCityCommand } from './commands/create-city.command';

// CitiesService(Application層)のテスト
// Application Serviceは「ユースケースの流れ」を組み立てる層なので、
// 依存先(Repository / PrefecturesQueryService)はモックにし、
// 「どんな状態の都市を保存しようとしたか」「依存先を正しく呼んだか」「例外を正しく扱うか」を検証する。
// domain(City)はモックにせず本物を使う(外部依存のない純粋なクラスのため)。
// ※ テストで使う共通データ(CITY_ID など)とモックデータの作成ヘルパー(buildMockCity など)はファイル末尾に定義している

// MockRepository定義(Region / Prefecture のspecと同じ書き方)
// as jest.Mocked<>はなくてもいいが、型安全に
const mockCityRepository = {
  findByIdOrFail: jest.fn(),
  findByCodeOrFail: jest.fn(),
  save: jest.fn(),
} as jest.Mocked<CityRepositoryPort>;

// MockPrefecturesQueryService定義(都道府県コード → 都道府県 の解決に使う)
const mockPrefecturesQueryService = {
  findByCodeOrFail: jest.fn(),
};

describe('■■■ CitiesService(Application) test ■■■', () => {
  // テスト対象のService
  let citiesService: CitiesService;
  // DIされたRepository(中身は上のmockCityRepository)。jest.spyOn()の対象にする
  let cityRepository: CityRepositoryPort;

  // 前処理: テスト全体の前に1回だけ実行(DIのセットアップ)
  beforeAll(async () => {
    // CitiesServiceが依存する2つ(Repository / PrefecturesQueryService)を
    // 上で定義したモックに差し替えてDIする(本物のDBやPrismaは使わない)
    const module = await Test.createTestingModule({
      providers: [
        CitiesService,
        { provide: CITY_REPOSITORY_PORT, useValue: mockCityRepository },
        {
          provide: PrefecturesQueryService,
          useValue: mockPrefecturesQueryService,
        },
      ],
    }).compile();

    citiesService = module.get<CitiesService>(CitiesService);
    // Repositoryは、interfaceのためSymbol(CITY_REPOSITORY_PORT)で取得する
    cityRepository = module.get<CityRepositoryPort>(CITY_REPOSITORY_PORT);
  });

  // 前処理: 各テストの前に毎回実行
  beforeEach(() => {
    // 前のテストで設定したモックの戻り値・呼び出し記録(mock.calls)をすべてリセットする
    jest.resetAllMocks();

    // saveは受け取ったdomainをそのまま返す
    // 本物のRepository.save()は「保存したdomainを返す」ため、その動きをまねている。
    // ⭐️ これにより「Serviceの戻り値(result) = saveに渡したdomain(同じインスタンス)」になるので、
    //    result の中身を見れば「どんな状態の都市を保存しようとしたか」を検証できる。
    //    あわせて save が (result, USER_ID) で呼ばれたことも検証し、保存処理を通ったことを確かめる。
    jest
      .spyOn(cityRepository, 'save')
      .mockImplementation((domain) => Promise.resolve(domain));
  });

  //--------------------------------------
  // create test
  //--------------------------------------
  describe('create', () => {
    it('正常系: 編集中・prefectureId付き・domainで採番したid(UUID)の都市が保存されること', async () => {
      // service 引数(command)作成
      const command = {
        code: '001',
        name: '東京',
        kanaName: 'トウキョウ',
        slug: 'tokyo',
        sortOrder: 1,
        prefectureCode: '13',
      } satisfies CreateCityCommand;

      // mock data 作成: 都道府県コード '13' を渡されたら、東京都(id: PREFECTURE_ID)を返す
      mockPrefecturesQueryService.findByCodeOrFail.mockResolvedValue(
        buildMockPrefecture(),
      );

      // test対象service呼び出し
      const result = await citiesService.create(command, USER_ID);

      // 検証: 保存しようとした都市の中身
      // domainはprivateフィールド(_name など)とgetterでできているため、
      // toSnapshot()でプレーンなオブジェクトにしてから比べる(失敗したときの差分も読みやすい)
      // toMatchObject: 指定した項目だけを比べる(毎回変わる日付は省略している)
      expect(result.toSnapshot()).toMatchObject({
        code: '001',
        name: '東京',
        kanaName: 'トウキョウ',
        slug: 'tokyo',
        sortOrder: 1,
        // 作成時は必ず編集中
        status: CityStatus.EDITING,
        // 都道府県コード '13' が都道府県ID(PREFECTURE_ID)に変換されていること
        prefectureId: PREFECTURE_ID,
      });
      // 検証: idはdomain(createNew)で採番済み(値は毎回変わるので形式で検証する)
      expect(result.id).toMatch(UUID_PATTERN);
      // 検証: その都市が、操作ユーザーのIDと一緒にsaveに渡されたこと
      expect(jest.spyOn(cityRepository, 'save')).toHaveBeenCalledWith(
        result,
        USER_ID,
      );
      // 検証: 都道府県コード '13' で都道府県を検索したこと
      expect(mockPrefecturesQueryService.findByCodeOrFail).toHaveBeenCalledWith(
        '13',
      );
    });

    it('正常系: prefectureCode未指定の場合、都道府県未設定で作成され、PrefecturesQueryServiceは呼ばれないこと', async () => {
      // test対象service呼び出し: prefectureCode を指定せずに作成する
      const result = await citiesService.create(
        {
          code: '001',
          name: '東京',
          kanaName: 'トウキョウ',
          slug: 'tokyo',
          sortOrder: 1,
        },
        USER_ID,
      );

      // 検証: 都道府県が未設定(undefined)の都市が保存されたこと
      expect(result.prefectureId).toBeUndefined();
      expect(jest.spyOn(cityRepository, 'save')).toHaveBeenCalledWith(
        result,
        USER_ID,
      );
      // 検証: 都道府県の検索は行われないこと
      expect(
        mockPrefecturesQueryService.findByCodeOrFail,
      ).not.toHaveBeenCalled();
    });

    it('異常系: prefectureCodeに該当する都道府県が存在しない場合、NotFoundExceptionをスローし、saveしないこと', async () => {
      // mock data 作成: 都道府県の検索で NotFoundException が投げられる(存在しない都道府県コード)
      mockPrefecturesQueryService.findByCodeOrFail.mockRejectedValue(
        new NotFoundException(
          'codeに関連する都道府県情報が存在しません!! code: 99',
        ),
      );

      // test対象service呼び出し、結果検証: NotFoundExceptionで失敗すること
      await expect(
        citiesService.create(
          {
            code: '001',
            name: '東京',
            kanaName: 'トウキョウ',
            slug: 'tokyo',
            sortOrder: 1,
            prefectureCode: '99',
          },
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
      // 検証: 途中で失敗したので、saveは呼ばれていないこと
      expect(jest.spyOn(cityRepository, 'save')).not.toHaveBeenCalled();
    });
  });

  //--------------------------------------
  // update test
  //--------------------------------------
  describe('update', () => {
    it('正常系: 指定した項目だけが更新されて保存されること', async () => {
      // mock data 作成: 更新対象として「編集中の東京」がDBから取得される
      jest
        .spyOn(cityRepository, 'findByIdOrFail')
        .mockResolvedValue(buildMockCity());

      // test対象service呼び出し: name と sortOrder だけを指定して更新する
      const result = await citiesService.update(
        CITY_ID,
        { name: '東京23区', sortOrder: 10 },
        USER_ID,
      );

      // 検証: 指定した項目(name / sortOrder)だけが変わり、他は元のままの都市が保存されたこと
      expect(result.toSnapshot()).toMatchObject({
        id: CITY_ID,
        code: '001',
        name: '東京23区',
        kanaName: 'トウキョウ',
        slug: 'tokyo',
        sortOrder: 10,
        status: CityStatus.EDITING,
        prefectureId: PREFECTURE_ID,
      });
      expect(jest.spyOn(cityRepository, 'save')).toHaveBeenCalledWith(
        result,
        USER_ID,
      );
      // 検証: 更新対象をidで取得したこと
      expect(jest.spyOn(cityRepository, 'findByIdOrFail')).toHaveBeenCalledWith(
        CITY_ID,
      );
      // 検証: prefectureCode を指定していないので、都道府県の検索は行われないこと
      expect(
        mockPrefecturesQueryService.findByCodeOrFail,
      ).not.toHaveBeenCalled();
    });

    it('正常系: prefectureCodeを指定した場合、prefectureIdに解決されて更新されること', async () => {
      // mock data 作成: 「都道府県未設定の東京」がDBから取得される
      jest
        .spyOn(cityRepository, 'findByIdOrFail')
        .mockResolvedValue(buildMockCity({ prefectureId: undefined }));
      // mock data 作成: 都道府県コード '13' → 東京都
      mockPrefecturesQueryService.findByCodeOrFail.mockResolvedValue(
        buildMockPrefecture(),
      );

      // test対象service呼び出し
      const result = await citiesService.update(
        CITY_ID,
        { prefectureCode: '13' },
        USER_ID,
      );

      // 検証: 都道府県コード '13' が都道府県IDに変換されて保存されたこと
      expect(result.prefectureId).toBe(PREFECTURE_ID);
      expect(jest.spyOn(cityRepository, 'save')).toHaveBeenCalledWith(
        result,
        USER_ID,
      );
      expect(mockPrefecturesQueryService.findByCodeOrFail).toHaveBeenCalledWith(
        '13',
      );
    });

    it('異常系: 掲載中(published)の場合、CityAlreadyPublishedExceptionをスローし、saveしないこと', async () => {
      // mock data 作成: 「掲載中の東京」がDBから取得される
      jest
        .spyOn(cityRepository, 'findByIdOrFail')
        .mockResolvedValue(buildMockCity({ status: CityStatus.PUBLISHED }));

      // test対象service呼び出し、結果検証: domainのルール(掲載中は更新不可)で例外になること
      await expect(
        citiesService.update(CITY_ID, { name: '東京23区' }, USER_ID),
      ).rejects.toThrow(CityAlreadyPublishedException);
      // 検証: 例外になったので、saveは呼ばれていないこと
      expect(jest.spyOn(cityRepository, 'save')).not.toHaveBeenCalled();
    });

    it('異常系: 都市が存在しない場合、NotFoundExceptionをそのままスローし、saveしないこと', async () => {
      // mock data 作成: Repositoryが404を投げる
      jest
        .spyOn(cityRepository, 'findByIdOrFail')
        .mockRejectedValue(
          new NotFoundException(
            `idに関連する都市情報が存在しません!! cityId: ${CITY_ID}`,
          ),
        );

      // test対象service呼び出し、結果検証
      await expect(
        citiesService.update(CITY_ID, { name: '東京23区' }, USER_ID),
      ).rejects.toThrow(NotFoundException);
      expect(jest.spyOn(cityRepository, 'save')).not.toHaveBeenCalled();
    });
  });

  //--------------------------------------
  // publish test
  //--------------------------------------
  describe('publish', () => {
    it('正常系: 掲載中(published)になった都市が保存されること', async () => {
      // mock data 作成: 「編集中の東京」がDBから取得される
      jest
        .spyOn(cityRepository, 'findByIdOrFail')
        .mockResolvedValue(buildMockCity());

      // test対象service呼び出し
      const result = await citiesService.publish(CITY_ID, USER_ID);

      // 検証: 掲載中になった都市が保存されたこと
      expect(result.toSnapshot()).toMatchObject({
        id: CITY_ID,
        status: CityStatus.PUBLISHED,
      });
      expect(jest.spyOn(cityRepository, 'save')).toHaveBeenCalledWith(
        result,
        USER_ID,
      );
    });

    it('異常系: すでに掲載中の場合、CityAlreadyPublishedExceptionをスローし、saveしないこと', async () => {
      // mock data 作成: 「掲載中の東京」
      jest
        .spyOn(cityRepository, 'findByIdOrFail')
        .mockResolvedValue(buildMockCity({ status: CityStatus.PUBLISHED }));

      // test対象service呼び出し、結果検証
      await expect(citiesService.publish(CITY_ID, USER_ID)).rejects.toThrow(
        CityAlreadyPublishedException,
      );
      expect(jest.spyOn(cityRepository, 'save')).not.toHaveBeenCalled();
    });
  });

  //--------------------------------------
  // unpublish test
  //--------------------------------------
  describe('unpublish', () => {
    it('正常系: 編集中(editing)に戻った都市が保存されること', async () => {
      // mock data 作成: 「掲載中の東京」
      jest
        .spyOn(cityRepository, 'findByIdOrFail')
        .mockResolvedValue(buildMockCity({ status: CityStatus.PUBLISHED }));

      // test対象service呼び出し
      const result = await citiesService.unpublish(CITY_ID, USER_ID);

      // 検証: 編集中に戻った都市が保存されたこと
      expect(result.toSnapshot()).toMatchObject({
        id: CITY_ID,
        status: CityStatus.EDITING,
      });
      expect(jest.spyOn(cityRepository, 'save')).toHaveBeenCalledWith(
        result,
        USER_ID,
      );
    });

    it('異常系: すでに編集中の場合、CityAlreadyEditedExceptionをスローし、saveしないこと', async () => {
      // mock data 作成: 「編集中の東京」
      jest
        .spyOn(cityRepository, 'findByIdOrFail')
        .mockResolvedValue(buildMockCity());

      // test対象service呼び出し、結果検証
      await expect(citiesService.unpublish(CITY_ID, USER_ID)).rejects.toThrow(
        CityAlreadyEditedException,
      );
      expect(jest.spyOn(cityRepository, 'save')).not.toHaveBeenCalled();
    });
  });

  //--------------------------------------
  // remove test
  //--------------------------------------
  // remove: ユースケースとしては「削除」だが、domainではsuspend()(停止中にする論理削除)を呼ぶ
  describe('remove', () => {
    it('正常系: 停止中(suspended)になった都市が保存されること', async () => {
      // mock data 作成: 「編集中の東京」
      jest
        .spyOn(cityRepository, 'findByIdOrFail')
        .mockResolvedValue(buildMockCity());

      // test対象service呼び出し
      const result = await citiesService.remove(CITY_ID, USER_ID);

      // 検証: 停止中になった都市が保存されたこと(物理削除ではなく、statusの更新として保存される)
      expect(result.toSnapshot()).toMatchObject({
        id: CITY_ID,
        status: CityStatus.SUSPENDED,
      });
      expect(jest.spyOn(cityRepository, 'save')).toHaveBeenCalledWith(
        result,
        USER_ID,
      );
    });

    it('異常系: すでに停止中の場合、CityAlreadySuspendedExceptionをスローし、saveしないこと', async () => {
      // mock data 作成: 「停止中の東京」
      jest
        .spyOn(cityRepository, 'findByIdOrFail')
        .mockResolvedValue(buildMockCity({ status: CityStatus.SUSPENDED }));

      // test対象service呼び出し、結果検証
      await expect(citiesService.remove(CITY_ID, USER_ID)).rejects.toThrow(
        CityAlreadySuspendedException,
      );
      expect(jest.spyOn(cityRepository, 'save')).not.toHaveBeenCalled();
    });
  });
});

// テストデータ(各テストで共通に使うID)
// ⭐️memo: ファイル末尾に定義していても、テストから問題なく参照できる。
//         describe() の中の各 it() の処理は「このファイル全体の読み込みが終わった後」に実行されるため、
//         その時点では下の const はすべて初期化済み(TDZ: 宣言前アクセスのエラーにはならない)。
//         ※ ただし describe() の直下(it() の外)で使うと、読み込み中に実行されるためエラーになる
const CITY_ID = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const PREFECTURE_ID = '0f2133bc-1d3c-4094-9acd-85587fcfbc20';
const USER_ID = '00000000-0000-4000-8000-000000000001';
// UUID形式(8-4-4-4-12桁の16進数)の正規表現。createでdomainが採番するidの検証用
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * 任意のstatusでCity domainのモックデータを作成するヘルパー
 * Repository.findByIdOrFail() が返すデータ(DBから取得した都市)の代わりに使う。
 *
 * 基本形は「編集中(editing)・都道府県(東京都)ありの東京」。引数で一部の項目だけを上書きできる。
 *   例) buildMockCity()                                 → 編集中の東京
 *       buildMockCity({ status: CityStatus.PUBLISHED }) → 掲載中の東京
 *       buildMockCity({ prefectureId: undefined })      → 都道府県未設定の東京
 *
 * domainはモックにせず、本物のCity.reconstitute()で作る(外部依存のない純粋なクラスのため)
 */
const buildMockCity = (overrides: Partial<ReconstituteCityProps> = {}): City =>
  City.reconstitute({
    id: CITY_ID,
    code: '001',
    name: '東京',
    kanaName: 'トウキョウ',
    slug: 'tokyo',
    status: CityStatus.EDITING,
    sortOrder: 1,
    prefectureId: PREFECTURE_ID,
    createdAt: new Date('2025-04-05T10:00:00.000Z'),
    updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    // 引数で渡された項目だけ、上の値を上書きする
    ...overrides,
  });

/**
 * PrefecturesQueryService.findByCodeOrFail の戻り値(都道府県: 東京都)のモックデータを作成するヘルパー
 * prefectureCode '13' を指定したときに返ってくる都道府県の代わりに使う
 * (CitiesServiceが使うのは id だけ)
 */
const buildMockPrefecture = (): Prefecture =>
  Prefecture.reconstitute({
    id: PREFECTURE_ID,
    code: '13',
    name: '東京都',
    kanaName: 'トウキョウト',
    kanaEn: 'Tokyo-to',
    status: 'published',
    createdAt: new Date('2025-04-05T10:00:00.000Z'),
    updatedAt: new Date('2025-04-05T12:30:00.000Z'),
  });
