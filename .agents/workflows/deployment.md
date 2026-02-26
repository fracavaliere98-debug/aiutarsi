---
description: how to deploy the application with safety checks
---

# Deployment Workflow

Follow these steps to safely test and deploy the AiutarSì application.

## 1. Quality & Regression Checks
Before any build, ensure all business logic and connectivity are working.

// turbo
```powershell
npm run test:regression
```

## 2. Local Visual Verification
Start the development server to check the UI and final touches.

```powershell
npx expo start
```

## 3. Production Build (EAS)
Trigger a production build on the Expo servers.

```powershell
eas build --profile production
```

## 4. Over-the-Air Update (Optional)
If you only changed Javascript/Assets (no native changes), you can push an update without a new build.

```powershell
eas update --branch production --message "Quick fix"
```

> [!IMPORTANT]
> Always ensure your `.env` file contains the correct production Supabase credentials before building.
