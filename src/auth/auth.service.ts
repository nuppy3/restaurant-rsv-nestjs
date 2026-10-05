import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from 'src/types/jwtPayload';
import { User } from '../../generated/prisma';
import { CreateUserDto } from './dto/create-user.dto';
import { CredentialsDto } from './dto/credentials.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismService: PrismaService,
    private readonly jwtservice: JwtService,
  ) {}

  // 以下の分割代入を、メソッドの引数内で実装することも可能
  // async createUser({ name, email, password, status }: CreateUserDto): Promise<User> {
  async createUser(dto: CreateUserDto): Promise<User> {
    // dtoのプロパティを取得（分割代入）
    const { name, email, password, status } = dto;
    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);
    // create（Insert）
    return await this.prismService.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        status,
      },
    });
  }

  /**
   * signIn()：ログイン処理
   * クレデンシャル情報を元に認証(認証情報の検証)を行い、認証に問題がなければToken生成し返却します。
   *
   * memo: なぜ返却値が{ token: string } のオブジェクト型なのか？( {} で囲うのか)
   * API設計の慣習であり、以下の3つが理由となる。NestJsの公式ドキュメントとかでも{}で返している。
   * ①レスポンスデータの一貫性
   *  レスポンスデータはオブジェクト（{ data: ... }とか{ id: number, name: string }）を返す
   *  ことが多いため、データの一貫性を保つため。
   * ②将来的な拡張性
   *  オブジェクトなら、token以外にuserIdを返したくなった場合にすぐに拡張可能。単純なstringだと
   *  拡張は難しい
   * ③可読性
   *   { token: "abc123" }のように名前付きプロパティで返すと、クライアント側で「これはトークンだ」と一目でわかる。
   *  Promise<string>においても、中に何が入る？かがわかりづらい。もしかしてセッションID?エラーメッセージ？token？
   *
   * @param dto
   * @returns
   */
  async signIn(dto: CredentialsDto): Promise<{ token: string }> {
    // credential取得
    const { email, password } = dto;
    // User情報取得
    const userInfo = await this.prismService.user.findUnique({
      where: {
        email,
        // passwordはuuidでハッシュ化しているので単純比較できない
        // password,
      },
    });

    // emailでUser情報が取得OK 且つ PassWordが一致 => User認証検証OK
    if (userInfo && (await bcrypt.compare(password, userInfo.password))) {
      // token生成 (ヘッダー/ペイロード/署名)
      const payload: JwtPayload = {
        sub: userInfo.id,
        userName: userInfo.name,
        status: userInfo.status,
      };
      // ヘッダーや署名に関する設定は自動で処理され、ペイロードのみでtokenが生成される
      // 署名の秘密鍵は、auth.module.tsのJwtModule.register()のimport宣言時に渡している
      const token = this.jwtservice.sign(payload);
      return { token };
    }

    throw new UnauthorizedException();
  }

  // findAll() {
  //   return `This action returns all auth`;
  // }

  // findOne(id: number) {
  //   return `This action returns a #${id} auth`;
  // }

  // update(id: number, updateAuthDto: UpdateAuthDto) {
  //   return `This action updates a #${id} auth`;
  // }

  // remove(id: number) {
  //   return `This action removes a #${id} auth`;
  // }
}
