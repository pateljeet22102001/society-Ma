# Database backup and restoration

The `Supabase Daily Backup` GitHub Actions workflow runs daily at approximately midnight IST and can also be started manually. It creates a logical backup, restores it into an isolated temporary PostgreSQL database, verifies the application's important tables, encrypts the verified backup, and retains the encrypted artifact for 30 days.

The restoration test never writes to the production Supabase database.

## Required GitHub secrets

In **GitHub repository → Settings → Secrets and variables → Actions**, add:

- `SUPABASE_DB_URL`: the Supabase **Session pooler** connection string from **Supabase → Connect**. The password in the URL must be URL-encoded.
- `BACKUP_ENCRYPTION_PASSWORD`: a unique, randomly generated password of at least 32 characters. Store a second copy in a secure password manager. Losing it makes the encrypted backups unrecoverable.

Never add either value to source code, workflow files, issues, screenshots, or repository commits.

## Run and verify

1. Open **GitHub → Actions → Supabase Daily Backup**.
2. Select **Run workflow**.
3. Confirm every step is green, especially **Test restoration**.
4. Download the encrypted artifact from the completed workflow run and keep an occasional copy outside GitHub.

## Decrypting a downloaded backup

Run this locally, replacing the filename as needed:

```bash
gpg --output supabase-backup.tar.gz --decrypt supabase-YYYY-MM-DDTHH-MM-SSZ.tar.gz.gpg
tar -xzf supabase-backup.tar.gz
```

The archive contains the public application schema and data plus authentication user IDs needed for the isolated integrity test. It intentionally does not contain user passwords, Supabase Storage files, or database connection credentials.

Before a real disaster restoration, create a separate Supabase project and restore there first. Do not test a restore against production.
