import { UserStatus } from 'generated/prisma';

export type JwtPayload = {
  sub: string; // subjectの略: ユーザーの識別子 （ユーザーIDなど）
  userName: string;
  status: UserStatus;
};
