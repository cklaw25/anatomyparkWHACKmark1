import { inferChanges } from '../frontend/src/mods.js';
for (const [n, part] of [['Amputate both legs', 'abdomen'], ['amputate his legs', 'left_leg'], ['Amputate right leg', 'chest'], ['cut off the leg', 'right_leg'], ['amputation', 'left_leg'], ['amputate all four limbs', 'chest'], ['Amputate left arm', 'left_arm']])
  console.log(n.padEnd(26), JSON.stringify(inferChanges({ name: n, kind: 'surgery' }, part).map(c => c.part)));
