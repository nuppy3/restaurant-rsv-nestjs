import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    // JWT認証用のモジュール
    PassportModule,
    JwtModule.register({
      // エンドポイント(controller)でJwtStrategyを呼ぶ際に渡す文字列を'jwt'と指定するとJwtModule
      // のJwtStrategyが呼ばれる。＠UseGuards(AuthGuard('jwt'))
      // AuthGuard()と、何も指定せずにJwtStratagyを呼びたい場合は、以下の指定が必要。
      // PassportModule.register({ defaultStrategy: 'jwt' })
      //
      // processはNode.js固有のもので、ブラウザのjavascriptにはない。
      // processはNode.jsのグローバルオブジェクトで、実行中のプログラム（プロセス）に関する情報や制御機能を提供するもの。
      // 特別にインポートしなくても、どこからでも使える便利なやつ！
      // 環境変数の取得やprocess.exit(0)で正常終了とか。
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: '1h',
      },
    }),
  ], // PrismaModule,PassportModule,JwtModule追加
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy], // JwtStrategy追加
})
export class AuthModule {}
