import { SetMetadata } from '@nestjs/common';
import { TIMEOUT_KEY } from '../interceptors/timeout.interceptor';

/**
 * Set custom request timeout in milliseconds for a route or controller.
 * Set to 0 to disable timeout (useful for large file uploads or streaming).
 */
export const SetRequestTimeout = (timeoutMs: number) => SetMetadata(TIMEOUT_KEY, timeoutMs);
export const SkipRequestTimeout = () => SetMetadata(TIMEOUT_KEY, 0);

