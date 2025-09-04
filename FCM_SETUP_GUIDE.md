# 🔥 FCM Integration Setup Guide

## Environment Variables Required

Add these environment variables to your `.env` file:

```env
# Firebase Cloud Messaging Configuration
FCM_PROJECT_ID=your-project-id
FCM_PRIVATE_KEY_ID=your-private-key-id
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FCM_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FCM_CLIENT_ID=your-client-id
FCM_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com
```

## How to Get FCM Credentials

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing project
3. Enable Cloud Messaging in the project

### 2. Generate Service Account Key
1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Extract the following values from the JSON:
   - `project_id` → `FCM_PROJECT_ID`
   - `private_key_id` → `FCM_PRIVATE_KEY_ID`
   - `private_key` → `FCM_PRIVATE_KEY`
   - `client_email` → `FCM_CLIENT_EMAIL`
   - `client_id` → `FCM_CLIENT_ID`
   - `client_x509_cert_url` → `FCM_CLIENT_X509_CERT_URL`

### 3. Configure Mobile App
1. Add Firebase to your mobile app (Android/iOS)
2. Download `google-services.json` (Android) or `GoogleService-Info.plist` (iOS)
3. Configure FCM in your mobile app
4. Get FCM token from mobile app and register it via API

## API Endpoints for FCM

### Register Device Token
```bash
POST /api/buyer/push-tokens
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "device_token": "fcm_token_here_123456789",
  "platform": "android"
}
```

### Test Push Notification
```bash
POST /api/buyer/test-push-notification
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "message": "Test notification message"
}
```

### Get Notifications
```bash
GET /api/buyer/notifications?page=1&limit=20
Authorization: Bearer <jwt_token>
```

## Automatic Notifications

The system automatically sends push notifications for:

1. **OTP Generation** - When user requests OTP for login
2. **Order Creation** - When order is placed
3. **Order Status Updates** - When order status changes
4. **Payment Success** - When payment is completed
5. **Payment Failure** - When payment fails
6. **Review Reminders** - After order delivery

## Notification Types

- `order` - Order-related notifications
- `promotion` - Promotional offers
- `system` - System notifications (OTP, maintenance)
- `review` - Review reminders

## Features Implemented

✅ **FCM Service** - Complete Firebase Cloud Messaging integration
✅ **Device Token Management** - Register/unregister device tokens
✅ **Multi-platform Support** - Android, iOS, Web
✅ **Batch Notifications** - Send to multiple devices efficiently
✅ **Token Validation** - Validate tokens before sending
✅ **Error Handling** - Comprehensive error handling and logging
✅ **User Preferences** - Respect user notification preferences
✅ **Automatic Cleanup** - Remove invalid tokens automatically
✅ **Rich Notifications** - Support for images, sounds, badges
✅ **Collapse Keys** - Prevent notification spam
✅ **TTL Support** - Set notification expiration

## Testing

1. Start the application
2. Register a device token via API
3. Send test notification via API
4. Check mobile device for push notification

## Troubleshooting

### Common Issues

1. **Firebase initialization failed**
   - Check environment variables
   - Verify service account key format
   - Ensure private key has proper line breaks

2. **Token validation failed**
   - Check if token is valid FCM token
   - Verify mobile app FCM configuration
   - Check network connectivity

3. **Notifications not received**
   - Check user notification preferences
   - Verify device token is active
   - Check FCM service status

### Logs

Check application logs for detailed error messages:
- FCM service initialization
- Token validation results
- Notification delivery status
- Error details and stack traces
