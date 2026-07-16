import { z } from 'zod';

export const IsoDateSchema = z.string().datetime();

export const TextAnchorSchema = z.object({
  documentPath: z.string().min(1),
  quote: z.string().min(1),
  prefix: z.string(),
  suffix: z.string(),
  headingPath: z.array(z.string()),
  documentVersionId: z.string().min(1),
  nodeId: z.string().min(1).optional()
});

const MessageBaseSchema = z.object({
  id: z.string().min(1),
  content: z.string(),
  createdAt: IsoDateSchema
});

export const MessageSchema = z.discriminatedUnion('role', [
  MessageBaseSchema.extend({
    role: z.literal('user'),
    delivery: z.enum(['unsent', 'sent', 'failed'])
  }),
  MessageBaseSchema.extend({
    role: z.literal('assistant'),
    delivery: z.enum(['streaming', 'complete', 'failed'])
  })
]);

export const DiscussionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(['draft', 'active', 'resolved']),
  anchor: TextAnchorSchema,
  messages: z.array(MessageSchema),
  parentDiscussionId: z.string().min(1).optional(),
  forkedFromMessageId: z.string().min(1).optional(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
}).superRefine((discussion, context) => {
  if (discussion.status === 'draft') {
    const first = discussion.messages[0];
    if (!first || first.role !== 'user' || first.delivery !== 'unsent') {
      context.addIssue({
        code: 'custom',
        path: ['messages'],
        message: 'Draft discussions require an unsent user message.'
      });
    }
  }
  if (discussion.parentDiscussionId && !discussion.forkedFromMessageId) {
    context.addIssue({
      code: 'custom',
      path: ['forkedFromMessageId'],
      message: 'Forked discussions require a source message.'
    });
  }
});

export const SuggestionBlockSchema = z.object({
  id: z.string().min(1),
  originalText: z.string(),
  suggestedText: z.string()
});

export const SuggestionSchema = z.object({
  id: z.string().min(1),
  discussionId: z.string().min(1),
  sourceMessageId: z.string().min(1),
  documentVersionId: z.string().min(1),
  anchor: TextAnchorSchema,
  originalText: z.string(),
  suggestedText: z.string(),
  blocks: z.array(SuggestionBlockSchema).min(1),
  status: z.enum(['pending', 'applied', 'alternative', 'rejected']),
  appliedVersionId: z.string().min(1).optional(),
  createdAt: IsoDateSchema
});

export const VersionReasonSchema = z.enum([
  'manual',
  'autosave',
  'pre-suggestion',
  'suggestion-applied',
  'pre-restore'
]);

export const VersionSchema = z.object({
  id: z.string().min(1),
  documentPath: z.string().min(1),
  contentHash: z.string().min(1),
  contentFile: z.string().min(1),
  reason: VersionReasonSchema,
  createdAt: IsoDateSchema
});

export const UiStateSchema = z.object({
  filePanelWidth: z.number().min(180).max(420).default(240),
  filePanelPinned: z.boolean().default(false),
  discussionWidth: z.number().min(320).max(640).default(392),
  discussionOpen: z.boolean().default(false),
  theme: z.enum(['light', 'dark', 'system']).default('light'),
  readingFont: z.enum(['sans', 'serif']).default('sans'),
  lastDocument: z.string().optional(),
  cursor: z.record(z.string(), z.unknown()).optional(),
  scrollOffset: z.number().min(0).optional()
});

export type TextAnchor = z.infer<typeof TextAnchorSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type Discussion = z.infer<typeof DiscussionSchema>;
export type SuggestionBlock = z.infer<typeof SuggestionBlockSchema>;
export type Suggestion = z.infer<typeof SuggestionSchema>;
export type Version = z.infer<typeof VersionSchema>;
export type VersionReason = z.infer<typeof VersionReasonSchema>;
export type UiState = z.infer<typeof UiStateSchema>;
