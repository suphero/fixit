# Claude Code Guidelines for Smart Forecast

This document provides guidelines for using Claude Code effectively with the Smart Forecast Shopify app.

## Project Overview

Smart Forecast is a Shopify app built with Remix that provides product recommendations and impact tracking for merchants. The app helps merchants make data-driven decisions about their inventory and product offerings.

## Tech Stack

- **Framework**: [Remix](https://remix.run) v2.7.1
- **Runtime**: Node.js v18.20+ / v20.10+ / v21.0.0+
- **Language**: TypeScript 5.2.2
- **Database**: Prisma ORM with SQLite (production should use PostgreSQL/MySQL)
- **Shopify Integration**:
  - `@shopify/shopify-app-remix` v3.4.0
  - `@shopify/app-bridge-react` v4.1.6
  - `@shopify/polaris` v12.0.0
- **UI**: Polaris design system
- **Message Queue**: RabbitMQ (amqplib)

## Project Structure

```
smart-forecast/
├── app/
│   ├── routes/              # Remix routes (file-based routing)
│   ├── models/              # Data models and business logic
│   │   ├── *.server.ts      # Server-side only code
│   │   └── *.business.server.ts # Business logic layer
│   ├── utils/               # Utility functions
│   ├── constants/           # App constants and configuration
│   ├── shopify.server.ts    # Shopify app configuration
│   └── mq.server.ts         # Message queue setup
├── prisma/
│   └── schema.prisma        # Database schema
├── extensions/              # Shopify app extensions
├── scripts/                 # Build and deployment scripts
└── shopify.app.*.toml       # Shopify app configuration files
```

## Key Conventions

### File Naming

- `*.server.ts` - Server-side only code (never bundled for client)
- `*.business.server.ts` - Business logic layer
- Routes follow Remix file-based routing conventions

### Authentication & API Access

Always use the `shopify.authenticate.admin(request)` pattern:

```typescript
export async function loader({ request }) {
  const { admin } = await shopify.authenticate.admin(request);
  // Use admin.graphql() or admin.rest for API calls
}
```

### Navigation in Embedded Apps

- Use `Link` from `@remix-run/react` or `@shopify/polaris` (never `<a>`)
- Use `redirect` from `authenticate.admin` (not from `@remix-run/node`)
- Use `useSubmit` or `<Form/>` from `@remix-run/react` (never lowercase `<form/>`)

## Common Tasks

### Reading Code

Before making any changes:
1. Read the relevant files completely
2. Understand existing patterns and conventions
3. Check related business logic in `*.business.server.ts` files
4. Review the database schema in `prisma/schema.prisma`

### Making Changes

1. **Keep it simple**: Don't over-engineer or add unnecessary features
2. **Follow existing patterns**: Match the style and structure of existing code
3. **Server vs Client**: Be careful about what runs where (use `.server.ts` appropriately)
4. **Security**: Watch for SQL injection, XSS, command injection, etc.

### Database Changes

When modifying the database:
1. Update `prisma/schema.prisma`
2. Run `npm run setup` (generates Prisma client and pushes schema)
3. Never use `prisma migrate` for MongoDB

### Working with Shopify APIs

- GraphQL queries should use proper typing
- Check `.graphqlrc.ts` for GraphQL configuration
- Use `admin.graphql()` for Admin API queries
- Respect rate limits and handle errors gracefully

### Webhooks

- App-specific webhooks are defined in `shopify.app.toml`
- Shop-specific webhooks can be registered in `afterAuth` hook
- Run `npm run deploy` to update webhook subscriptions
- Test webhooks with: `shopify app webhook trigger`

## Development Workflow

### Starting Development

```bash
npm run dev
# Press 'P' to open the app URL
```

### Environment Variables

Check `.env` and `.env.dev` files for required configuration. Common variables:
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- Database connection strings
- RabbitMQ connection details

### Testing Changes

1. Test in the embedded app context (default)
2. Verify navigation works correctly (no iframe breaking)
3. Check for console errors in browser dev tools
4. Test with actual Shopify data when possible

### Building for Production

```bash
npm run build
npm run start
```

## When Using Claude Code

### DO:

- Read files before suggesting changes
- Use the TodoWrite tool to plan multi-step tasks
- Ask questions when requirements are unclear
- Follow the existing code style and patterns
- Test changes in the development environment
- Check for security vulnerabilities
- Use specialized file tools (Read, Edit, Write) instead of bash commands

### DON'T:

- Create new files unless absolutely necessary
- Add unnecessary abstractions or "future-proofing"
- Add comments to code you didn't change
- Over-engineer simple solutions
- Use lowercase `<form>` tags in embedded app routes
- Use `<a>` tags for navigation
- Suggest changes without reading the relevant code first
- Add error handling for impossible scenarios

### Common Pitfalls

1. **Embedded App Issues**: Always respect iframe constraints
2. **Session Management**: Use Shopify session handling, not custom solutions
3. **GraphQL Types**: Ensure proper typing for GraphQL responses
4. **Database in Production**: SQLite is development-only; use PostgreSQL/MySQL in production
5. **Scope Changes**: Remember to run `npm run deploy` after changing app scopes

## File System Organization

### Routes (`app/routes/`)
- Follow Remix v2 file-based routing
- Use loaders for GET requests
- Use actions for POST/PUT/DELETE requests
- Authenticate every route that needs Shopify data

### Models (`app/models/`)
- Data access layer and business logic
- Keep database operations separate from route handlers
- Use `*.server.ts` suffix for server-only code

### Utils (`app/utils/`)
- Shared utility functions
- Keep pure functions separate from side effects
- Use `*.server.ts` for server-specific utilities

## Resources

- [Remix Documentation](https://remix.run/docs)
- [Shopify App Remix Docs](https://shopify.dev/docs/api/shopify-app-remix)
- [Polaris Design System](https://polaris.shopify.com/)
- [Shopify GraphQL Admin API](https://shopify.dev/docs/api/admin-graphql)
- [Project README](./README.md)

## Environment-Specific Configuration

- **Development**: `shopify.app.dev.toml`
- **Production**: `shopify.app.prod.toml`
- **Test**: `shopify.app.test.toml`

## Git Workflow

- Main branch: `master`
- Create feature branches for new work
- Follow conventional commit messages
- Use co-authored-by for Claude contributions

## Getting Help

- Check README.md for detailed troubleshooting
- Review Shopify documentation for API-specific issues
- Use `/help` in Claude Code for CLI assistance
- Report Claude Code issues at: https://github.com/anthropics/claude-code/issues
