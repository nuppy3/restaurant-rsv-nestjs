// ■seed(初期データ投入)スクリプト
// 実行：npx prisma db seed（package.jsonのprisma.seedに定義したコマンドが実行される）
// すべてupsertなので、何度実行しても同じ結果になる(冪等)。
// 投入順：User → Region → Prefecture → Store（FKの参照先から順に作成する）
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma';
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
    `✅ seed completed: user=1, regions=${regions.length}, prefectures=${prefectures.length}, stores=${stores.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
