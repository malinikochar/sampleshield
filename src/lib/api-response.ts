import { NextResponse } from 'next/server';
import type { ApiErrorCode, RpcMutationResult } from '@/types/domain';

export function statusFromErrorCode(code?: ApiErrorCode): number {
  switch (code) {
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'BAD_REQUEST':
      return 400;
    case 'DESTINATION_MISMATCH':
      return 422;
    case 'INVALID_STATE':
    case 'CONFLICT':
      return 409;
    default:
      return 500;
  }
}

export function apiError(
  errorCode: ApiErrorCode,
  message: string,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      ok: false,
      error_code: errorCode,
      message,
      ...extra,
    },
    {
      status: statusFromErrorCode(errorCode),
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
      },
    }
  );
}

export function apiFromRpc<T>(rpcResult: RpcMutationResult<T> | null, fallbackMsg: string) {
  if (!rpcResult) {
    return apiError('SERVER_ERROR', fallbackMsg);
  }
  if (!rpcResult.ok) {
    const code = rpcResult.error_code ?? 'SERVER_ERROR';
    return apiError(code, rpcResult.message ?? fallbackMsg, {
      exception_id: rpcResult.exception_id ?? null,
      current_status: rpcResult.current_status ?? null,
    });
  }
  return NextResponse.json(rpcResult, {
    status: 200,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}
