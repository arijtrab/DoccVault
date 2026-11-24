# DocVault access and encryption model

## Phase 0 decisions

- DocVault is a team workspace. A user's `team_id` scopes manager access; existing departments are migrated into teams so the current database is preserved.
- Global roles are `admin`, `manager`, and `user`.
- Document roles are `owner`, `editor`, `reviewer`, and `viewer`. The owner is derived from `documents.owner_id`; the other three are explicit `share_permissions` entries.
- An admin can inspect workspace metadata and the complete audit log, manage accounts and teams, and permanently delete documents from Trash. Global admin access alone does not grant access to document contents or downloads. An explicit document permission still applies.
- A manager has metadata access to documents in their team and reader access to team content. A manager can designate reviewers for documents in that team and see its audit events. Managers cannot manage users or create external links on other people's documents.
- A user can access documents they own or that are explicitly shared with them.
- Team membership is assigned by a workspace admin or team manager. Managers create teams, add active users, and grant viewer or editor access per member. A member's request to share an owned document with the team stays pending until a manager approves or rejects it; approval grants the selected role to the other current team members, and managers can revoke access per member.
- A viewer may download `Public` and `Internal` documents. `Confidential` and `Restricted` documents require owner, editor, or reviewer access to download.
- Uploads by a manager or administrator are approved and sealed at creation. Uploads by users in a managed team enter `pending_review`; the manager designates a reviewer other than the owner. The reviewer can reject the document or approve the review, which moves it to `pending_manager_seal`. Only that team’s manager or an administrator can then seal it as `approved` or reject it. Approval by the reviewer alone never seals or certifies the document.
- Owners move documents to Trash and restore them. Only admins can permanently delete a document.
- Comments are available to people who can read document contents.
- 2FA is intentionally out of scope and the interface reports it as not configured.

## Server-side encryption

Each new file is encrypted with AES-256-GCM using a fresh random 256-bit document key and 96-bit IV. The document key is wrapped with the active 256-bit master key. Ciphertext, authentication tags, wrapped key, IVs, and key version are stored in SQLite. The server refuses to start if `DOCVAULT_MASTER_KEY` is missing or is not 64 hexadecimal characters.

Generate a local development key with:

```sh
openssl rand -hex 32
```

Put the value in an ignored `.env` file or inject it through the deployment's secret manager. In production, the deployment secret should be sourced from the organization's KMS. Never put a real key in source control or client-side code.

Set `DOCVAULT_MASTER_KEY_VERSION` to the active key version. During rotation, retain previous key versions in `DOCVAULT_MASTER_KEYRING` until the rewrap command completes. To migrate v1 blobs, set `DOCVAULT_ENCRYPTION_KEY` to the legacy key and run:

```sh
npm run migrate:encryption
```

The migration processes blobs individually and can be rerun; already migrated blobs are skipped. Back up both the database and its required keys before migration or rotation. Losing every master-key version makes the corresponding encrypted files unrecoverable.

## Operational limits

- This repository provides a master-key injection interface, not a cloud-provider KMS SDK client. The deployment must fetch/inject the secret from its KMS. Direct KMS calls and IAM policy setup depend on the selected provider.
- The upload request still buffers a file in the browser and server; streaming transfer and encryption are follow-up work for larger team deployments.
- Password reset delivery requires `DOCVAULT_PASSWORD_RESET_WEBHOOK` (and optionally `DOCVAULT_PASSWORD_RESET_WEBHOOK_TOKEN`). Without it, the endpoint returns a configuration error and does not disclose or return reset tokens.
