import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtTokens } from './jwt-tokens.service';

@Global()
@Module({
  imports: [
    JwtModule.register({}),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  providers: [JwtTokens],
  exports: [JwtModule, PassportModule, JwtTokens],
})
export class JwtInfrastructureModule {}
