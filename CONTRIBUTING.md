# Contributing to ResumeAI

Thank you for your interest in contributing!

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/Micro-SaaS-Starter-Kit.git`
3. Install dependencies: `npm install`
4. Set up your `.env` file (copy from `.env.example`)
5. Run the development server: `npm run dev`

## Pull Request Process

1. Create a new branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Test your changes thoroughly
4. Commit with clear messages: `git commit -m "Add feature: description"`
5. Push to your fork: `git push origin feature/your-feature-name`
6. Open a Pull Request

## Code Style

- Use TypeScript for all new files
- Follow the existing code style (ESLint configuration)
- Write meaningful commit messages
- Add comments for complex logic
- Update documentation when needed

## Testing

Before submitting a PR:

1. Test all authentication flows
2. Test Stripe integration (use test mode)
3. Ensure the build passes: `npm run build`
4. Run the linter: `npm run lint`

## Areas for Contribution

- Additional OAuth providers
- More UI components
- Better error handling
- Performance optimizations
- Documentation improvements
- Bug fixes

## Questions?

Open an issue for any questions or concerns!
