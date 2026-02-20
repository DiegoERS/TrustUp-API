import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

const BANNER = `
████████╗██████╗ ██╗   ██╗███████╗████████╗    ██╗   ██╗██████╗ 
╚══██╔══╝██╔══██╗██║   ██║██╔════╝╚══██╔══╝    ██║   ██║██╔══██╗
   ██║   ██████╔╝██║   ██║███████╗   ██║       ██║   ██║██████╔╝
   ██║   ██╔══██╗██║   ██║╚════██║   ██║       ██║   ██║██╔═══╝ 
   ██║   ██║  ██║╚██████╔╝███████║   ██║       ╚██████╔╝██║     
   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝        ╚═════╝ ╚═╝       
      
    ------  𝔹𝕦𝕪 𝕟𝕠𝕨 𝕡𝕒𝕪 𝕝𝕒𝕥𝕖𝕣  𝕨𝕚𝕥𝕙𝕠𝕦𝕥 𝕓𝕒𝕟𝕜𝕤 ------  𝔹
  
`;

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const port = process.env.PORT || 4000;
  const apiPrefix = process.env.API_PREFIX || 'api/v1';

  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port, '0.0.0.0');

  console.log(BANNER);
  console.log(`🚀 Server is running on: http://localhost:${port}/${apiPrefix}`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}\n`);
}

bootstrap();

