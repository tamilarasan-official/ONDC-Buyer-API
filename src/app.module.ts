import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogIngestionModule } from './catalog-ingestion/catalog-ingestion.module';
import { join } from 'path';

import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { UserModule } from './user/user.module';
import { AuthenticationModule } from './authentication/authentication.module';
import { CategoryModule } from './category/category.module';
import { DishModule } from './dish/dish.module';
import { StoreModule } from './store/store.module';
import { ItemModule } from './item/item.module';
import { VariantModule } from './variant/variant.module';
import { OfferModule } from './offer/offer.module';
import { OndcSearchModule } from './ondc-search/ondc-search.module';
import { CatalogSyncModule } from './catalog-sync/catalog-sync.module';
import { BuyerModule } from './buyer/buyer.module';
import { OtpModule } from './otp/otp.module';
import 'dotenv/config';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),

    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('MAILER_HOST'),
          port: configService.get<number>('MAILER_PORT'),
          secure: true,
          auth: {
            user: configService.get<string>('MAILER_USER'),
            pass: configService.get<string>('MAILER_PASS'),
          },
        },
        defaults: {
          from: `"No Reply" <${configService.get<string>('MAILER_FROM')}>`,
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [join(__dirname, '**/*.entity{.ts,.js}')],
        synchronize: false,
        logging: configService.get<boolean>('DB_LOGGING'),
      }),
    }),
    UserModule,
    AuthenticationModule,
    CategoryModule,
    DishModule,
    StoreModule,
    ItemModule,
    VariantModule,
    OfferModule,
    OndcSearchModule,
    CatalogIngestionModule,
    CatalogSyncModule,
    BuyerModule,
    OtpModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
