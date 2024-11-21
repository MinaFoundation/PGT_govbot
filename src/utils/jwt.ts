import * as jose from 'jose';
import { ButtonInteraction } from 'discord.js';

/**
 * Interface for generating and verifying JWT tokens for authentication with MEF Web App.
 */
export class AuthTokenGenerator {
  private privateKey: jose.KeyLike | null = null;
  private publicKey: jose.KeyLike | null = null;

  constructor(
    private readonly clientId: string,
    private readonly baseUrl: string,
    private readonly privateKeyStr: string,
    private readonly publicKeyStr: string,
  ) {}

  async initialize() {
    if (!this.privateKey || !this.publicKey) {
      this.privateKey = await jose.importPKCS8(this.privateKeyStr, 'RS512');
      this.publicKey = await jose.importSPKI(this.publicKeyStr, 'RS512');
    }
  }

  async generateLoginUrl(interaction: ButtonInteraction): Promise<string> {
    await this.initialize();

    if (!this.privateKey) {
      throw new Error('Token generator not initialized');
    }

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 30; // 30 seconds expiration

    const authSource = {
      type: 'discord' as const,
      id: interaction.user.id,
      username: interaction.user.username,
    };

    const jwt = await new jose.SignJWT({
      authSource,
      iss: 'initial',
      sub: authSource.id,
      jti: crypto.randomUUID(),
    })
      .setProtectedHeader({ alg: 'RS512' })
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .sign(this.privateKey);

    return `${this.baseUrl}/auth?token=${jwt}`;
  }

  async verifyToken(token: string) {
    await this.initialize();

    if (!this.publicKey) {
      throw new Error('Token generator not initialized');
    }

    try {
      const { payload } = await jose.jwtVerify(token, this.publicKey, {
        algorithms: ['RS512'],
      });
      return payload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}
