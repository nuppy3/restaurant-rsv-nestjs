import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Region } from '../../regions/domain/regions.model';
import { RegionsQueryService } from '../../regions/query/regions.query.service';
import {
  PrefectureAlreadyEditedException,
  PrefectureAlreadyPublishedException,
  PrefectureHasStoresException,
  PrefectureRegionNotAssignedException,
} from '../domain/errors/prefectures.exceptions';
import {
  PREFECTURE_REPOSITORY_PORT,
  PrefectureRepositoryPort,
} from '../domain/prefecture.repository.port';
import { PrefecturesDomainService } from '../domain/prefectures.domain.service';
import {
  Prefecture,
  PrefectureStatus,
  ReconstitutePrefectureProps,
} from '../domain/prefectures.model';
import { CreatePrefectureCommand } from './commands/create-prefecture.command';
import { PrefecturesService } from './prefectures.service';

// MockRepository定義(Regionのspecと同じ書き方)
// as jest.Mocked<>はなくてもいいが、型安全に
const mockPrefectureRepository = {
  findByIdOrFail: jest.fn(),
  findByCodeOrFail: jest.fn(),
  save: jest.fn(),
} as jest.Mocked<PrefectureRepositoryPort>;

// MockPrefecturesDomainService定義
const mockPrefecturesDomainService = {
  assertDeletable: jest.fn(),
};

// MockRegionsQueryService定義
const mockRegionsQueryService = {
  findByCodeOrFail: jest.fn(),
};

// テストデータ(各テストで共通に使うID)
const PREFECTURE_ID = '17b54147-b6ed-4d4e-a25f-4b632b0b444e';
const REGION_ID = '57a39a4b-921c-48ed-8045-4054be56feee';
const USER_ID = '00000000-0000-4000-8000-000000000001';

/**
 * 任意のstatusでPrefecture domain(ID付き)を作成するヘルパー
 *
 * 基本形は「編集中(editing)・地方(関東)あり・id付きの東京都」。
 * 引数で一部の項目だけを上書きできる。
 *   例) buildPrefectureWithId()                                     → 編集中の東京都
 *       buildPrefectureWithId({ status: PrefectureStatus.PUBLISHED }) → 掲載中の東京都
 *       buildPrefectureWithId({ regionId: undefined })               → 地方未設定の東京都
 *
 * Repository.findByIdOrFail() が返すデータ(DBから取得した都道府県)の代わりに使う。
 *
 * Repository mock data 作成
 * Region & {id:string} の生成は本物のRegion.reconstitute()を使うのばBP
 * Region は「ドメインモデル」であり、外部依存（DBやAPI）を持たない純粋なロジックのかたまりです。
 * これを Mock にしてしまうと、テストコードが非常に複雑になる割にメリットがありません。
 *
 */
const buildPrefectureWithId = (
  overrides: Partial<ReconstitutePrefectureProps> = {},
): Prefecture & { id: string } =>
  Object.assign(
    // reconstitute: DBから取得したデータでdomainを復元するメソッド(statusや日付を指定できる)
    Prefecture.reconstitute({
      code: '13',
      name: '東京都',
      kanaName: 'トウキョウト',
      kanaEn: 'Tokyo-to',
      status: PrefectureStatus.EDITING,
      regionId: REGION_ID,
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      // 引数で渡された項目だけ、上の値を上書きする
      ...overrides,
    }),
    // domainにidを付与する(Repositoryが返す形: Prefecture & { id })
    { id: PREFECTURE_ID },
  );

/**
 * RegionsQueryService.findByCodeOrFail の戻り値(地方: 関東)
 * regionCode '03' を指定したときに返ってくる地方のデータの代わりに使う
 */
const buildRegionWithId = (): Region & { id: string } =>
  Object.assign(
    Region.reconstitute({
      code: '03',
      name: '関東',
      kanaName: 'カントウ',
      kanaEn: 'kanto',
      status: 'published',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    }),
    { id: REGION_ID },
  );

