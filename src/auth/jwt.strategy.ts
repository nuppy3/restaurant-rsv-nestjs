import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RequestUser } from 'src/types/requestUser';
import { JwtPayload } from '../types/jwtPayload';

/**
 * JwtStrategy: https://www.jwt.io/ja のように、Jwt認証を行います。
 * JwStrategyクラスは、passport-jwtのStrategyを使って(引数にとって)、
 * NestJS 向けにカスタマイズされた基底クラスを元にし(extendsし)、具体的な認証ロジック
 * （例えば validate メソッド）をカスタマイズします。
 *
 * memo:
 * [継承先クラス extends 継承元クラス] において 継承元クラス()という記述はできないが、
 * 以下の [JwtStrategy extends PassPortStrategy()] については、PassPortStrategy()はクラスを動的に
 * 生成するファクトリ関数である（クラスのインスタンスを返す）
 *
 * function PassportStrategy<T extends Strategy>(strategy: T, name?: string): typeof BasePassportStrategy {
 *  // 内部で strategy を受け取り、NestJS 用にカスタマイズしたクラスを返す(しかもインスタンスを返してる)
 *  new (...args: WithoutCallback<AllConstructorParameters<T>>): InstanceType<T> & PassportStrategyMixin<TValidationResult>;
 * }
 * JwStrategyは、ファクトリ関数にて生成されたクラスをextendsしている。
 * 要するに、ファクトリ関数を使った継承を用いて、Passport.js の多様なストラテジー(JWT、SNSなど)を
 *  NestJS で扱うための高度な設計にしている。まぁつかえるね。。
 *
 * この書き方は、Passport.js のストラテジーを NestJS のエコシステムに適応させるための NestJS 特有の方法。
 *
 * ちなみに、わかりやすく分解して実装すると以下。
 *
 * const GeneratedClass = PassportStrategy(Strategy); // Strategy を渡して新しいクラスを生成
 * class JwtStrategy extends GeneratedClass {
 * // カスタム実装
 * }
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  // ストラテジの初期化設定： 設定に従いリクエストからJWTを取得しJWT認証をしてくれる
  constructor() {
    // 秘密鍵取得
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    super({
      // リクエストのAuthorizationヘッダーのベアラートークンからJWTを取得(標準的な指定)
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // ignoreExpiration:false JWT有効期限チェックON：JWT有効期限が切れていた場合401にする
      ignoreExpiration: false,
      // 秘密鍵
      secretOrKey: secret,
    });
  }

  /**
   * validate()
   *
   * JWT認証後に呼ばれるメソッド
   * JwtStrategyの場合は引数にtokenからのペイロードが渡されるので、ペイロードから取得した
   * 値を後続処理(ルートハンドラ/エンドポイント/controller)に渡すことができる。
   * id,name,statusを含むユーザー情報オブジェクトを作成、返却します。
   * payloadをそのまま返却してもOK。今回はkey名を変更してオブジェクトを作成。
   *
   * @param payload tokenのペイロードが渡される（passport-jwtのJwtStrategyの場合）
   * @returns Type RequestUserオブジェクト
   */
  validate(payload: JwtPayload): RequestUser {
    return {
      id: payload.sub,
      name: payload.userName,
      status: payload.status,
    };
  }
}
