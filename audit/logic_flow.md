# Edge Functions & Logic Flow

| Function Name | Trigger (Inferred) | External APIs |
|---------------|-------------------|---------------|
| activity-curator-ai | HTTP Request | https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash |
| auth-hook | HTTP Request | None |
| community-moderator-ai | HTTP Request | None |
| gemma-help-assistant | HTTP Request | https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction, https://router.huggingface.co/v1/chat/completions |
| generate-embedding | HTTP Request | https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction |
| image-optimizer | HTTP Request | None |
| push-notifications | DB Webhook | https://exp.host/--/api/v2/push/send |
