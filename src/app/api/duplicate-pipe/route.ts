import { NextRequest, NextResponse } from "next/server";
import { init, id as generateId } from "@instantdb/admin";

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID!;
const ADMIN_KEY = process.env.INSTANT_ADMIN_KEY!;

if (!APP_ID || !ADMIN_KEY) {
  throw new Error("Missing InstantDB environment variables");
}

const db = init({
  appId: APP_ID,
  adminToken: ADMIN_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { pipeId } = await req.json();

    if (!pipeId) {
      return NextResponse.json({ error: "Pipe ID is required" }, { status: 400 });
    }

    // Query the source pipe with all related data
    const result = await db.query({
      pipes: {
        $: { where: { id: pipeId } },
        stages: {
          forms: {},
          automations: {},
        },
        automations: {}, // Pipe-level automations
        email_templates: {},
      },
    });

    const sourcePipe = result.pipes[0];
    if (!sourcePipe) {
      return NextResponse.json({ error: "Pipe not found" }, { status: 404 });
    }

    // Create new pipe with "(Copy)" suffix
    const newPipeId = generateId();
    const newPipeName = `${sourcePipe.name} (Copy)`;

    // Create stage ID mapping (old ID -> new ID)
    const stageIdMap: Record<string, string> = {};
    const stages = sourcePipe.stages || [];
    stages.forEach((stage: any) => {
      stageIdMap[stage.id] = generateId();
    });

    // Create form ID mapping (old ID -> new ID)
    const formIdMap: Record<string, string> = {};
    stages.forEach((stage: any) => {
      const forms = stage.forms || [];
      forms.forEach((form: any) => {
        formIdMap[form.id] = generateId();
      });
    });

    // Prepare transactions
    const transactions: any[] = [];

    // 1. Create new pipe
    transactions.push(
      db.tx.pipes[newPipeId].update({
        name: newPipeName,
      })
    );

    // 2. Create new stages
    stages.forEach((stage: any) => {
      const newStageId = stageIdMap[stage.id];
      transactions.push(
        db.tx.stages[newStageId]
          .update({
            name: stage.name,
            position: stage.position,
            backgroundColor: stage.backgroundColor || null,
          })
          .link({ pipe: newPipeId })
      );
    });

    // 3. Create new forms (linked to new stages)
    stages.forEach((stage: any) => {
      const newStageId = stageIdMap[stage.id];
      const forms = stage.forms || [];

      forms.forEach((form: any) => {
        const newFormId = formIdMap[form.id];
        transactions.push(
          db.tx.stage_forms[newFormId]
            .update({
              name: form.name,
              formType: form.formType,
              fields: form.fields,
              createdAt: Date.now(),
            })
            .link({ stage: newStageId })
        );
      });
    });

    // 4. Create new automations (with updated stage and form references)
    stages.forEach((stage: any) => {
      const newStageId = stageIdMap[stage.id];
      const automations = stage.automations || [];

      automations.forEach((automation: any) => {
        const newAutomationId = generateId();

        // Update stage IDs and form IDs in conditions, actions, and triggerConfig
        let updatedConditions = automation.conditions;
        let updatedActions = automation.actions;
        let updatedTriggerConfig = automation.triggerConfig;

        // Replace old stage IDs with new stage IDs in JSON
        if (updatedConditions) {
          const conditionsStr = JSON.stringify(updatedConditions);
          let newConditionsStr = conditionsStr;
          Object.entries(stageIdMap).forEach(([oldId, newId]) => {
            newConditionsStr = newConditionsStr.replace(new RegExp(oldId, 'g'), newId);
          });
          // Replace old form IDs with new form IDs
          Object.entries(formIdMap).forEach(([oldId, newId]) => {
            newConditionsStr = newConditionsStr.replace(new RegExp(oldId, 'g'), newId);
          });
          updatedConditions = JSON.parse(newConditionsStr);
        }

        if (updatedActions) {
          const actionsStr = JSON.stringify(updatedActions);
          let newActionsStr = actionsStr;
          Object.entries(stageIdMap).forEach(([oldId, newId]) => {
            newActionsStr = newActionsStr.replace(new RegExp(oldId, 'g'), newId);
          });
          // Replace old form IDs with new form IDs
          Object.entries(formIdMap).forEach(([oldId, newId]) => {
            newActionsStr = newActionsStr.replace(new RegExp(oldId, 'g'), newId);
          });
          updatedActions = JSON.parse(newActionsStr);
        }

        if (updatedTriggerConfig) {
          const triggerConfigStr = JSON.stringify(updatedTriggerConfig);
          let newTriggerConfigStr = triggerConfigStr;
          Object.entries(stageIdMap).forEach(([oldId, newId]) => {
            newTriggerConfigStr = newTriggerConfigStr.replace(new RegExp(oldId, 'g'), newId);
          });
          // Replace old form IDs with new form IDs
          Object.entries(formIdMap).forEach(([oldId, newId]) => {
            newTriggerConfigStr = newTriggerConfigStr.replace(new RegExp(oldId, 'g'), newId);
          });
          updatedTriggerConfig = JSON.parse(newTriggerConfigStr);
        }

        transactions.push(
          db.tx.automations[newAutomationId]
            .update({
              name: automation.name,
              enabled: automation.enabled,
              triggerType: automation.triggerType,
              triggerConfig: updatedTriggerConfig,
              conditions: updatedConditions,
              actions: updatedActions,
              position: automation.position,
              createdAt: Date.now(),
            })
            .link({ stage: newStageId })
        );
      });
    });

    // 4.5. Create pipe-level automations (with updated stage and form references)
    const pipeAutomations = sourcePipe.automations || [];
    pipeAutomations.forEach((automation: any) => {
      const newAutomationId = generateId();

      // Update stage IDs and form IDs in conditions, actions, and triggerConfig
      let updatedConditions = automation.conditions;
      let updatedActions = automation.actions;
      let updatedTriggerConfig = automation.triggerConfig;

      // Replace old stage IDs with new stage IDs in JSON
      if (updatedConditions) {
        const conditionsStr = JSON.stringify(updatedConditions);
        let newConditionsStr = conditionsStr;
        Object.entries(stageIdMap).forEach(([oldId, newId]) => {
          newConditionsStr = newConditionsStr.replace(new RegExp(oldId, 'g'), newId);
        });
        // Replace old form IDs with new form IDs
        Object.entries(formIdMap).forEach(([oldId, newId]) => {
          newConditionsStr = newConditionsStr.replace(new RegExp(oldId, 'g'), newId);
        });
        updatedConditions = JSON.parse(newConditionsStr);
      }

      if (updatedActions) {
        const actionsStr = JSON.stringify(updatedActions);
        let newActionsStr = actionsStr;
        Object.entries(stageIdMap).forEach(([oldId, newId]) => {
          newActionsStr = newActionsStr.replace(new RegExp(oldId, 'g'), newId);
        });
        // Replace old form IDs with new form IDs
        Object.entries(formIdMap).forEach(([oldId, newId]) => {
          newActionsStr = newActionsStr.replace(new RegExp(oldId, 'g'), newId);
        });
        updatedActions = JSON.parse(newActionsStr);
      }

      if (updatedTriggerConfig) {
        const triggerConfigStr = JSON.stringify(updatedTriggerConfig);
        let newTriggerConfigStr = triggerConfigStr;
        Object.entries(stageIdMap).forEach(([oldId, newId]) => {
          newTriggerConfigStr = newTriggerConfigStr.replace(new RegExp(oldId, 'g'), newId);
        });
        // Replace old form IDs with new form IDs
        Object.entries(formIdMap).forEach(([oldId, newId]) => {
          newTriggerConfigStr = newTriggerConfigStr.replace(new RegExp(oldId, 'g'), newId);
        });
        updatedTriggerConfig = JSON.parse(newTriggerConfigStr);
      }

      transactions.push(
        db.tx.automations[newAutomationId]
          .update({
            name: automation.name,
            enabled: automation.enabled,
            triggerType: automation.triggerType,
            triggerConfig: updatedTriggerConfig,
            conditions: updatedConditions,
            actions: updatedActions,
            position: automation.position,
            createdAt: Date.now(),
          })
          .link({ pipe: newPipeId }) // Link to pipe, not stage
      );
    });

    // 5. Create new email templates
    const emailTemplates = sourcePipe.email_templates || [];
    emailTemplates.forEach((template: any) => {
      const newTemplateId = generateId();
      transactions.push(
        db.tx.email_templates[newTemplateId]
          .update({
            name: template.name,
            subject: template.subject,
            body: template.body,
            fromEmail: template.fromEmail,
            fromName: template.fromName,
            cc: template.cc,
            bcc: template.bcc,
            createdAt: Date.now(),
          })
          .link({ pipe: newPipeId })
      );
    });

    // Execute all transactions
    await db.transact(transactions);

    return NextResponse.json({
      success: true,
      newPipeId,
      newPipeName,
      message: "Pipe duplicated successfully",
    });

  } catch (error) {
    console.error("Error duplicating pipe:", error);
    return NextResponse.json(
      { error: "Failed to duplicate pipe", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
