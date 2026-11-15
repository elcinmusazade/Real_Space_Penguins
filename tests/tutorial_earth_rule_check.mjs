import assert from 'node:assert/strict';
import {STEPS} from '../web/tutorial.js';
import {defaultRule, ruleEditor} from '../web/rule-editor.js';

const lesson = STEPS.find(step => step.title === 'Add the hurricane rule');
const lab = STEPS.find(step => step.title === 'Test and save');
const config = {kind: 'software', sensors: {battery: {name: 'Battery', min: 0, max: 100}},
  responses: {safe_mode: {name: 'Safe mode'}}, hasFor: true, maxFor: 3, maxConditions: 2, slots: 2};
const draft = {rules: [defaultRule(config)]};
const ctx = {tab: 'software', softwareTab: 'earth', addedRule: -1, softwareSlots: 2, softwareDraft: draft};
assert.match(lesson.target(ctx), /rule-add/);
assert.equal(lesson.canAnswer(ctx), true);
draft.rules.push(defaultRule(config));
assert.match(lesson.target(ctx), /computer-picker/);
assert.equal(lesson.canAnswer(ctx), false);
ctx.addedRule = 1;
assert.equal(lesson.target(ctx), '.rule-card[data-kind="software"][data-rule="1"]');
assert.match(ruleEditor(draft.rules, config), /<article class="rule-card" data-kind="software" data-rule="1">/);
assert.equal(lesson.canAnswer(ctx), true, 'Can complete the new block even in the last slot');
assert.equal(lesson.canAnswer({...ctx, softwareTab: 'mars'}), false);
assert.match(lesson.target({...ctx, softwareTab: 'mars'}), /software-tab.*earth/);

const rule = structuredClone(lesson.answer.earthRule);
assert.deepEqual(rule, {when: [{sensor: 'wind', op: '>', value: 55}], for: 1, then: 'descend'});
draft.rules[1] = rule;
assert.equal(lesson.done(ctx), true);
assert.equal(lesson.done({...ctx, softwareTab: 'mars'}), false);
for (const change of [{for: 2}, {then: 'safe_mode'}, {when: [{sensor: 'wind', op: '>', value: 50}]},
  {when: [...rule.when, {sensor: 'battery', op: '<', value: 10}]}]) {
  assert.equal(lesson.done({...ctx, softwareDraft: {rules: [{...rule, ...change}]}}), false);
}

ctx.state = {software: {rules: []}, softwareProfiles: {}};
ctx.dirtySoftware = true;
assert.match(lab.target(ctx), /software-test/);
ctx.earthLabPassed = true;
assert.match(lab.target(ctx), /software-save/);
assert.equal(lab.done(ctx), false, 'A passing draft still needs to be saved');
ctx.state.softwareProfiles.earth = draft;
ctx.dirtySoftware = false;
assert.equal(lab.done(ctx), true);
assert.equal(lab.done({...ctx, earthLabPassed: false}), false);
