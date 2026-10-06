import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PAGINATION } from '../../../../common/constants/pagination.constants';
import {
  CreatePrefectureDto,
  FindAllPrefectureQueryDto,
} from './prefecture.dto';
import { UpdatePrefectureDto } from './update-prefecture.dto';

/**
 * plain object → DTO に変換してバリデーションし、エラーになったプロパティ名を返すヘルパー
 */
const validateDto = async <T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
): Promise<string[]> => {
  const errors = await validate(plainToInstance(cls, plain));
  return errors.map((e) => e.property);
};

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
  describe('CreatePrefectureDto', () => {
    it('正常系: 全項目が正しい場合、エラーにならないこと', async () => {
      expect(await validateDto(CreatePrefectureDto, validCreatePlain)).toEqual(
        [],
      );
    });

    it('正常系: regionCode(任意項目)が未指定でもエラーにならないこと', async () => {
      const { regionCode, ...plain } = validCreatePlain;
      void regionCode;

      expect(await validateDto(CreatePrefectureDto, plain)).toEqual([]);
    });

    it.each(['name', 'code', 'kanaName', 'kanaEn'])(
      '異常系: 必須項目(%s)が未指定の場合、エラーになること',
      async (property) => {
        const plain: Record<string, unknown> = { ...validCreatePlain };
        delete plain[property];

        expect(await validateDto(CreatePrefectureDto, plain)).toEqual([
          property,
        ]);
      },
    );

    it.each(['name', 'code', 'kanaName', 'kanaEn'])(
      '異常系: 必須項目(%s)が空文字の場合、エラーになること',
      async (property) => {
        expect(
          await validateDto(CreatePrefectureDto, {
            ...validCreatePlain,
            [property]: '',
          }),
        ).toEqual([property]);
      },
    );

    it.each([
      ['name', 40],
      ['kanaName', 40],
      ['kanaEn', 40],
      ['code', 2],
      ['regionCode', 2],
    ])(
      '境界値: %s は %i 文字まで許容し、超える場合はエラーになること',
      async (property, max) => {
        expect(
          await validateDto(CreatePrefectureDto, {
            ...validCreatePlain,
            [property]: 'a'.repeat(max),
          }),
        ).toEqual([]);
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
  describe('UpdatePrefectureDto', () => {
    it('正常系: 全項目が任意のため、空のオブジェクトでもエラーにならないこと', async () => {
      expect(await validateDto(UpdatePrefectureDto, {})).toEqual([]);
    });

    it('正常系: 一部の項目だけ指定した場合、エラーにならないこと', async () => {
      expect(await validateDto(UpdatePrefectureDto, { name: '東京' })).toEqual(
        [],
      );
    });

    it('異常系: 指定した項目が空文字の場合、エラーになること(Createのバリデーションを引き継ぐ)', async () => {
      expect(await validateDto(UpdatePrefectureDto, { name: '' })).toEqual([
        'name',
      ]);
    });

    it('異常系: 文字数の上限を超える場合、エラーになること', async () => {
      expect(await validateDto(UpdatePrefectureDto, { code: '123' })).toEqual([
        'code',
      ]);
    });
  });

  //--------------------------------------
  // FindAllPrefectureQueryDto
  //--------------------------------------
  describe('FindAllPrefectureQueryDto', () => {
    it('正常系: 文字列のクエリパラメータが数値に変換されること', async () => {
      const dto = plainToInstance(FindAllPrefectureQueryDto, {
        page: '2',
        size: '10',
      });

      expect(await validate(dto)).toEqual([]);
      expect(dto.page).toBe(2);
      expect(dto.size).toBe(10);
    });

    it('正常系: 未指定の場合、エラーにならないこと', async () => {
      expect(await validateDto(FindAllPrefectureQueryDto, {})).toEqual([]);
    });

    it.each([
      ['page', '0'],
      ['page', '1.5'],
      ['page', String(PAGINATION.MAX_PAGE + 1)],
      ['size', '0'],
      ['size', '1.5'],
      ['size', String(PAGINATION.MAX_PAGE_SIZE + 1)],
    ])('異常系: %s=%s の場合、エラーになること', async (property, value) => {
      expect(
        await validateDto(FindAllPrefectureQueryDto, { [property]: value }),
      ).toEqual([property]);
    });
  });
});
