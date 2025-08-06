# Documentation Index

This directory contains comprehensive documentation for the Portfolio Projects application.

## 📚 Core Documentation

### [AI Configuration Guide](ai-configuration-guide.md)
Complete guide for setting up and configuring AI features including:
- API key setup for OpenAI and Anthropic
- Model configuration and selection
- Environment variable management
- Security best practices

### [AI Troubleshooting Guide](ai-troubleshooting.md)
Comprehensive troubleshooting reference covering:
- Environment configuration issues
- Connection testing problems
- Model configuration errors
- Content editing issues
- Performance optimization

### [AI Deployment Guide](ai-deployment-guide.md)
Platform-specific deployment instructions for:
- Vercel (recommended)
- Netlify
- Railway
- Heroku
- DigitalOcean
- AWS (Amplify/Elastic Beanstalk)
- Google Cloud Platform

### [AI Migration Guide](ai-migration-guide.md)
Step-by-step migration from previous AI architecture:
- Exporting existing configuration
- Setting up environment variables
- Database migration steps
- Testing and validation

### [API Documentation](api-documentation.md)
Complete API reference including:
- AI endpoints for content editing
- Environment status and testing
- Model configuration management
- Authentication and error handling

## 🚀 Quick Start

### For New Users
1. Read [AI Configuration Guide](ai-configuration-guide.md)
2. Follow platform-specific setup in [AI Deployment Guide](ai-deployment-guide.md)
3. Reference [API Documentation](api-documentation.md) for integration

### For Existing Users
1. Follow [AI Migration Guide](ai-migration-guide.md)
2. Use [AI Troubleshooting Guide](ai-troubleshooting.md) for issues
3. Check [AI Deployment Guide](ai-deployment-guide.md) for production setup

## 🔧 Common Tasks

### Setting Up AI Features
```bash
# 1. Add API keys to environment
echo "OPENAI_API_KEY=sk-proj-your-key" >> .env.local
echo "ANTHROPIC_API_KEY=sk-ant-api03-your-key" >> .env.local

# 2. Restart development server
npm run dev

# 3. Configure models at /admin/ai-settings
```

### Troubleshooting Connection Issues
1. Check [AI Troubleshooting Guide](ai-troubleshooting.md#connection-testing-issues)
2. Verify API keys in provider dashboards
3. Test connections in `/admin/ai-settings`

### Deploying with AI Features
1. Choose platform from [AI Deployment Guide](ai-deployment-guide.md)
2. Set environment variables in hosting platform
3. Deploy and test AI functionality

## 📖 Documentation Structure

```
docs/
├── README.md                    # This index file
├── ai-configuration-guide.md   # Setup and configuration
├── ai-troubleshooting.md       # Problem solving
├── ai-deployment-guide.md      # Platform deployment
├── ai-migration-guide.md       # Version migration
└── api-documentation.md        # API reference
```

## 🆘 Getting Help

### Step-by-Step Troubleshooting
1. **Check Environment**: Verify API keys are set correctly
2. **Test Connections**: Use test buttons in AI settings
3. **Review Logs**: Check browser console and server logs
4. **Consult Guides**: Use specific troubleshooting sections
5. **Verify Configuration**: Ensure models are configured properly

### Common Issues Quick Reference

| Issue | Solution | Documentation |
|-------|----------|---------------|
| API keys not working | Check environment variables | [Configuration Guide](ai-configuration-guide.md#quick-setup) |
| Connection tests failing | Verify API key validity | [Troubleshooting](ai-troubleshooting.md#connection-testing-issues) |
| No models in dropdown | Configure models in settings | [Configuration Guide](ai-configuration-guide.md#model-configuration) |
| AI not working in production | Set environment variables | [Deployment Guide](ai-deployment-guide.md) |
| Migrating from old version | Follow migration steps | [Migration Guide](ai-migration-guide.md) |

### External Resources

- **OpenAI Documentation**: [platform.openai.com/docs](https://platform.openai.com/docs)
- **Anthropic Documentation**: [docs.anthropic.com](https://docs.anthropic.com/)
- **Next.js Environment Variables**: [nextjs.org/docs/basic-features/environment-variables](https://nextjs.org/docs/basic-features/environment-variables)

## 🔄 Documentation Updates

This documentation is maintained alongside the codebase. When updating:

1. **Keep Examples Current**: Update code examples with latest syntax
2. **Test Instructions**: Verify all setup instructions work
3. **Update Screenshots**: Refresh UI screenshots when interface changes
4. **Cross-Reference**: Ensure links between documents work
5. **Version Information**: Update version-specific information

## 📝 Contributing to Documentation

When contributing to documentation:

1. **Follow Structure**: Use existing document structure and formatting
2. **Include Examples**: Provide code examples and screenshots
3. **Test Instructions**: Verify all instructions work before submitting
4. **Update Index**: Add new documents to this index
5. **Cross-Link**: Link related sections between documents

## 🏷️ Document Tags

- **🚀 Setup**: Initial configuration and setup
- **🔧 Troubleshooting**: Problem solving and debugging
- **📚 Reference**: Detailed technical reference
- **🔄 Migration**: Version upgrades and migrations
- **🌐 Deployment**: Production deployment guides

## 📊 Documentation Metrics

- **Coverage**: All AI features documented
- **Accuracy**: Instructions tested on multiple platforms
- **Completeness**: End-to-end workflows covered
- **Accessibility**: Clear language and step-by-step instructions
- **Maintenance**: Regular updates with code changes