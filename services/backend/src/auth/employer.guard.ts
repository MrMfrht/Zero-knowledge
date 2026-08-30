import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Employer-only routes.
 *
 * A shared bearer token, which is the right level for a hackathon and is NOT
 * production authentication. Its job is to stop the directory being an open
 * deanonymization API — see Part 0 of D's implementation plan.
 */
@Injectable()
export class EmployerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.EMPLOYER_API_TOKEN;
    if (!expected || expected === 'change-me-before-the-demo') {
      // Fail closed. A missing token must never mean "allow everyone".
      throw new UnauthorizedException('Employer API token is not configured');
    }
    const header = context.switchToHttp().getRequest<Request>().headers.authorization;
    if (header !== `Bearer ${expected}`) {
      throw new UnauthorizedException('Employer credentials required');
    }
    return true;
  }
}
