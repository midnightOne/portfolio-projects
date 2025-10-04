# OpenAI API Pricing Reference

**Last Updated**: January 2025  
**Source**: OpenAI Platform Pricing Page

## Pricing Overview

All prices are in USD per 1 million tokens unless otherwise specified.

---

## Chat Models (Text Generation)

### Latest Models

| Model | Input | Cached Input | Output | Notes |
|-------|-------|--------------|--------|-------|
| **gpt-5** | $1.25 | $0.125 | $10.00 | Latest flagship model |
| **gpt-5-mini** | $0.25 | $0.025 | $2.00 | Cost-effective alternative |
| **gpt-5-nano** | $0.05 | $0.005 | $0.40 | Ultra-efficient |
| **gpt-4.1** | $2.00 | $0.50 | $8.00 | Enhanced GPT-4 |
| **gpt-4.1-mini** | $0.40 | $0.10 | $1.60 | Mini version |
| **gpt-4.1-nano** | $0.10 | $0.025 | $0.40 | Nano version |
| **gpt-4o** | $2.50 | $1.25 | $10.00 | Multimodal flagship |
| **gpt-4o-mini** | $0.15 | $0.075 | $0.60 | Most cost-effective |

### Reasoning Models

| Model | Input | Cached Input | Output |
|-------|-------|--------------|--------|
| **o1** | $15.00 | $7.50 | $60.00 |
| **o1-pro** | $150.00 | - | $600.00 |
| **o3-pro** | $20.00 | - | $80.00 |
| **o3** | $2.00 | $0.50 | $8.00 |
| **o4-mini** | $1.10 | $0.275 | $4.40 |
| **o3-mini** | $1.10 | $0.55 | $4.40 |
| **o1-mini** | $1.10 | $0.55 | $4.40 |

### Legacy Models

| Model | Input | Output |
|-------|-------|--------|
| **chatgpt-4o-latest** | $5.00 | $15.00 |
| **gpt-4-turbo-2024-04-09** | $10.00 | $30.00 |
| **gpt-4-0613** | $30.00 | $60.00 |
| **gpt-3.5-turbo** | $0.50 | $1.50 |

---

## Embeddings

| Model | Standard Cost | Batch Cost | Dimensions |
|-------|--------------|------------|------------|
| **text-embedding-3-small** | $0.02 | $0.01 | 1536 |
| **text-embedding-3-large** | $0.13 | $0.065 | 3072 |
| **text-embedding-ada-002** | $0.10 | $0.05 | 1536 |

**Note**: Batch API provides 50% discount for non-time-sensitive requests.

---

## Audio & Speech

### Realtime Audio

| Model | Input | Cached Input | Output |
|-------|-------|--------------|--------|
| **gpt-realtime** (text) | $4.00 | $0.40 | $16.00 |
| **gpt-realtime** (audio) | $32.00 | $0.40 | $64.00 |
| **gpt-4o-realtime-preview** (text) | $5.00 | $2.50 | $20.00 |
| **gpt-4o-realtime-preview** (audio) | $40.00 | $2.50 | $80.00 |
| **gpt-4o-mini-realtime-preview** (text) | $0.60 | $0.30 | $2.40 |
| **gpt-4o-mini-realtime-preview** (audio) | $10.00 | $0.30 | $20.00 |

### Text-to-Speech (TTS)

| Model | Cost per 1M Characters |
|-------|------------------------|
| **TTS** | $15.00 |
| **TTS HD** | $30.00 |

### Speech-to-Text

| Model | Cost per Minute |
|-------|----------------|
| **Whisper** | $0.006 |
| **gpt-4o-transcribe** | $0.006 |
| **gpt-4o-mini-transcribe** | $0.003 |

---

## Image Generation

### GPT Image 1

| Quality | 1024×1024 | 1024×1536 | 1536×1024 |
|---------|-----------|-----------|-----------|
| **Low** | $0.011 | $0.016 | $0.016 |
| **Medium** | $0.042 | $0.063 | $0.063 |
| **High** | $0.167 | $0.25 | $0.25 |

### DALL·E 3

| Quality | 1024×1024 | 1024×1792 | 1792×1024 |
|---------|-----------|-----------|-----------|
| **Standard** | $0.04 | $0.08 | $0.08 |
| **HD** | $0.08 | $0.12 | $0.12 |

### DALL·E 2

| Quality | 256×256 | 512×512 | 1024×1024 |
|---------|---------|---------|-----------|
| **Standard** | $0.016 | $0.018 | $0.02 |

---

## Built-in Tools

| Tool | Cost |
|------|------|
| **Code Interpreter** | $0.03 per container |
| **File Search Storage** | $0.10 per GB per day (1GB free) |
| **File Search Tool Call** | $2.50 per 1k calls |
| **Web Search (all models)** | $10.00 per 1k calls + search content tokens |
| **Web Search (reasoning models)** | $10.00 per 1k calls + search content tokens |
| **Web Search (non-reasoning)** | $25.00 per 1k calls (search content free) |

---

## Fine-Tuning

