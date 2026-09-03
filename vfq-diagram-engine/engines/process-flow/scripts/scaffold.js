#!/usr/bin/env node

/**
 * scaffold.js
 *
 * Generate a starter process-flow diagram spec from a CSV template.
 * Prompts for workflow name, steps, decision points, and generates a minimal valid spec.
 *
 * Usage:
 *   node scripts/scaffold.js -o my-process.json
 *   node scripts/scaffold.js -o my-process.json --template order-processing
 *
 * Templates:
 *   order-processing, approval-chain, ai-governance, decision-tree
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const TEMPLATES = {
  'order-processing': {
    title: 'Order Processing Pipeline',
    subtitle: 'End-to-end order fulfillment workflow',
    nodes: [
      { type: 'start', label: 'Start' },
      { type: 'step', id: 'order-received', kind: 'integration', title: 'Order Received', desc: ['Customer submits order'] },
      { type: 'decision', id: 'validate', title: 'Valid Order?', yesLabel: 'Yes', noLabel: 'No', no: { label: 'Invalid' } },
      { type: 'step', id: 'process-payment', kind: 'automated', title: 'Process Payment', desc: ['Charge customer'] },
      { type: 'step', id: 'pack-items', kind: 'manual', title: 'Pack Items', desc: ['Warehouse staff'] },
      { type: 'step', id: 'ship', kind: 'integration', title: 'Ship Order', desc: ['Logistics API'] },
      { type: 'end', label: 'Complete' }
    ],
    ioTable: [
      { input: 'Customer order', output: 'Order ID, validated items', meaning: 'Order submission and validation' },
      { input: 'Payment details', output: 'Payment confirmation', meaning: 'Payment processing' },
      { input: 'Approved order', output: 'Tracking number', meaning: 'Fulfillment and shipment' }
    ]
  },
  'approval-chain': {
    title: 'Document Approval Workflow',
    subtitle: 'Review and sign-off process',
    nodes: [
      { type: 'start', label: 'Start' },
      { type: 'step', id: 'submit', kind: 'manual', title: 'Submit Document', desc: ['Author uploads file'] },
      { type: 'step', id: 'review', kind: 'manual', title: 'Manager Review', desc: ['Feedback round'] },
      { type: 'decision', id: 'approved', title: 'Approved?', yesLabel: 'Yes', noLabel: 'No', no: { label: 'Rejected' } },
      { type: 'step', id: 'sign', kind: 'manual', title: 'Sign-Off', desc: ['Legal signature'] },
      { type: 'end', label: 'Published' }
    ]
  },
  'ai-governance': {
    title: 'AI Use-Case Governance',
    subtitle: 'Submission through deployment',
    nodes: [
      { type: 'start', label: 'Start' },
      { type: 'step', id: 'submit', kind: 'manual', title: 'Submit Use Case', desc: ['Business owner intake'] },
      { type: 'step', id: 'classify', kind: 'automated', title: 'Risk Classification', desc: ['Automated scoring'] },
      { type: 'step', id: 'ethics', kind: 'manual', title: 'Ethics Review', desc: ['Committee review'] },
      { type: 'decision', id: 'approved', title: 'Approved?', yesLabel: 'Yes', noLabel: 'No', no: { label: 'Rejected' } },
      { type: 'step', id: 'deploy', kind: 'integration', title: 'Deploy Model', desc: ['MLOps platform'] },
      { type: 'step', id: 'monitor', kind: 'automated', title: 'Monitor & Audit', desc: ['Observability'] },
      { type: 'end', label: 'Production' }
    ]
  },
  'decision-tree': {
    title: 'Support Ticket Routing',
    subtitle: 'Automated triage and assignment',
    nodes: [
      { type: 'start', label: 'Start' },
      { type: 'decision', id: 'is-urgent', title: 'Urgent?', yesLabel: 'Yes', noLabel: 'No', no: { to: 'normal-queue' } },
      { type: 'step', id: 'escalate', kind: 'integration', title: 'Escalate to Manager', desc: [] },
      { type: 'step', id: 'normal-queue', kind: 'automated', title: 'Add to Queue', desc: [] },
      { type: 'end', label: 'Assigned' }
    ]
  }
};

class Scaffolder {
  constructor(opts = {}) {
    this.opts = opts;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  prompt(question) {
    return new Promise(resolve => {
      this.rl.question(question, resolve);
    });
  }

  async interactive() {
    console.log('\n📋 Process Flow Diagram Scaffolder\n');
    console.log('Available templates:');
    Object.keys(TEMPLATES).forEach(t => console.log(`  • ${t}`));

    const useTemplate = await this.prompt('\nUse a template? (y/n): ');
    if (useTemplate.toLowerCase() === 'y') {
      const template = await this.prompt('Template name: ');
      if (!TEMPLATES[template]) {
        console.error(`Unknown template: ${template}`);
        this.rl.close();
        return null;
      }
      return TEMPLATES[template];
    }

    const title = await this.prompt('Workflow title: ');
    const subtitle = await this.prompt('Subtitle (optional): ');
    const stepCount = parseInt(await this.prompt('Number of steps (e.g., 5): '));

    const nodes = [{ type: 'start', label: 'Start' }];

    for (let i = 0; i < stepCount; i++) {
      const stepTitle = await this.prompt(`Step ${i + 1} title: `);
      const stepKind = await this.prompt(`  Kind (manual/automated/integration): `);
      nodes.push({
        type: 'step',
        id: `step-${i + 1}`,
        kind: stepKind || 'manual',
        title: stepTitle,
        desc: []
      });
    }

    nodes.push({ type: 'end', label: 'Complete' });

    return { title, subtitle, nodes, flow: nodes };
  }

  generate(data) {
    const spec = {
      title: data.title,
      flow: data.nodes || data.flow || []
    };

    if (data.subtitle) {
      spec.subtitle = data.subtitle;
    }

    // Ensure proper structure
    spec.flow = spec.flow.map((node, idx) => {
      if (!node.id && (node.type === 'step' || node.type === 'decision')) {
        node.id = `node-${idx}`;
      }
      return node;
    });

    if (data.ioTable) {
      spec.cards = { ioTable: data.ioTable };
    }

    return spec;
  }

  async run(templateName) {
    let data;

    if (templateName) {
      if (!TEMPLATES[templateName]) {
        console.error(`Unknown template: ${templateName}`);
        process.exit(1);
      }
      data = TEMPLATES[templateName];
    } else {
      data = await this.interactive();
    }

    if (!data) {
      this.rl.close();
      process.exit(1);
    }

    const spec = this.generate(data);
    this.rl.close();
    return spec;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const outputPath = args.includes('-o') ? args[args.indexOf('-o') + 1] : null;
  const templateIdx = args.findIndex(a => a === '--template');
  const templateName = templateIdx !== -1 ? args[templateIdx + 1] : null;

  if (!outputPath) {
    console.error('Usage: node scaffold.js -o <output.json> [--template <name>]');
    process.exit(1);
  }

  const scaffolder = new Scaffolder();
  const spec = await scaffolder.run(templateName);

  fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
  console.log(`\n✓ Created ${outputPath}`);
  console.log(`Next: node scripts/generate.js ${outputPath} diagram.html 1600`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { Scaffolder, TEMPLATES };
