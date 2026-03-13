# Edge Functions & Logic Flow

| Function Name | Trigger (Inferred) | External APIs |
|---------------|-------------------|---------------|
| activity-curator-ai | HTTP Request | https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash |
| auth-hook | HTTP Request | None |
| community-moderator-ai | HTTP Request | None |
| generate-embedding | HTTP Request | https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5 |
| image-optimizer | HTTP Request | None |
| push-notifications | DB Webhook | https://exp.host/--/api/v2/push/send |