| Model | Training | Input | Cached Input | Output |
|-------|----------|-------|--------------|--------|
| **o4-mini-2025-04-16** | $100/hour | $4.00 | $1.00 | $16.00 |
| **o4-mini (with data sharing)** | $100/hour | $2.00 | $0.50 | $8.00 |
| **gpt-4.1-2025-04-14** | $25.00 | $3.00 | $0.75 | $12.00 |
| **gpt-4.1-mini-2025-04-14** | $5.00 | $0.80 | $0.20 | $3.20 |
| **gpt-4o-2024-08-06** | $25.00 | $3.75 | $1.875 | $15.00 |
| **gpt-4o-mini-2024-07-18** | $3.00 | $0.30 | $0.15 | $1.20 |

---

## Cost Optimization Tips

### 1. Use Cached Input
- Cached input is 90% cheaper for most models
- Great for repeated context (system prompts, long documents)

### 2. Batch API
- 50% discount on embeddings
- Suitable for non-time-sensitive operations

### 3. Model Selection
- **gpt-4o-mini**: Best cost/performance for most tasks ($0.15 input)
- **text-embedding-3-small**: Most cost-effective embeddings ($0.02)
- **gpt-5-nano**: Ultra-low cost for simple tasks ($0.05 input)

### 4. Processing Tiers
- **Priority**: Faster processing, standard pricing
- **Flex**: Lower prices with higher latency

---

## Relevant Models for Semantic Content Management

### Recommended Configuration

| Use Case | Model | Input Cost | Output Cost | Rationale |
|----------|-------|------------|-------------|-----------|
| **Embeddings** | text-embedding-3-small | $0.02 | - | Best cost/performance ratio |
| **Summarization** | gpt-4o-mini | $0.15 | $0.60 | Cost-effective, high quality |
| **Complex Analysis** | gpt-4o | $2.50 | $10.00 | When quality is critical |
| **Batch Embeddings** | text-embedding-3-small (batch) | $0.01 | - | 50% savings for non-urgent |

### Cost Comparison Examples

**Embedding 1M tokens:**
- text-embedding-3-small: $0.02
- text-embedding-3-large: $0.13 (6.5x more expensive)
- Batch discount: $0.01 (50% savings)

**Summarizing 1M input tokens + 200K output:**
- gpt-4o-mini: $0.15 + $0.12 = $0.27
- gpt-4o: $2.50 + $2.00 = $4.50 (16.7x more expensive)
- gpt-5-mini: $0.25 + $0.40 = $0.65 (2.4x more expensive)

---

## Budget Planning

### Typical Semantic Content Management Costs

**Per Project (average 10,000 tokens):**
- Embeddings (T3 chunks): ~$0.0002
- T1 Summary generation: ~$0.002
- T2 Heading summaries (5 sections): ~$0.005
- **Total per project**: ~$0.007

**For 100 projects:**
- Initial indexing: ~$0.70
- Monthly updates (20% change): ~$0.14/month

**Budget Recommendations:**
- **Small portfolio** (10-50 projects): $5-10/month
- **Medium portfolio** (50-200 projects): $10-25/month
- **Large portfolio** (200+ projects): $25-50/month

---

## Notes

1. **Cached Input**: Requires prompt caching feature, saves 90% on repeated context
2. **Batch API**: 50% discount but with 24-hour processing window
3. **Web Search**: Additional costs for search content tokens at model rates
4. **Fine-tuning**: Training costs are per hour, inference uses standard rates
5. **Moderation**: Free for all users ✌️

---

## Implementation Constants

For use in `BudgetAwareAIOperations.ts`:

```typescript
// Prices per 1K tokens (divide by 1000 from per-1M pricing)
private readonly COSTS = {
  // Embeddings
  'text-embedding-3-small': 0.00002,      // $0.02 per 1M
  'text-embedding-3-large': 0.00013,      // $0.13 per 1M
  'text-embedding-ada-002': 0.0001,       // $0.10 per 1M
  
  // Chat models (input tokens)
  'gpt-4o-mini': 0.00015,                 // $0.15 per 1M
  'gpt-4o': 0.0025,                       // $2.50 per 1M
  'gpt-4.1-mini': 0.0004,                 // $0.40 per 1M
  'gpt-4.1': 0.002,                       // $2.00 per 1M
  'gpt-5-mini': 0.00025,                  // $0.25 per 1M
  'gpt-5': 0.00125,                       // $1.25 per 1M
  
  // Legacy
  'gpt-4': 0.03,                          // $30 per 1M
  'gpt-3.5-turbo': 0.0005,                // $0.50 per 1M
};

// Output token costs (for chat models)
private readonly OUTPUT_COSTS = {
  'gpt-4o-mini': 0.0006,                  // $0.60 per 1M
  'gpt-4o': 0.01,                         // $10.00 per 1M
  'gpt-4.1-mini': 0.0016,                 // $1.60 per 1M
  'gpt-4.1': 0.008,                       // $8.00 per 1M
  'gpt-5-mini': 0.002,                    // $2.00 per 1M
  'gpt-5': 0.01,                          // $10.00 per 1M
};
```

---

**Document Version**: 1.0  
**Last Verified**: January 2025  
**Next Review**: Quarterly or when OpenAI announces pricing changes
