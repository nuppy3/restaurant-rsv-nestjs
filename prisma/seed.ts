// ■seed(初期データ投入)スクリプト
// 実行：npx prisma db seed（package.jsonのprisma.seedに定義したコマンドが実行される）
// すべてupsertなので、何度実行しても同じ結果になる(冪等)。
// 投入順：User → Region → Prefecture → City → District → Store（FKの参照先から順に作成する）
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma';
import { cities } from './seed-data/cities';
import { districts } from './seed-data/districts';
import { prefectures } from './seed-data/prefectures';
import { regions } from './seed-data/regions';
import { stores } from './seed-data/stores';

const prisma = new PrismaClient();

// seedデータの所有者となる開発用ユーザー
// ログイン確認用のパスワードは環境変数 SEED_USER_PASSWORD で上書き可能
// (CredentialsDtoの@IsStrongPassword: 8文字以上・大小英字・数字・記号を各1つ以上 を満たすこと)
const SEED_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'seed-user',
  email: 'seed@example.com',
  password: process.env.SEED_USER_PASSWORD ?? 'Passw0rd!',
};

async function main() {
  const hashedPassword = await bcrypt.hash(SEED_USER.password, 10);
  const user = await prisma.user.upsert({
    where: { email: SEED_USER.email },
    update: { password: hashedPassword },
    create: {
      id: SEED_USER.id,
      name: SEED_USER.name,
      email: SEED_USER.email,
      password: hashedPassword,
      status: 'FREE',
    },
  });

  // 地方
  const regionIdByCode = new Map<string, string>();
  for (const r of regions) {
    const data = { ...r, status: 'published' as const, userId: user.id };
    const region = await prisma.region.upsert({
      where: { code: r.code },
      update: data,
      create: data,
    });
    regionIdByCode.set(region.code, region.id);
  }

  // 都道府県
  const prefectureIdByCode = new Map<string, string>();
  for (const { regionCode, ...p } of prefectures) {
    const data = {
      ...p,
      status: 'published' as const,
      regionId: regionIdByCode.get(regionCode),
      userId: user.id,
    };
    const prefecture = await prisma.prefecture.upsert({
      where: { code: p.code },
      update: data,
      create: data,
    });
    prefectureIdByCode.set(prefecture.code, prefecture.id);
  }

  // 都市
  // prefectureCode(都道府県コード)は、上で作成した都道府県のid(prefectureId)に置き換える
  const cityIdByCode = new Map<string, string>();
  for (const { prefectureCode, ...c } of cities) {
    const data = {
      ...c,
      prefectureId: prefectureIdByCode.get(prefectureCode),
      userId: user.id,
    };
    const city = await prisma.city.upsert({
      where: { code: c.code },
      update: data,
      create: data,
    });
    // 地区の cityCode → cityId の解決に使う
    cityIdByCode.set(city.code, city.id);
  }

  // 地区
  // cityCode(都市コード)は、上で作成した都市のid(cityId)に置き換える
  // cityId は必須のため、該当する都市が無い場合はエラーにする(seed-data の書き間違いに気づけるように)
  for (const { cityCode, ...d } of districts) {
    const cityId = cityIdByCode.get(cityCode);
    if (!cityId) {
      throw new Error(
        `地区 ${d.code}(${d.name}) の cityCode '${cityCode}' に該当する都市がありません`,
      );
    }
    const data = { ...d, cityId, userId: user.id };
    await prisma.district.upsert({
      where: { code: d.code },
      update: data,
      create: data,
    });
  }

  // 店舗
  for (const { prefectureCode, ...s } of stores) {
    const data = {
      ...s,
      prefectureId: prefectureCode
        ? prefectureIdByCode.get(prefectureCode)
        : null,
      userId: user.id,
    };
    await prisma.store.upsert({
      where: { code: s.code },
      update: data,
      create: data,
    });
  }

  console.log(
    `✅ seed completed: user=1, regions=${regions.length}, prefectures=${prefectures.length}, cities=${cities.length}, districts=${districts.length}, stores=${stores.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
