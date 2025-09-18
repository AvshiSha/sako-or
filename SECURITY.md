# Security Guidelines

This document outlines security best practices for the Sako OR e-commerce platform.

## 🔒 Sensitive Information Protection

### Never Commit These Files

- `.env*` files (environment variables)
- Service account keys (`*-service-account.json`, `google-credentials.json`, `firebase-adminsdk-*.json`)
- Internal documentation (`*_SETUP.md`, `*_DEBUG.md`, `*_TROUBLESHOOTING.md`, etc.)
- Database files (`*.db`, `*.sqlite`)
- Debug logs (`*.log`, `pglite-debug.log`)

### Environment Variables

All sensitive configuration should be stored in environment variables:

**Local Development:**

- Create `.env.local` (already in .gitignore)
- Never commit this file

**Production:**

- Use Vercel environment variables
- Use Firebase environment configuration
- Never hardcode secrets in code

### Required Environment Variables

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Google OAuth (if using)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=your_redirect_uri

# Database
DATABASE_URL=your_database_url

# Authentication
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=your_url
```

## 🛡️ Security Measures

### Pre-commit Hooks

We have pre-commit hooks that automatically check for:

- Sensitive files being staged
- Potential secrets in code
- Large files (>10MB)

### GitHub Workflows

Our CI/CD pipeline includes:

- Automated security scanning
- File type validation
- Secret detection
- .gitignore verification

### Code Review Guidelines

Before merging any PR:

1. Verify no sensitive files are included
2. Check for hardcoded secrets
3. Ensure proper environment variable usage
4. Review file permissions

## 🚨 Incident Response

If sensitive information is accidentally committed:

1. **Immediately** remove the file from git history
2. Rotate any exposed credentials
3. Notify the team
4. Update security measures if needed

### Removing Sensitive Files from History

```bash
# Remove file from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/sensitive/file" \
  --prune-empty --tag-name-filter cat -- --all

# Force push to update remote
git push origin --force --all
```

## 📋 Security Checklist

Before each commit:

- [ ] No .env files staged
- [ ] No service account keys staged
- [ ] No internal documentation staged
- [ ] No hardcoded secrets in code
- [ ] All sensitive data uses environment variables
- [ ] Large files are properly handled

## 🔍 Monitoring

- Regular security audits
- Automated scanning in CI/CD
- Team training on security practices
- Regular credential rotation

## 📞 Contact

For security concerns or questions, contact the development team immediately.

---

**Remember: Security is everyone's responsibility!**
