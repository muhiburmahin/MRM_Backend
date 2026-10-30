import { Type } from '@nestjs/common/interfaces';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Permissions } from '../decorators/permissions.decorator';
import { Public } from '../decorators/public.decorator';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const reflector = new Reflector();
  const guard = new PermissionsGuard(reflector);
  const handler = () => undefined;

  const contextFor = (target: Type<unknown>, targetHandler = handler) =>
    new ExecutionContextHost([], target, targetHandler);

  it('allows explicitly public handlers', () => {
    class PublicController {}
    Public()(PublicController);
    expect(guard.canActivate(contextFor(PublicController))).toBe(true);
  });

  it('denies protected handlers when authorization is not implemented', () => {
    class ProtectedController {}
    const protectedHandler = () => undefined;
    Permissions('lead:read')(protectedHandler);
    expect(() => guard.canActivate(contextFor(ProtectedController, protectedHandler))).toThrow(
      'Authorization is not implemented.',
    );
  });

  it('denies unannotated handlers by default', () => {
    class UnannotatedController {}
    const unannotatedHandler = () => undefined;
    expect(() => guard.canActivate(contextFor(UnannotatedController, unannotatedHandler))).toThrow(
      'Access denied.',
    );
  });
});
