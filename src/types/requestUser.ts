import { UserStatus } from 'generated/prisma';

export type RequestUser = {
  id: string;
  name: string;
  status: UserStatus;
};
