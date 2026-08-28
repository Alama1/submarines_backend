import { Controller, Get, Req } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Get('me')
  me(@Req() req: { user?: { type?: string; uid?: string; email?: string; label?: string } }) {
    return {
      type: req.user?.type ?? 'unknown',
      uid: req.user?.uid,
      email: req.user?.email,
      label: req.user?.label,
    };
  }
}
