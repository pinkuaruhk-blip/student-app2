// InstantDB Schema for FlowLane
// This schema defines the data model for pipes, stages, cards, card fields, and comments

import { i } from "@instantdb/react";

// Define the schema with entities and links (relationships)
const schema = i.schema({
  entities: {
    // Pipes namespace - represents a workflow/pipeline
    pipes: i.entity({
      name: i.string(),
    }),

    // Stages namespace - columns within a pipe
    stages: i.entity({
      name: i.string(),
      position: i.number().indexed(), // For ordering stages, indexed for performance
      backgroundColor: i.string().optional(), // Hex color for stage column background
    }),

    // Cards namespace - individual items in the pipeline
    cards: i.entity({
      title: i.string(),
      description: i.string().optional(),
      createdAt: i.number().indexed(), // Timestamp, indexed for sorting
      updatedAt: i.number(), // Timestamp
    }),

    // Card fields namespace - custom fields for cards
    card_fields: i.entity({
      key: i.string(), // Field name
      type: i.string(), // "text", "number", "date", "select", "file"
      value: i.any(), // Flexible value storage
      position: i.number().optional(), // For ordering fields within a card
    }),

    // Card comments namespace - comments on cards
    card_comments: i.entity({
      author: i.string(),
      body: i.string(),
      attachments: i.json().optional(), // Array of attachment objects
      createdAt: i.number().indexed(), // Timestamp, indexed for sorting
    }),

    // Card emails namespace - email correspondence for cards
    card_emails: i.entity({
      direction: i.string(), // "sent" or "received"
      from: i.string(), // Sender email address
      to: i.string(), // Recipient email address
      cc: i.string().optional(), // CC email addresses (comma-separated)
      subject: i.string(),
      body: i.string(),
      sentAt: i.number().indexed(), // Timestamp, indexed for sorting
      emailId: i.string().optional(), // External email ID for tracking replies
      inReplyTo: i.string().optional(), // Reference to original email ID
      read: i.boolean().optional(), // Whether the email has been read (true for sent, false/true for received)
      sentVia: i.string().optional(), // How the email was sent: "automation" or undefined for manual
    }),

    // Card SMS namespace - SMS correspondence for cards
    card_sms: i.entity({
      direction: i.string(), // "sent" or "received"
      from: i.string(), // Sender phone number
      to: i.string(), // Recipient phone number
      body: i.string(), // SMS message content
      sentAt: i.number().indexed(), // Timestamp, indexed for sorting
      smsId: i.string().optional(), // Twilio SMS SID for tracking
      status: i.string().optional(), // "queued", "sent", "delivered", "failed"
      read: i.boolean().optional(), // Whether the SMS has been read
      sentVia: i.string().optional(), // How the SMS was sent: "automation" or undefined for manual
    }),

    // Stage forms namespace - form templates for stages
    stage_forms: i.entity({
      name: i.string(), // Form name
      formType: i.string().optional(), // "client" or "admin" - defaults to client
      fields: i.json(), // Array of field definitions: [{name, type, label, required, options}]
      createdAt: i.number().indexed(),
    }),

    // Form submissions namespace - client form responses
    form_submissions: i.entity({
      responses: i.json(), // Key-value pairs of form field responses
      submittedAt: i.number().indexed(),
      submitterEmail: i.string().optional(), // Email of person who submitted
    }),

    // Card history namespace - track stage movements
    card_history: i.entity({
      movedAt: i.number().indexed(), // Timestamp when moved
      fromStageId: i.string().optional(), // Previous stage (null if first stage)
      toStageId: i.string(), // New stage
      fromStageName: i.string().optional(), // Stage name snapshot
      toStageName: i.string(), // Stage name snapshot
    }),

    // Automations namespace - workflow automation rules
    automations: i.entity({
      name: i.string(), // Automation rule name
      enabled: i.boolean(), // Whether automation is active
      triggerType: i.string(), // "form_submission", "card_enters_stage", "card_field_value", "time_based", "manual"
      triggerConfig: i.json(), // Trigger-specific configuration
      conditions: i.json().optional(), // Optional conditions: {logic: "AND"|"OR", rules: [{fieldKey, operator, value}]}
      actions: i.json(), // Array of actions to execute in sequence
      position: i.number().optional(), // For ordering automations
      createdAt: i.number().indexed(), // Timestamp
    }),

    // Automation logs namespace - execution history
    automation_logs: i.entity({
      executedAt: i.number().indexed(), // Timestamp
      status: i.string(), // "success", "error", or "skipped"
      triggerType: i.string(), // Which trigger type fired
      conditionsMet: i.boolean().optional(), // Whether conditions were met (null if no conditions)
      actionsExecuted: i.json(), // Array of executed actions with results
      errorMessage: i.string().optional(), // Error details if status is "error"
    }),

    // Email templates namespace - reusable email templates
    email_templates: i.entity({
      name: i.string(), // Template name
      subject: i.string(), // Email subject line (supports placeholders)
      body: i.string(), // Email body HTML/text (supports placeholders)
      fromEmail: i.string().optional(), // From/Reply-to email address (optional)
      fromName: i.string().optional(), // From display name (optional, e.g. "John Doe")
      toEmail: i.string().optional(), // Override recipient email address (optional)
      cc: i.string().optional(), // CC email addresses (optional, comma-separated)
      bcc: i.string().optional(), // BCC email address (optional)
      description: i.string().optional(), // Optional description of when to use
      createdAt: i.number().indexed(), // Timestamp
    }),

    // SMS templates namespace - reusable SMS templates
    sms_templates: i.entity({
      name: i.string(), // Template name
      body: i.string(), // SMS message body (supports placeholders)
      description: i.string().optional(), // Optional description of when to use
      createdAt: i.number().indexed(), // Timestamp
    }),

    // System settings namespace - global application settings
    system_settings: i.entity({
      defaultFromEmail: i.string().optional(), // Default sender email address
      defaultFromName: i.string().optional(), // Default sender display name
      globalVariables: i.json().optional(), // Global variables for email templates [{name, value}]
    }),
  },
  links: {
    // Link stages to pipes
    stagesPipe: {
      forward: {
        on: "stages",
        has: "one",
        label: "pipe",
      },
      reverse: {
        on: "pipes",
        has: "many",
        label: "stages",
      },
    },
    // Link cards to pipes
    cardsPipe: {
      forward: {
        on: "cards",
        has: "one",
        label: "pipe",
      },
      reverse: {
        on: "pipes",
        has: "many",
        label: "cards",
      },
    },
    // Link cards to stages
    cardsStage: {
      forward: {
        on: "cards",
        has: "one",
        label: "stage",
      },
      reverse: {
        on: "stages",
        has: "many",
        label: "cards",
      },
    },
    // Link card fields to cards
    cardFieldsCard: {
      forward: {
        on: "card_fields",
        has: "one",
        label: "card",
      },
      reverse: {
        on: "cards",
        has: "many",
        label: "fields",
      },
    },
    // Link card comments to cards
    cardCommentsCard: {
      forward: {
        on: "card_comments",
        has: "one",
        label: "card",
      },
      reverse: {
        on: "cards",
        has: "many",
        label: "comments",
      },
    },
    // Link card emails to cards
    cardEmailsCard: {
      forward: {
        on: "card_emails",
        has: "one",
        label: "card",
      },
      reverse: {
        on: "cards",
        has: "many",
        label: "emails",
      },
    },
    // Link card SMS to cards
    cardSmsCard: {
      forward: {
        on: "card_sms",
        has: "one",
        label: "card",
      },
      reverse: {
        on: "cards",
        has: "many",
        label: "sms",
      },
    },
    // Link stage forms to stages
    stageFormsStage: {
      forward: {
        on: "stage_forms",
        has: "one",
        label: "stage",
      },
      reverse: {
        on: "stages",
        has: "many",
        label: "forms",
      },
    },
    // Link form submissions to cards
    formSubmissionsCard: {
      forward: {
        on: "form_submissions",
        has: "one",
        label: "card",
      },
      reverse: {
        on: "cards",
        has: "many",
        label: "form_submissions",
      },
    },
    // Link form submissions to stage forms
    formSubmissionsForm: {
      forward: {
        on: "form_submissions",
        has: "one",
        label: "form",
      },
      reverse: {
        on: "stage_forms",
        has: "many",
        label: "submissions",
      },
    },
    // Link card history to cards
    cardHistoryCard: {
      forward: {
        on: "card_history",
        has: "one",
        label: "card",
      },
      reverse: {
        on: "cards",
        has: "many",
        label: "history",
      },
    },
    // Link automations to pipes
    automationsPipe: {
      forward: {
        on: "automations",
        has: "one",
        label: "pipe",
      },
      reverse: {
        on: "pipes",
        has: "many",
        label: "automations",
      },
    },
    // Link automations to stages (optional - for stage-specific automations)
    automationsStage: {
      forward: {
        on: "automations",
        has: "one",
        label: "stage",
      },
      reverse: {
        on: "stages",
        has: "many",
        label: "automations",
      },
    },
    // Link automation logs to cards
    automationLogsCard: {
      forward: {
        on: "automation_logs",
        has: "one",
        label: "card",
      },
      reverse: {
        on: "cards",
        has: "many",
        label: "automation_logs",
      },
    },
    // Link automation logs to automations
    automationLogsAutomation: {
      forward: {
        on: "automation_logs",
        has: "one",
        label: "automation",
      },
      reverse: {
        on: "automations",
        has: "many",
        label: "logs",
      },
    },
    // Link email templates to pipes
    emailTemplatesPipe: {
      forward: {
        on: "email_templates",
        has: "one",
        label: "pipe",
      },
      reverse: {
        on: "pipes",
        has: "many",
        label: "email_templates",
      },
    },
    // Link SMS templates to pipes
    smsTemplatesPipe: {
      forward: {
        on: "sms_templates",
        has: "one",
        label: "pipe",
      },
      reverse: {
        on: "pipes",
        has: "many",
        label: "sms_templates",
      },
    },
  },
  rules: {
    allow: {
      pipes: {
        bind: ["isSignedIn"],
        allow: {
          read: "isSignedIn",
        },
      },
      stages: {
        bind: ["isSignedIn"],
        allow: {
          read: "isSignedIn",
        },
      },
      cards: {
        bind: ["isSignedIn"],
        allow: {
          read: "isSignedIn",
        },
      },
      card_fields: {
        bind: ["isSignedIn"],
        allow: {
          read: "isSignedIn",
        },
      },
      emails: {
        bind: ["isSignedIn"],
        allow: {
          read: "isSignedIn",
        },
      },
      email_templates: {
        bind: ["isSignedIn"],
        allow: {
          read: "isSignedIn",
        },
      },
    },
  },
});

export default schema;

// TypeScript types for the schema
export type Schema = typeof schema;
