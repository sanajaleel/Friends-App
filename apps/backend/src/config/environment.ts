try {
  require('dotenv').config();
} catch (e) {}

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'friends-app-super-secret-jwt-key-32chars-min!',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // Database & Cache
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/friends_app?schema=public',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // SMS OTP Configuration
  SMS_PROVIDER: (process.env.SMS_PROVIDER || 'MOCK') as 'MOCK' | 'TWILIO',
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',

  // WebRTC STUN/TURN Configuration
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    ...(process.env.TURN_SERVER_URL ? [{
      urls: process.env.TURN_SERVER_URL,
      username: process.env.TURN_USERNAME || '',
      credential: process.env.TURN_PASSWORD || ''
    }] : [])
  ]
};
