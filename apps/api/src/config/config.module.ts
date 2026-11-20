import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validate } from "./env.validation.js";
import { APP_CONFIG, appConfigProvider } from "./app.config.js";

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      validate,
      expandVariables: false,
    }),
  ],
  providers: [appConfigProvider],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
