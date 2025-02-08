import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsoleLogger, Logger, ValidationPipe } from '@nestjs/common';
import { configureSwaggerDocs } from './helpers/configure-swagger-docs.helper';
import { configureAuthSwaggerDocs } from './helpers/configure-auth-swagger-docs.helper';
import {
  FastifyAdapter,
  NestFastifyApplication
} from '@nestjs/platform-fastify';
import { registerFastifyPlugins } from './common/plugins/register-fastify.plugins';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter();
 
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
    {
      logger: new ConsoleLogger({
        json: true,
        colors: true,
      }),
    },
  );
  const configService = app.get<ConfigService>(ConfigService);

  // Plugins for Fastify
  registerFastifyPlugins(app);
    // Swagger configuration
    const config = new DocumentBuilder()
      .setTitle('API Documentation')
      .setDescription('The API description')
      .setVersion('1.0')
      .addTag('example')
      .build();
  
    const document = SwaggerModule.createDocument(app, config);
  
    // Secure /api-json endpoint
    app.getHttpAdapter().getInstance().route({
      method: 'GET',
      url: '/api-json',
      handler: async (request, reply) => {
        const unauthorizedResponse = () => {
          reply.status(401).header('WWW-Authenticate', 'Basic').send('Unauthorized');
        };
  
        const authHeader = request.headers.authorization;
        if (!authHeader) {
          return unauthorizedResponse();
        }
  
        try {
          const [, encodedPart] = authHeader.split(' ');
          const buff = Buffer.from(encodedPart, 'base64');
          const text = buff.toString('ascii');
          const [user, password] = text.split(':');
  
          // if (
          //   user !== apiDocumentationCredentials.user ||
          //   password !== apiDocumentationCredentials.password
          // ) {
          //   return unauthorizedResponse();
          // }
  
          reply.type('application/json').send(document);
        } catch (error) {
          return unauthorizedResponse();
        }
      },
    });
  
  // Swagger Configurations
  configureAuthSwaggerDocs(app, configService);
  configureSwaggerDocs(app, configService);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
 // app.enableCors();
  const port = configService.get<number>('SERVER_PORT') || 3000;
  await app.listen(port, '0.0.0.0');
  if (configService.get<string>('NODE_ENV') !== 'production') {
    Logger.debug(
      `${await app.getUrl()} - Environment: ${configService.get<string>(
        'NODE_ENV',
      )}`,
      'Environment',
    );

    Logger.debug(`Url for OpenApi: ${await app.getUrl()}/docs`, 'Swagger');
  }
}
bootstrap();
