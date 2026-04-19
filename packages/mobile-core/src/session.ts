import type { StorageAdapter } from "./storage";

export type SessionSnapshot<TStatus extends string = string> = {
  accessToken: string | null;
  refreshToken: string | null;
  approvalStatus: TStatus | null;
};

export interface SessionRepository<TStatus extends string = string> {
  read(): Promise<SessionSnapshot<TStatus>>;
  write(session: SessionSnapshot<TStatus>): Promise<void>;
  clear(): Promise<void>;
}

type CreateSessionRepositoryOptions = {
  storage: StorageAdapter;
  keys: {
    accessToken: string;
    refreshToken: string;
    approvalStatus?: string;
  };
};

export function createSessionRepository<TStatus extends string = string>(
  options: CreateSessionRepositoryOptions,
): SessionRepository<TStatus> {
  const { storage, keys } = options;

  return {
    async read() {
      const [accessToken, refreshToken, approvalStatus] = await Promise.all([
        storage.get(keys.accessToken),
        storage.get(keys.refreshToken),
        keys.approvalStatus ? storage.get(keys.approvalStatus) : Promise.resolve(null),
      ]);

      return {
        accessToken,
        refreshToken,
        approvalStatus: (approvalStatus as TStatus | null) ?? null,
      };
    },
    async write(session) {
      const operations: Promise<void>[] = [];

      if (session.accessToken) {
        operations.push(storage.set(keys.accessToken, session.accessToken));
      } else {
        operations.push(storage.remove(keys.accessToken));
      }

      if (session.refreshToken) {
        operations.push(storage.set(keys.refreshToken, session.refreshToken));
      } else {
        operations.push(storage.remove(keys.refreshToken));
      }

      if (keys.approvalStatus) {
        if (session.approvalStatus) {
          operations.push(storage.set(keys.approvalStatus, session.approvalStatus));
        } else {
          operations.push(storage.remove(keys.approvalStatus));
        }
      }

      await Promise.all(operations);
    },
    clear() {
      return storage.clearSession();
    },
  };
}