describe('■■■ PrefecturesService(Application) test ■■■', () => {
  // テスト対象のService
  let prefecturesService: PrefecturesService;
  // DIされたRepository(中身は上のmockPrefectureRepository)。jest.spyOn()の対象にする
  let prefectureRepository: PrefectureRepositoryPort;

  /**
   * saveに渡された引数(domain)を取り出すヘルパー
   *
   * jestのモック関数は、呼ばれるたびに「渡された引数」を mock.calls に記録している。
   *   mock.calls       → [ [1回目の引数...], [2回目の引数...], ... ]
   *   mock.calls[0]    → 1回目の呼び出しの引数の配列 [domain, userId]
   *   mock.calls[0][0] → 1回目の呼び出しの1番目の引数 = saveに渡されたdomain
   *
   * Serviceがsaveに「正しい状態のdomain」を渡したかを検証するために使う。
   * (save の「戻り値」ではなく、save に「渡された値」を見ている点に注意)
   */
  const savedDomain = (): Prefecture & { id: string } =>
    jest.spyOn(prefectureRepository, 'save').mock.calls[0][0];

  // 前処理: テスト全体の前に1回だけ実行(DIのセットアップ)
  beforeAll(async () => {
    // PrefecturesServiceが依存する3つ(Repository / DomainService / RegionsQueryService)を
    // すべて上で定義したモックに差し替えてDIする(本物のDBやPrismaは使わない)
    const module = await Test.createTestingModule({
      providers: [
        PrefecturesService,
        {
          provide: PREFECTURE_REPOSITORY_PORT,
          useValue: mockPrefectureRepository,
        },
        {
          provide: PrefecturesDomainService,
          useValue: mockPrefecturesDomainService,
        },
        { provide: RegionsQueryService, useValue: mockRegionsQueryService },
      ],
    }).compile();

    prefecturesService = module.get<PrefecturesService>(PrefecturesService);
    // Repositoryは、interfaceのためSymbol(PREFECTURE_REPOSITORY_PORT)で取得する
    prefectureRepository = module.get<PrefectureRepositoryPort>(
      PREFECTURE_REPOSITORY_PORT,
    );
  });

  // 前処理: 各テストの前に毎回実行
  beforeEach(() => {
    // 前のテストで設定したモックの戻り値・呼び出し記録(mock.calls)をすべてリセットする
    // ※ リセット後のモックは何も設定されていない状態 = 呼ばれると undefined を返す
    console.log('beforeEach: モックをリセット');
    jest.resetAllMocks();

    // saveは受け取ったdomainをそのまま返す
    // 本物のRepository.save()は「保存したdomainを返す」ため、その動きをまねている。
    // これが無いと save() は undefined を返し、Serviceの戻り値(result)も undefined になる
    // → publish / unpublish / remove のテストで result.status を検証できなくなる
    //
    // 流れ: Service → save(domain, userId) → ここで domain をそのまま返す → Serviceがそれを return → result
    jest
      .spyOn(prefectureRepository, 'save')
      .mockImplementation((domain) => Promise.resolve(domain));
  });

  //--------------------------------------
  // create test
  //--------------------------------------
  describe('create', () => {
    it('正常系: 編集中のdomainがregionId付き・id空文字でsaveに渡されること', async () => {
      // servic 引数 (command) 作成
      const command = {
        code: '13',
        name: '東京都',
        kanaName: 'トウキョウト',
        kanaEn: 'Tokyo-to',
        regionCode: '03',
      } satisfies CreatePrefectureCommand;

      // mock data 設定
      // 【準備】地方コード '03' を渡されたら、関東(id: REGION_ID)を返すように設定
      mockRegionsQueryService.findByCodeOrFail.mockResolvedValue(
        buildRegionWithId(),
      );

      // ⭐️repository.saveにmockdataをセットしない
      // jestのモック関数(jest.fn())は、呼ばれるたびに「渡された引数」を mock.calls に
      // 記録している。
      // savedDomain()にて、jestでmock化したprefectureRepository.saveからmock.callsを
      // 呼び出し、save()で呼び出された第一引数のdomain情報を返し、以降の検証にてそのdomain情報の
      // 検証をおこなっている。(saveに渡されたdomainを元に検証する)
      // → ちょっと意味わからないと思うので、savedDomain()を要参照
      //
      // const mockPrefecture = Prefecture.reconstitute({
      //   code: '13',
      //   name: '東京都',
      //   kanaName: 'トウキョウト',
      //   kanaEn: 'Tokyo-to',
      //   status: 'published',
      //   regionId: REGION_ID,
      //   createdAt: new Date('2025-04-05T10:00:00.000Z'),
      //   updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      // });
      // // Prefecture + id
      // const repositoryMockData = Object.assign(mockPrefecture, {
      //   id: PREFECTURE_ID,
      // });
      // jest
      //   .spyOn(prefectureRepository, 'save')
      //   .mockResolvedValue(repositoryMockData);

      // test 対象 service 呼び出し
      // ⭐️ memo：
      // returnを取得して、toEqual()やtoMatchObject()で期待値データと比較する検証はしないで
      // repositoryでsaveされたデータをsavedDomain()で取得し検証する。
      // この検証方法がいいのかは分からない。。regions.service.spec.tsの方が好み
      await prefecturesService.create(command, USER_ID);

      // ------------------------------------
      // ⭐️【検証】saveに渡されたdomainの中身を1項目ずつ確認する
      // この検証方法がいいのかは分からない。。regions.service.spec.tsの方が好み
      // ------------------------------------
      const domain = savedDomain();

      // 【引数検証】地方コード '03' で地方を検索したこと
      expect(mockRegionsQueryService.findByCodeOrFail).toHaveBeenCalledWith(
        '03',
      );

      // 【引数検証】saveが「Prefecture(domain)」と「ユーザーID」で呼ばれたこと
      expect(jest.spyOn(prefectureRepository, 'save')).toHaveBeenCalledWith(
        domain,
        USER_ID,
      );

      //【検証】saveに渡されたdomainの中身を1項目ずつ確認する
      // 新規作成なので id は空文字(DBで採番される)
      expect(domain.id).toBe('');
      // 作成時は必ず編集中
      expect(domain.status).toBe(PrefectureStatus.EDITING);
      expect(domain.code).toBe('13');
      expect(domain.name).toBe('東京都');
      expect(domain.kanaName).toBe('トウキョウト');
      expect(domain.kanaEn).toBe('Tokyo-to');
      // 地方コード '03' が地方ID(REGION_ID)に変換されていること
      expect(domain.regionId).toBe(REGION_ID);
    });

    it('正常系: regionCode未指定の場合、地方未設定で作成され、RegionsQueryServiceは呼ばれないこと', async () => {
      // 【実行】regionCode を指定せずに作成する(準備は不要)
      await prefecturesService.create(
        {
          code: '13',
          name: '東京都',
          kanaName: 'トウキョウト',
          kanaEn: 'Tokyo-to',
        },
        USER_ID,
      );

      // 【検証】地方の検索は行われないこと
      expect(mockRegionsQueryService.findByCodeOrFail).not.toHaveBeenCalled();
      // 【検証】saveに渡されたdomainの地方が未設定(undefined)であること
      expect(savedDomain().regionId).toBeUndefined();
    });

    it('異常系: regionCodeに該当する地方が存在しない場合、NotFoundExceptionをスローし、saveしないこと', async () => {
      // mock data 作成
      // 【準備】地方の検索で NotFoundException が投げられるように設定(存在しない地方コード)
      const mockException = new NotFoundException(
        'codeに関連するエリア情報が存在しません!! code: 99',
      );
      mockRegionsQueryService.findByCodeOrFail.mockRejectedValue(mockException);

      // servic 引数 (command) 作成
      const command = {
        code: '13',
        name: '東京都',
        kanaName: 'トウキョウト',
        kanaEn: 'Tokyo-to',
        regionCode: '99',
      } satisfies CreatePrefectureCommand;

      // 【検証】create が NotFoundException で失敗すること
      await expect(prefecturesService.create(command, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
      // 【検証】途中で失敗したので、saveは呼ばれていないこと
      expect(jest.spyOn(prefectureRepository, 'save')).not.toHaveBeenCalled();
    });
  });

  //--------------------------------------
  // update test
  //--------------------------------------
  describe('update', () => {
    // mock data:
    // ①prefectureRepository, 'findByIdOrFail'
    // このケースいるかな。。全項目で更新検証すればいいのでは？？
    it('正常系: 指定した項目だけが更新されてsaveされること', async () => {
      // mock data 作成（prefectureRepository）
      // 【準備】更新対象として「編集中の東京都」がDBから取得されるように設定
      jest
        .spyOn(prefectureRepository, 'findByIdOrFail')
        .mockResolvedValue(buildPrefectureWithId());

      // メモ：prefectureRepository, 'save'にmock dataをセットしない

      // test 対象 servie 呼び出し
      // 【実行】name だけを指定して更新する
      await prefecturesService.update(PREFECTURE_ID, { name: '東京' }, USER_ID);

      // 【検証】更新対象をidで取得したこと
      expect(
        jest.spyOn(prefectureRepository, 'findByIdOrFail'),
      ).toHaveBeenCalledWith(PREFECTURE_ID);

      // 【検証】regionCode を指定していないので、地方の検索は行われないこと
      expect(mockRegionsQueryService.findByCodeOrFail).not.toHaveBeenCalled();

      // 【検証】saveに渡されたdomainで、name だけが変わり、他は元のままであること
      const domain = savedDomain();

      // 【引数検証】saveが「Prefecture(domain)」と「ユーザーID」で呼ばれたこと
      expect(jest.spyOn(prefectureRepository, 'save')).toHaveBeenCalledWith(
        domain,
        USER_ID,
      );
      // 【検証】項目
      expect(domain.id).toBe(PREFECTURE_ID);
      expect(domain.name).toBe('東京');
      expect(domain.code).toBe('13');
      expect(domain.regionId).toBe(REGION_ID);
    });

    it('正常系: regionCodeを指定した場合、regionIdに解決されて更新されること', async () => {
      // 【準備】更新対象として「地方未設定の東京都」がDBから取得されるように設定
      jest
        .spyOn(prefectureRepository, 'findByIdOrFail')
        .mockResolvedValue(buildPrefectureWithId({ regionId: undefined }));
      // 【準備】地方コード '03' を渡されたら、関東を返すように設定
      mockRegionsQueryService.findByCodeOrFail.mockResolvedValue(
        buildRegionWithId(),
      );

      // 【実行】regionCode だけを指定して更新する
      await prefecturesService.update(
        PREFECTURE_ID,
        { regionCode: '03' },
        USER_ID,
      );

      // 【検証】地方コード '03' で地方を検索したこと
      expect(mockRegionsQueryService.findByCodeOrFail).toHaveBeenCalledWith(
        '03',
      );
      // 【検証】saveに渡されたdomainの地方が、関東のID(REGION_ID)になっていること
      expect(savedDomain().regionId).toBe(REGION_ID);
    });

    it('異常系: 掲載中の場合、PrefectureAlreadyPublishedExceptionをスローし、saveしないこと', async () => {
      // 【準備】更新対象として「掲載中の東京都」がDBから取得されるように設定
      jest
        .spyOn(prefectureRepository, 'findByIdOrFail')
        .mockResolvedValue(
          buildPrefectureWithId({ status: PrefectureStatus.PUBLISHED }),
        );

      // 【実行・検証】掲載中は更新できないため、domainのupdate()が例外を投げること
      await expect(
        prefecturesService.update(PREFECTURE_ID, { name: '東京' }, USER_ID),
      ).rejects.toThrow(new PrefectureAlreadyPublishedException('東京都'));
      // 【検証】途中で失敗したので、saveは呼ばれていないこと
      expect(jest.spyOn(prefectureRepository, 'save')).not.toHaveBeenCalled();
    });

    it('異常系: 都道府県が存在しない場合、NotFoundExceptionをスローすること', async () => {
      // mock data 作成: Prefectureが存在しない（idはなんでもいい）
      const mockException = new NotFoundException(
        `idに関連する都道府県情報が存在しません!! prefectureId: ${PREFECTURE_ID}`,
      );
      // 【準備】idで検索しても見つからない(NotFoundException)ように設定
      jest
        .spyOn(prefectureRepository, 'findByIdOrFail')
        .mockRejectedValue(mockException);

      // 【実行・検証】update が NotFoundException で失敗すること
      // 引数は何でもいい
      await expect(
        prefecturesService.update(PREFECTURE_ID, { name: '東京' }, USER_ID),
      ).rejects.toThrow(
        new NotFoundException(
          `idに関連する都道府県情報が存在しません!! prefectureId: ${PREFECTURE_ID}`,
        ),
      );
      // 【検証】途中で失敗したので、saveは呼ばれていないこと
      expect(jest.spyOn(prefectureRepository, 'save')).not.toHaveBeenCalled();
    });
  });

  //--------------------------------------
  // publish test
  //--------------------------------------
  describe('publish', () => {
    it('正常系: 地方ありの編集中の都道府県が、掲載中になってsaveされること', async () => {
      // 【準備】対象として「地方あり・編集中の東京都」がDBから取得されるように設定
      jest
        .spyOn(prefectureRepository, 'findByIdOrFail')
        .mockResolvedValue(buildPrefectureWithId());

      // 【実行】掲載中にする
      // ※ resultは、beforeEachで設定した「saveが受け取ったdomainをそのまま返す」動きによって
      //    Serviceがpublish()で状態を変えたdomainになる
      const result = await prefecturesService.publish(PREFECTURE_ID, USER_ID);

      // saveに渡されたdomainを元に検証
      const domain = savedDomain();

      // 【検証】掲載中(published)になっていること
      expect(result.status).toBe(PrefectureStatus.PUBLISHED);
      // 【検証】saveが「Prefecture(domain)」と「ユーザーID」で呼ばれたこと
      expect(jest.spyOn(prefectureRepository, 'save')).toHaveBeenCalledWith(
        domain,
        USER_ID,
      );
    });

    it('異常系: 地方が未設定の場合、PrefectureRegionNotAssignedExceptionをスローし、saveしないこと', async () => {
      // 【準備】対象として「地方未設定の東京都」がDBから取得されるように設定
      jest
        .spyOn(prefectureRepository, 'findByIdOrFail')
        .mockResolvedValue(buildPrefectureWithId({ regionId: undefined }));

      // 【実行・検証】地方が未設定なので、domainのpublish()が例外を投げること
      await expect(
        prefecturesService.publish(PREFECTURE_ID, USER_ID),
      ).rejects.toThrow(new PrefectureRegionNotAssignedException('東京都'));
      // 【検証】途中で失敗したので、saveは呼ばれていないこと
      expect(jest.spyOn(prefectureRepository, 'save')).not.toHaveBeenCalled();
    });
  });

  //--------------------------------------
  // unpublish test
  //--------------------------------------
  describe('unpublish', () => {
    it('正常系: 掲載中の都道府県が、編集中になってsaveされること', async () => {
      // 【準備】対象として「掲載中の東京都」がDBから取得されるように設定
      jest
        .spyOn(prefectureRepository, 'findByIdOrFail')
        .mockResolvedValue(
          buildPrefectureWithId({ status: PrefectureStatus.PUBLISHED }),
        );

      // 【実行】掲載を取り下げる(resultはsaveが返したdomain。beforeEachの設定を参照)
      const result = await prefecturesService.unpublish(PREFECTURE_ID, USER_ID);

      // 【検証】編集中(editing)に戻っていること
      expect(result.status).toBe(PrefectureStatus.EDITING);
      // 【検証】saveが1回だけ呼ばれたこと
      expect(jest.spyOn(prefectureRepository, 'save')).toHaveBeenCalledTimes(1);
    });

    it('異常系: すでに編集中の場合、PrefectureAlreadyEditedExceptionをスローし、saveしないこと', async () => {
      // 【準備】対象として「編集中の東京都」がDBから取得されるように設定
      jest
        .spyOn(prefectureRepository, 'findByIdOrFail')
        .mockResolvedValue(buildPrefectureWithId());

      // 【実行・検証】すでに編集中なので、domainのunpublish()が例外を投げること
      await expect(
        prefecturesService.unpublish(PREFECTURE_ID, USER_ID),
      ).rejects.toThrow(new PrefectureAlreadyEditedException('東京都'));
      // 【検証】途中で失敗したので、saveは呼ばれていないこと
      expect(jest.spyOn(prefectureRepository, 'save')).not.toHaveBeenCalled();
    });
  });

  //--------------------------------------
  // remove test
  //--------------------------------------
  describe('remove', () => {
    it('正常系: assertDeletableを通過した場合、停止中になってsaveされること', async () => {
      // 【準備】対象として「編集中の東京都」がDBから取得されるように設定
      jest
        .spyOn(prefectureRepository, 'findByIdOrFail')
        .mockResolvedValue(buildPrefectureWithId());
      // 【準備】店舗チェック(assertDeletable)は例外を投げずに通過するように設定(店舗0件)
      mockPrefecturesDomainService.assertDeletable.mockResolvedValue(undefined);

      // 【実行】削除(論理削除)する(resultはsaveが返したdomain。beforeEachの設定を参照)
      const result = await prefecturesService.remove(PREFECTURE_ID, USER_ID);

      // 【検証】都道府県IDで店舗チェックを行ったこと
      expect(mockPrefecturesDomainService.assertDeletable).toHaveBeenCalledWith(
        PREFECTURE_ID,
      );
      // 【検証】停止中(suspended)になっていること
      expect(result.status).toBe(PrefectureStatus.SUSPENDED);
      // 【検証】saveが1回だけ呼ばれたこと
      expect(jest.spyOn(prefectureRepository, 'save')).toHaveBeenCalledTimes(1);
    });

    it('異常系: 店舗が紐づいている場合、PrefectureHasStoresExceptionをスローし、saveしないこと', async () => {
      // 【準備】対象として「編集中の東京都」がDBから取得されるように設定
      jest
        .spyOn(prefectureRepository, 'findByIdOrFail')
        .mockResolvedValue(buildPrefectureWithId());
      // 【準備】店舗チェックで例外が投げられるように設定(店舗あり)
      mockPrefecturesDomainService.assertDeletable.mockRejectedValue(
        new PrefectureHasStoresException(PREFECTURE_ID),
      );

      // 【実行・検証】remove が PrefectureHasStoresException で失敗すること
      await expect(
        prefecturesService.remove(PREFECTURE_ID, USER_ID),
      ).rejects.toThrow(new PrefectureHasStoresException(PREFECTURE_ID));
      // 【検証】途中で失敗したので、saveは呼ばれていないこと
      expect(jest.spyOn(prefectureRepository, 'save')).not.toHaveBeenCalled();
    });
  });
});
