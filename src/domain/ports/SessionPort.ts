import type { CampusRole } from '../../campusops/contracts';

export type UserSession = Readonly<{
  userId: string;
  role: CampusRole;
}>;

export interface SessionPort {
  getCurrentSession(): Promise<UserSession | null>;
  saveCurrentSession(session: UserSession): Promise<void>;
  clearCurrentSession(): Promise<void>;
}
