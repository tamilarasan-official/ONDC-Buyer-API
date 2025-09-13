import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './shared/http-exception.filter';
import { ResponseInterceptor } from './shared/response.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Global interceptors and pipes
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS configuration
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('ONDC Buyer API')
    .setDescription('Comprehensive F&B Buyer Application API with ONDC Integration')
    .setVersion('1.0.0')
    .addTag('Buyer App APIs', 'Core buyer application endpoints')
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('User Management', 'User profile and address management')
    .addTag('Dish Management', 'Dish CRUD operations')
    .addTag('Category Management', 'Category CRUD operations')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token (e.g., Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)',
        in: 'header',
      },
      'JWT-auth',
    )
    .addServer('http://localhost:3002', 'Development server')
    .addServer('https://devapi.tazty.in', 'Production server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
    },
    customSiteTitle: 'ONDC Buyer API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #3b82f6; }
      .swagger-ui .auth-container { margin: 20px 0; }
      .swagger-ui .auth-btn-wrapper { margin: 10px 0; }
    `,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api`);
}

bootstrap();