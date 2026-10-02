import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { teamMembers } from '../src/data/site';

const expectedMembers = [
  { name: 'Md. Arif Shekh', image: '/images/team/md-arif-shekh.jpeg' },
  { name: 'Sowad Hossain', image: '/images/team/sowad-hossain.jpeg' },
  { name: 'Din Muhammad Rezwoan', image: '/images/team/din-muhammad-rezwoan.jpeg' },
  { name: 'Md. Meherab Hossain Talukder', image: '/images/team/md-meherab-hossain-talukder.jpg' },
];

test('Team CTRL_V contains exactly four members in the supplied name and image order', () => {
  assert.equal(teamMembers.length, 4);
  assert.deepEqual(teamMembers.map(({ name, image }) => ({ name, image })), expectedMembers);
});

test('Team profiles contain only names, portrait assets, and intrinsic image dimensions', () => {
  for (const member of teamMembers) {
    assert.deepEqual(Object.keys(member).sort(), ['height', 'image', 'name', 'width']);
    assert.ok(Number.isInteger(member.width) && member.width > 0);
    assert.ok(Number.isInteger(member.height) && member.height > 0);
  }
});

test('All four Team portraits are real local JPEG assets, not external links or placeholders', () => {
  for (const member of teamMembers) {
    assert.match(member.image, /^\/images\/team\/[a-z-]+\.(jpe?g)$/);
    const asset = readFileSync(new URL(`../public${member.image}`, import.meta.url));
    assert.ok(asset.length > 1000, `${member.name}: portrait must not be empty`);
    assert.deepEqual([...asset.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  }
});
