import { Inject, Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { APP_CONFIG, type AppConfig } from "../../../config/index.js";

@Injectable()
export class PasswordService {
  private readonly dummyHash: string;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    // A valid bcrypt hash keeps the unknown-email path comparable without
    // storing or logging a production credential.
    this.dummyHash = bcrypt.hashSync("CloudPilot dummy credential", 10);
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.passwordBcryptRounds);
  }

  verify(password: string, hash: string | undefined): Promise<boolean> {
    return bcrypt.compare(password, hash ?? this.dummyHash);
  }
}
