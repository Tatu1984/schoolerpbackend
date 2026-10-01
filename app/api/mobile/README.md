# Mobile API Endpoints

This directory contains REST API endpoints specifically designed for mobile app integration.

## Authentication

### POST /api/mobile/auth/login
Login with email and password
```json
{
  "email": "user@school.com",
  "password": "password123"
}
```

### POST /api/mobile/auth/register
Register new parent/student account

## Student APIs

### GET /api/mobile/students/:id
Get student profile and details

### GET /api/mobile/students/:id/attendance
Get student attendance history

### GET /api/mobile/students/:id/grades
Get student grades and report cards

### GET /api/mobile/students/:id/assignments
Get pending and completed assignments

### GET /api/mobile/students/:id/timetable
Get class schedule/timetable

## Parent APIs

### GET /api/mobile/parents/:id/children
Get list of children under parent account

### GET /api/mobile/parents/:id/notifications
Get notifications and announcements

### POST /api/mobile/parents/:id/leave-request
Submit leave request for child

## Fee Management

### GET /api/mobile/fees/:studentId
Get fee structure and payment history

### POST /api/mobile/fees/pay
Process fee payment

### GET /api/mobile/fees/:studentId/receipts
Download fee receipts

## Canteen & Wallet

### GET /api/mobile/wallet/:studentId
Get wallet balance and transaction history

### POST /api/mobile/wallet/recharge
Recharge wallet balance

### GET /api/mobile/canteen/menu
Get available canteen menu items

### POST /api/mobile/canteen/order
Place canteen order

### GET /api/mobile/canteen/orders/:studentId
Get order history

## Transport

### GET /api/mobile/transport/routes
Get available transport routes

### GET /api/mobile/transport/:vehicleId/tracking
Get real-time vehicle location

### GET /api/mobile/transport/:studentId/route
Get student's assigned route details

## Communication

### GET /api/mobile/announcements
Get school announcements

### GET /api/mobile/messages/:userId
Get messages and conversations

### POST /api/mobile/messages/send
Send message to teacher/admin

## Marketplace

### GET /api/mobile/marketplace/products
Browse marketplace products

### POST /api/mobile/marketplace/orders
Place product order

### GET /api/mobile/marketplace/orders/:studentId
Get order history

## Features

- JWT-based authentication
- Rate limiting and security
- Push notifications support
- Offline data sync capabilities
- Real-time updates via WebSocket
- File upload support for documents
- Image compression for photos

## Response Format

All APIs return JSON in the following format:

```json
{
  "success": true,
  "data": {},
  "message": "Success message",
  "timestamp": "2025-12-04T10:30:00Z"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-12-04T10:30:00Z"
}
```

## Status Codes

- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

## Rate Limiting

- 100 requests per minute per user
- 1000 requests per hour per user

## Authentication Headers

```
Authorization: Bearer {jwt_token}
X-API-Key: {api_key}
X-Device-ID: {device_id}
X-App-Version: {version}
```

## Push Notifications

Supports Firebase Cloud Messaging (FCM) and Apple Push Notification Service (APNS) for:
- Fee reminders
- Assignment deadlines
- Attendance alerts
- Exam schedules
- Transport updates
- Announcements

## Offline Sync

Mobile app can cache data locally and sync when connection is restored:
- Attendance records
- Timetable
- Assignments
- Notifications
- Fee history
