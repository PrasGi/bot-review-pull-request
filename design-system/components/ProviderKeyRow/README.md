ProviderKeyRow is one AI provider's API key setting: name, Configured / Not set badge, a password field and Save key.

## When to use
Settings → Provider keys (GLM, Kimi, OpenAI, Anthropic).

## What you provide
`provider`, `label`, `isSet`, `saving`, `onSave(value)` (clears the field after).

## Notes
Never echo a saved key back.

Hand-written brutalist rebuild of `app/(dashboard)/settings/page.tsx`.
