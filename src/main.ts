import { NestFactory, Reflector } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { AllExceptionsFilter } from "./shared/http-exception.filter";
import { ResponseInterceptor } from "./shared/response.interceptor";
import { LoggingInterceptor } from "./shared/logging.interceptor";
import { SafeClassSerializerInterceptor } from "./shared/safe-class-serializer.interceptor";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

  // Global interceptors and pipes
  // Logging interceptor should be first to log all requests
  app.useGlobalInterceptors(new LoggingInterceptor(configService));
  // Use SafeClassSerializerInterceptor to handle @Res() responses safely
  app.useGlobalInterceptors(new SafeClassSerializerInterceptor(reflector));
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
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  });

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle("ONDC Buyer API")
    .setDescription(
      "Comprehensive F&B Buyer Application API with ONDC Integration",
    )
    .setVersion("1.0.0")
    .addTag("Health Check", "Service health monitoring endpoints")
    .addTag("Buyer App APIs", "Core buyer application endpoints (requires authentication)")
    .addTag("Public Notifications", "Public notification endpoints (no authentication required)")
    .addTag("Authentication", "User authentication and authorization")
    .addTag("User Management", "User profile and address management")
    .addTag(
      "Dish Management",
      "Dish CRUD operations with file upload support (jpg, png, webp)",
    )
    .addTag("Category Management", "Category CRUD operations")
    .addTag(
      "Banner Management",
      "Promotional banner CRUD operations with image upload support (jpg, png, webp)",
    )
    .addTag("Favorites", "User favorites management for items and restaurants")
    .addTag("ONDC Search", "ONDC network search and catalog webhook endpoints")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "Authorization",
        description:
          "Enter JWT token (e.g., Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)",
        in: "header",
      },
      "JWT-auth",
    )
    .addApiKey(
      {
        type: "apiKey",
        name: "x-api-key",
        in: "header",
        description: "Admin API Key (super-admin / admin)",
      },
      "x-api-key",
    )
    .addServer("http://localhost:3008", "Development server")
    .addServer("https://devapi.tazty.in", "Staging server")
    .addServer("https://api.tazty.in", "Production server")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
      docExpansion: "none",
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
    },
    customSiteTitle: "ONDC Buyer API Documentation",
    customfavIcon: "/favicon.ico",
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #3b82f6; }
      .swagger-ui .auth-container { margin: 20px 0; }
      .swagger-ui .auth-btn-wrapper { margin: 10px 0; }
    `,
  });

  const port = process.env.PORT ?? 3008;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api`);
}

bootstrap();
