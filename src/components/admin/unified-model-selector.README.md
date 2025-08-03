# UnifiedModelSelector Component

A React component that provides a unified dropdown interface for selecting AI models from multiple providers (OpenAI and Anthropic). The component automatically loads available models from the API, groups them by provider, and shows connection status.

## Features

- **Unified Interface**: Single dropdown showing models from all configured providers
- **Provider Grouping**: Models are visually grouped by provider (OpenAI, then Anthropic)
- **Connection Status**: Shows provider connection status and model availability
- **Error Handling**: Graceful handling of loading states and errors
- **Refresh Capability**: Optional refresh button to reload available models
- **Accessibility**: Full keyboard navigation and screen reader support

## Usage

### Basic Usage

```tsx
import { UnifiedModelSelector } from '@/components/admin/unified-model-selector';

function MyComponent() {
  const [selectedModel, setSelectedModel] = useState('');

  return (
    <UnifiedModelSelector
      value={selectedModel}
      onValueChange={setSelectedModel}
      placeholder="Select a model..."
    />
  );
}
```

### With Refresh Button

```tsx
<UnifiedModelSelector
  value={selectedModel}
  onValueChange={setSelectedModel}
  showRefreshButton={true}
  onRefresh={() => console.log('Models refreshed!')}
/>
```

### Disabled State

```tsx
<UnifiedModelSelector
  value=""
  onValueChange={() => {}}
  disabled={true}
  placeholder="Model selection disabled..."
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | `undefined` | Currently selected model ID |
| `onValueChange` | `(value: string) => void` | `undefined` | Callback when selection changes |
| `placeholder` | `string` | `"Select a model..."` | Placeholder text when no model is selected |
| `disabled` | `boolean` | `false` | Whether the selector is disabled |
| `className` | `string` | `undefined` | Additional CSS classes for the trigger |
| `showRefreshButton` | `boolean` | `false` | Whether to show the refresh button |
| `onRefresh` | `() => void` | `undefined` | Callback when refresh button is clicked |

## API Dependencies

The component depends on the `/api/admin/ai/available-models` endpoint which should return:

```typescript
interface AvailableModelsResponse {
  success: boolean;
  data?: {
    byProvider: {
      [provider: string]: {
        provider: string;
        configured: boolean;
        connected: boolean;
        error?: string;
        availableModels: string[];
        configuredModels: string[];
      };
    };
    unified: Array<{
      id: string;
      name: string;
      provider: 'openai' | 'anthropic';
      available: boolean;
    }>;
    summary: {
      totalProviders: number;
      configuredProviders: number;
      connectedProviders: number;
      totalAvailableModels: number;
      totalConfiguredModels: number;
      availableForUse: number;
    };
    retrievedAt: string;
  };
  error?: {
    message: string;
    code: string;
    details: string;
  };
}
```

## States

### Loading State
- Shows spinner and "Loading models..." text
- Selector is disabled during loading

### Error State
- Shows error icon and error message
- Selector is disabled when error occurs

### Empty State
- Shows appropriate message based on configuration:
  - "No AI providers configured" - when no environment variables are set
  - "No providers connected" - when API keys are invalid
  - "No models configured" - when no models are added in settings

### Normal State
- Shows grouped models by provider
- Provider headers show connection status badges
- Individual models show availability status icons
- Unavailable models are disabled and visually dimmed

## Visual Design

### Provider Grouping
- Each provider has a header with name, model count, and status badge
- Clear visual separation between provider groups
- OpenAI models appear first, then Anthropic

### Status Indicators
- **Connected**: Green badge with checkmark
- **Connection Failed**: Red badge with error indicator
- **Not Configured**: Gray badge indicating missing API key

### Model Status
- **Available**: Green checkmark icon
- **Unavailable**: Red alert icon, dimmed text, disabled selection

## Requirements Satisfied

This component satisfies the following requirements from the AI Architecture Redesign spec:

- **3.1**: Unified model selection dropdown displaying all configured models
- **3.2**: Provider grouping (OpenAI, then Anthropic) within same dropdown
- **3.3**: Filtering out models from providers without valid API keys
- **3.4**: Model availability status and provider grouping with visual separation
- **3.5**: Graceful handling of loading states and empty model lists

## Testing

The component can be tested using the example component:

```tsx
import { UnifiedModelSelectorExample } from '@/components/admin/unified-model-selector.example';

// Use in a test page or Storybook
<UnifiedModelSelectorExample />
```

## Accessibility

- Full keyboard navigation support
- Screen reader compatible
- Proper ARIA labels and descriptions
- Focus management for dropdown interactions
- High contrast support for status indicators