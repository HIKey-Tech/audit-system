export declare const config: {
    readonly app: {
        readonly name: string;
        readonly url: string;
        readonly port: number;
        readonly env: string;
        readonly apiVersion: string;
        readonly isDev: boolean;
        readonly isProd: boolean;
        readonly frontendUrl: string;
    };
    readonly passwordReset: {
        readonly tokenTtl: string;
    };
    readonly mfa: {
        readonly mandatory: boolean;
        readonly gracePeriodDays: number;
        readonly issuer: string;
        readonly challengeTtl: string;
        readonly enrollTtl: string;
        readonly emailOtpTtl: string;
        readonly emailOtpMaxAttempts: number;
        readonly backupCodeCount: number;
        readonly encryptionKey: string;
    };
    readonly database: {
        readonly url: string;
    };
    readonly jwt: {
        readonly secret: string;
        readonly expiresIn: string;
        readonly refreshSecret: string;
        readonly refreshExpiresIn: string;
    };
    readonly oidc: {
        readonly provider: "azure_ad" | "generic";
        readonly azureAd: {
            readonly tenantId: string;
            readonly clientId: string;
            readonly clientSecret: string;
            readonly redirectUri: string;
            readonly logoutUri: string;
            readonly authority: `https://login.microsoftonline.com/${string}`;
        };
        readonly generic: {
            readonly issuerUrl: string;
            readonly clientId: string;
            readonly clientSecret: string;
            readonly redirectUri: string;
            readonly scopes: string[];
        };
    };
    readonly redis: {
        readonly url: string;
        readonly password: string;
        readonly ttl: number;
    };
    readonly email: {
        readonly host: string;
        readonly port: number;
        readonly secure: boolean;
        readonly user: string;
        readonly password: string;
        readonly from: string;
    };
    readonly storage: {
        readonly provider: "local" | "azure_blob" | "aws_s3";
        readonly localPath: string;
        readonly azure: {
            readonly connectionString: string;
            readonly container: string;
        };
        readonly aws: {
            readonly region: string;
            readonly bucket: string;
            readonly prefix: string;
            readonly signedUrlTtlSeconds: number;
            readonly forcePathStyle: boolean;
        };
    };
    readonly rateLimit: {
        readonly windowMs: number;
        readonly max: number;
    };
    readonly logging: {
        readonly level: string;
        readonly format: string;
    };
    readonly dataWarehouse: {
        readonly url: string;
        readonly apiKey: string;
    };
};
export type AppConfig = typeof config;
//# sourceMappingURL=app.config.d.ts.map