import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface DecodedUser {
  uid: string;
  email?: string;
}

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private initialized = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    if (admin.apps.length > 0) {
      this.initialized = true;
      return;
    }

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    let privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');
    const serviceAccountJson = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');

    if (serviceAccountJson) {
      try {
        const parsed = JSON.parse(serviceAccountJson);
        admin.initializeApp({
          credential: admin.credential.cert(parsed),
        });
        this.initialized = true;
        this.logger.log('Firebase Admin SDK initialized from service account JSON.');
        return;
      } catch (err: unknown) {
        this.logger.error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: ${(err as Error).message}`);
      }
    }

    if (projectId && clientEmail && privateKey) {
      // Replace escaped newlines if passed in via single-line env var
      privateKey = privateKey.replace(/\\n/g, '\n');
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        this.initialized = true;
        this.logger.log(`Firebase Admin SDK initialized for project "${projectId}".`);
        return;
      } catch (err: unknown) {
        this.logger.error(`Failed to initialize Firebase Admin SDK: ${(err as Error).message}`);
      }
    }

    this.logger.warn('Firebase credentials not provided. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env');
  }

  async verifyIdToken(token: string): Promise<DecodedUser> {
    if (!this.initialized) {
      throw new Error('Firebase is not configured on this server');
    }

    const decoded = await admin.auth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
    };
  }
}
