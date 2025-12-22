// guards/api-key.guard.ts
import {
    CanActivate,
    createParamDecorator,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAccess } from './entities/super-admin-access.entity';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(
        @InjectRepository(AdminAccess)
        private readonly adminAccessRepo: Repository<AdminAccess>,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();

        const apiKey =
            request.headers['x-api-key'] ||
            request.headers['X-API-KEY'];

        if (!apiKey) {
            throw new UnauthorizedException('API key missing');
        }

        const access = await this.adminAccessRepo.findOne({
            where: {
                api_key: apiKey,
                active: true,
            },
        });

        if (!access) {
            throw new UnauthorizedException('Invalid or inactive API key');
        }

        request.user = {
            role: 'super-admin',
            adminAccessId: access.id,
        };

        await Promise.all([
            this.adminAccessRepo.increment({ id: access.id }, 'push_count', 1),
            this.adminAccessRepo.update({ id: access.id }, { last_push_at: new Date() }),
        ]);

        request.adminAccess = access;

        return true;
    }
}

export const CurrentRole = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.role;
  },
);
