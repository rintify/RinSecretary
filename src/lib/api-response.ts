import { NextResponse } from 'next/server';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json({ success: true, data } as ApiResponse<T>, { status });
}

export function errorResponse(message: string, status: number = 500) {
  return NextResponse.json({ success: false, error: message } as ApiResponse<null>, { status });
}

/**
 * 汎用的なAPIハンドラーラッパー
 * @param handler 実行する非同期処理
 */
export async function createApiHandler<T>(handler: () => Promise<NextResponse<ApiResponse<T>> | T>) {
  try {
    const result = await handler();
    if (result instanceof NextResponse) return result as NextResponse<ApiResponse<T>>;
    return successResponse<T>(result);
  } catch (error: unknown) {
    console.error('[API Error]:', error);
    // TODO: ここでDiscord Webhook等への通知処理を拡張可能
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return errorResponse(errorMessage, 500);
  }
}
