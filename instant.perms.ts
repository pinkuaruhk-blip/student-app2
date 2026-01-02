// InstantDB Permissions for FlowLane
// This file defines access control rules for all entities

export default {
  allow: {
    // Pipes - workflow/pipeline access
    pipes: {
      bind: ["isSignedIn"],
      allow: {
        read: "isSignedIn",
        create: "isSignedIn",
        update: "isSignedIn",
        delete: "isSignedIn",
      },
    },
    // Stages - columns within pipes
    stages: {
      bind: ["isSignedIn"],
      allow: {
        read: "isSignedIn",
        create: "isSignedIn",
        update: "isSignedIn",
        delete: "isSignedIn",
      },
    },
    // Cards - individual items in the pipeline
    cards: {
      bind: ["isSignedIn"],
      allow: {
        read: "isSignedIn",
        create: "isSignedIn",
        update: "isSignedIn",
        delete: "isSignedIn",
      },
    },
    // Card fields - custom fields for cards
    card_fields: {
      bind: ["isSignedIn"],
      allow: {
        read: "isSignedIn",
        create: "isSignedIn",
        update: "isSignedIn",
        delete: "isSignedIn",
      },
    },
    // Card comments
    card_comments: {
      bind: ["isSignedIn"],
      allow: {
        read: "isSignedIn",
        create: "isSignedIn",
        update: "isSignedIn",
        delete: "isSignedIn",
      },
    },
    // Card emails
    card_emails: {
      bind: ["isSignedIn"],
      allow: {
        read: "isSignedIn",
        create: "isSignedIn",
        update: "isSignedIn",
        delete: "isSignedIn",
      },
    },
    // Card SMS - NEW!
    card_sms: {
      bind: ["isSignedIn"],
      allow: {
        read: "isSignedIn",
        create: "isSignedIn",
        update: "isSignedIn",
        delete: "isSignedIn",
      },
    },
    // Stage forms
    stage_forms: {
      bind: ["isSignedIn"],
      allow: {
        read: "isSignedIn",
        create: "isSignedIn",
        update: "isSignedIn",
        delete: "isSignedIn",
      },
    },
    // Form submissions
    form_submissions: {
      bind: ["isSignedIn"],
      allow: {
        read: "isSignedIn",
        create: "isSignedIn",
        update: "isSignedIn",
        delete: "isSignedIn",
      },
    },
    // Card history
    card_history: {
      bind: ["isSignedIn"],
      allow: {
        read: "isSignedIn",
        create: "isSignedIn",
        update: "isSignedIn",
        delete: "isSignedIn",
      },
    },
    // Automations
    automations: {
      bind: ["isSignedIn"],
      allow: {
        read: "isSignedIn",
        create: "isSignedIn",
        update: "isSignedIn",
        delete: "isSignedIn",
      },
    },
    // Automation logs
    automation_logs: {
      bind: ["isSignedIn"],
      allow: {
        read: "isSignedIn",
        create: "isSignedIn",
        update: "isSignedIn",
        delete: "isSignedIn",
      },
    },
    // Email templates
    email_templates: {
      bind: ["isSignedIn"],
      allow: {
        read: "isSignedIn",
        create: "isSignedIn",
        update: "isSignedIn",
        delete: "isSignedIn",
      },
    },
    // SMS templates
    sms_templates: {
      bind: ["isSignedIn"],
      allow: {
        read: "isSignedIn",
        create: "isSignedIn",
        update: "isSignedIn",
        delete: "isSignedIn",
      },
    },
    // System settings
    system_settings: {
      bind: ["isSignedIn"],
      allow: {
        read: "isSignedIn",
        create: "isSignedIn",
        update: "isSignedIn",
        delete: "isSignedIn",
      },
    },
  },
};
