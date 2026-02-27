---
description: Deploy Over-The-Air (OTA) updates to all devices instantly
---

# EAS Update Workflow

This workflow should be used whenever code changes need to be pushed instantly to devices without going through a full app store review process.

1.  Make sure you have modified the code via Antigravity or the IDE.
2.  Save and commit the changes using Git:
    ```bash
    git add .
    git commit -m "[Your descriptive commit message]"
    ```
3.  Execute the EAS Update command to push the changes to all devices on the preview branch:
    ```bash
    eas update --branch preview --platform all
    ```
