import { HttpError } from '../../core/client';
import { OpenBankError } from '../../core/types';
import { mapMtnError } from './mappers';

/**
 * Normalises every failure MTN can produce into an {@link OpenBankError}.
 * Shared by all products — nothing here is Collections-specific.
 */
export async function withMtnErrorMapping<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 0) {
        throw new OpenBankError('TIMEOUT', error.body, error.status);
      }
      const parsed = parseMtnErrorBody(error.body);
      throw mapMtnError(parsed?.code ?? 'UNKNOWN_ERROR', parsed?.message ?? error.message, error.status);
    }
    throw error;
  }
}

function parseMtnErrorBody(body: string): { code?: string; message?: string } | null {
  try {
    return JSON.parse(body) as { code?: string; message?: string };
  } catch {
    return null;
  }
}
